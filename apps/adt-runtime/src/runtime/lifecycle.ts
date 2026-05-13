/**
 * Boot lifecycle — orchestrates the same sequence base.js used to run on
 * `DOMContentLoaded`, but expressed as a single async function that yields
 * back to React for rendering.
 *
 * Sequence:
 *   1. addFavicons()
 *   2. loadAppConfig() → window.appConfig + appConfigAtom
 *   3. setStorageMode() — picks cookie vs localStorage based on the config
 *   4. Resolve current language against config + persisted preference
 *   5. loadTranslations() — interface + content catalogs
 *   6. loadPagesManifest(), loadTocManifest()
 *   7. resolveCurrentSection() from <meta name="title-id">
 *   8. initAnalytics() — fire and forget
 *   9. installShowContentFallback() — safety net
 */
import { getDefaultStore } from "jotai"
import { addFavicons } from "./favicon"
import { loadAppConfig, pickLanguage, pickStorageMode } from "./config"
import { applyImageVariants, applyTranslationsToDOM, loadTranslations } from "./i18n"
import { loadPagesManifest, loadTocManifest } from "./manifest-loader"
import { loadGlossary } from "./glossary-loader"
import { loadTimecodes } from "./tts-loader"
import { setStorageMode } from "@/state/persist"
import { appConfigAtom } from "@/state/config.atoms"
import {
  currentLanguageAtom,
  imageFilesAtom,
  translationsAtom,
} from "@/state/language.atoms"
import {
  dockReadyAtom,
  easyReadModeAtom,
  glossaryModeAtom,
} from "@/state/ui.atoms"
import { glossaryDataAtom } from "@/state/glossary.atoms"
import {
  currentPageNumberAtom,
  currentSectionIdAtom,
  pagesAtom,
  tocAtom,
} from "@/state/nav.atoms"
import {
  applyGlossaryHighlights,
  removeGlossaryHighlights,
} from "@/lib/glossary/highlight"
import { locateGlossaryTerm } from "@/lib/glossary/locate"
import { initAnalytics } from "@/lib/analytics"
import { installShowContentFallback, showMainContent } from "@/lib/errors"
import { activityModeAtom, isActivityPageAtom } from "@/state/activity.atoms"
import { initializeQuizActivity } from "./activity-quiz"

function readCurrentSectionId(): string | null {
  if (typeof document === "undefined") return null
  return (
    document.querySelector('meta[name="title-id"]')?.getAttribute("content") ?? null
  )
}

function readIsActivityPage(): boolean {
  if (typeof document === "undefined") return false
  return !!document.querySelector('section[data-section-type^="activity_"]')
}

function readCurrentPageNumber(): number | null {
  const meta = document
    .querySelector('meta[name="page-section-id"]')
    ?.getAttribute("content")
  const num = meta ? Number.parseInt(meta, 10) : Number.NaN
  return Number.isFinite(num) ? num : null
}

function readPersistedLanguage(): string | null {
  if (typeof document === "undefined") return null
  const fromLs =
    typeof localStorage !== "undefined" ? localStorage.getItem("currentLanguage") : null
  const fromCookie = (() => {
    const match = document.cookie.match(/(?:^|;\s*)currentLanguage=([^;]+)/)
    return match ? decodeURIComponent(match[1]) : null
  })()
  const raw = fromLs ?? fromCookie
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === "string" ? parsed : raw
  } catch {
    return raw
  }
}

export async function bootRuntime(): Promise<void> {
  installShowContentFallback()
  addFavicons()

  const store = getDefaultStore()
  try {
    const config = await loadAppConfig()
    store.set(appConfigAtom, config)
    setStorageMode(pickStorageMode(config))

    const htmlLang = document.documentElement.getAttribute("lang")
    const persisted = readPersistedLanguage()
    const language = pickLanguage(config, persisted, htmlLang)
    store.set(currentLanguageAtom, language)

    const [, pages, toc] = await Promise.all([
      loadTranslations(language, config.bundleVersion),
      loadPagesManifest(config.bundleVersion),
      loadTocManifest(config.bundleVersion),
      loadGlossary(language, config.bundleVersion),
      loadTimecodes(language, config.bundleVersion),
    ])
    store.set(pagesAtom, pages)
    store.set(tocAtom, toc)
    store.set(currentSectionIdAtom, readCurrentSectionId())
    store.set(currentPageNumberAtom, readCurrentPageNumber())
    // Page-type signal (fixed for the document) + initial mode toggle.
    const isActivity = readIsActivityPage()
    store.set(isActivityPageAtom, isActivity)
    store.set(activityModeAtom, isActivity)

    applyDOMTranslations()

    initAnalytics(config.analytics)
    showMainContent()
    processGlossaryLocateHint()
    initializeQuizActivity()
  } finally {
    // Always clear the dock skeleton — even on partial-load failures the dock
    // should reveal whatever data DID make it into atoms.
    store.set(dockReadyAtom, true)
  }
}

