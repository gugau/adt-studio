/**
 * Runtime entrypoint — bundled to:
 *   assets/adt/base.bundle.local.js  (IIFE — `<script src="...">`)
 *   assets/adt/base.bundle.min.js    (ESM module)
 *
 * Each book page is its own self-contained HTML document and loads this
 * script in its body. We mount React into the two empty placeholders the
 * page provides:
 *
 *   <div id="interface-container"></div>   ← ChromeRoot
 *   <div id="nav-container"></div>         ← NavRoot
 *
 * The page's own `<div id="content">` is left untouched — it's static
 * HTML that the runtime *enhances* (translations, TTS spans, glossary
 * highlights, activity portals) rather than re-renders.
 */
// In Vite dev, this import is processed by @tailwindcss/vite to produce the
// chrome's CSS. In production, esbuild's CSS loader is set to "empty" — all
// styling comes from the per-book content/tailwind_output.css that
// packages/pipeline regenerates against this same source file.
import "@/styles/globals.css"

import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { Provider as JotaiProvider, getDefaultStore } from "jotai"
import { ChromeRoot } from "@/components/ChromeRoot"
import { NavRoot } from "@/components/NavRoot"
import { bootRuntime, subscribeLanguageChanges } from "@/runtime/lifecycle"
import { describeInitError, showErrorToast, showMainContent } from "@/lib/errors"

// CRITICAL: `<JotaiProvider>` without a `store` prop creates a *new* store
// scoped to that React tree. Our boot lifecycle writes to `getDefaultStore()`,
// so we MUST hand the same store to the Provider — otherwise components
// read forever-stale initial values (config defaults, empty translations).
// We also need a single shared store across ChromeRoot + NavRoot so a setting
// changed in the sidebar (e.g. language) is visible to NavMenu / BackForwardBar.
const sharedStore = getDefaultStore()

declare global {
  interface Window {
    __adtRuntime?: {
      booted: boolean
      chromeRoot?: Root
      navRoot?: Root
      unsubscribe?: () => void
    }
  }
}

function ensureContainer(id: string): HTMLElement | null {
  const existing = document.getElementById(id)
  if (existing) return existing
  // Some embedders strip the placeholders; create them on the fly so the
  // chrome still renders rather than silently no-op-ing.
  const el = document.createElement("div")
  el.id = id
  el.className = "relative z-50"
  document.body.appendChild(el)
  return el
}

function mount(): void {
  if (window.__adtRuntime?.booted) return
  const interfaceContainer = ensureContainer("interface-container")
  const navContainer = ensureContainer("nav-container")
  if (!interfaceContainer || !navContainer) return

  const chromeRoot = createRoot(interfaceContainer)
  chromeRoot.render(
    <React.StrictMode>
      <JotaiProvider store={sharedStore}>
        <ChromeRoot />
      </JotaiProvider>
    </React.StrictMode>,
  )

  const navRoot = createRoot(navContainer)
  navRoot.render(
    <React.StrictMode>
      <JotaiProvider store={sharedStore}>
        <NavRoot />
      </JotaiProvider>
    </React.StrictMode>,
  )

  window.__adtRuntime = { booted: true, chromeRoot, navRoot }

  // Async boot — load config + translations + manifests, then signal
  // language-change subscription so the sidebar selector triggers reloads.
  void bootRuntime()
    .then(() => {
      const unsubscribe = subscribeLanguageChanges()
      window.__adtRuntime!.unsubscribe = unsubscribe
    })
    .catch((err) => {
      console.error("ADT runtime boot failed", err)
      showErrorToast(describeInitError(err))
      showMainContent()
    })
}

function teardown(): void {
  if (!window.__adtRuntime) return
  try {
    window.__adtRuntime.unsubscribe?.()
    window.__adtRuntime.chromeRoot?.unmount()
    window.__adtRuntime.navRoot?.unmount()
  } catch (err) {
    console.warn("ADT runtime teardown error", err)
  }
  window.__adtRuntime = undefined
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true })
  } else {
    mount()
  }
  window.addEventListener("beforeunload", teardown)
}