function processGlossaryLocateHint(): void {
  if (typeof window === "undefined") return
  const match = window.location.hash.match(/^#glossary=(.+)$/)
  if (!match) return
  const word = decodeURIComponent(match[1])
  history.replaceState(
    null,
    "",
    window.location.pathname + window.location.search,
  )

  const store = getDefaultStore()
  const entry = store.get(glossaryDataAtom)[word]
  if (!entry) return

  // The browser's default scroll restoration competes with our
  // scrollIntoView at load time; opt out for this navigation.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual"

  // Wait until the page has finished loading (images, fonts) so the
  // term's final layout position is stable before we scroll/flash.
  const run = () => {
    const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts
    const ready = fonts?.ready ?? Promise.resolve()
    ready.then(() => requestAnimationFrame(() => locateGlossaryTerm(entry)))
  }
  if (document.readyState === "complete") run()
  else window.addEventListener("load", run, { once: true })
}

/**
 * Apply the latest translations + image variants to the static content DOM,
 * then re-apply glossary highlights when the toggle is on.
 *
 * Order matters: `applyTranslationsToDOM` rewrites `innerHTML` of every
 * `[data-id]` element, which would otherwise destroy any glossary highlight
 * spans nested inside them. Running the highlighter as the final step makes
 * sure the visible state is "translated text + highlighted terms" regardless
 * of the order in which the translation / glossary fetches resolve.
 *
 * Reads atom state at call time so it can be triggered both on boot and
 * whenever the language / easy-read toggle changes.
 */
function applyDOMTranslations(): void {
  const store = getDefaultStore()
  const translations = store.get(translationsAtom)
  const images = store.get(imageFilesAtom)
  const easyReadMode = store.get(easyReadModeAtom) as boolean
  applyTranslationsToDOM(translations, { easyReadMode })
  applyImageVariants(images)

  const glossaryEnabled = store.get(glossaryModeAtom) as boolean
  if (glossaryEnabled) {
    const glossaryData = store.get(glossaryDataAtom)
    // Always wipe stale spans first so a re-apply (e.g. on language change)
    // doesn't compound or skip already-marked base forms.
    removeGlossaryHighlights()
    if (Object.keys(glossaryData).length > 0) {
      applyGlossaryHighlights(glossaryData)
    }
  }
}

/**
 * Subscribe to language and easy-read changes after boot. When the user picks
 * a new language from the sidebar, reload translations and re-apply them to
 * the static content DOM without a full page navigation. Easy-read toggling
 * just re-applies (no re-fetch needed — both variants live in the same dict).
 */
export function subscribeLanguageChanges(): () => void {
  const store = getDefaultStore()
  // currentLanguageAtom is sync (atomWithStorage with getOnInit), but the
  // Jotai type still includes Promise<T> in its read signature; cast away.
  let lastLanguage = store.get(currentLanguageAtom) as string

  const unsubLanguage = store.sub(currentLanguageAtom, () => {
    const next = store.get(currentLanguageAtom) as string
    if (next === lastLanguage) return
    lastLanguage = next
    const config = store.get(appConfigAtom)
    void Promise.all([
      loadTranslations(next, config.bundleVersion),
      loadGlossary(next, config.bundleVersion),
      loadTimecodes(next, config.bundleVersion),
    ]).then(() => applyDOMTranslations())
  })

  const unsubEasyRead = store.sub(easyReadModeAtom, () => applyDOMTranslations())

  return () => {
    unsubLanguage()
    unsubEasyRead()
  }
}
