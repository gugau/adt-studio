/**
 * Global keyboard page navigation — listens for ArrowLeft / ArrowRight (and
 * PageUp / PageDown / Home / End) at document level and navigates between
 * pages from the `pagesAtom` manifest. Inputs, dock menu popovers, the
 * sidebar, and any open dialog suppress the shortcut so the surface in
 * focus owns its own arrow-key behavior.
 *
 * Direction follows reading order: ArrowRight / PageDown → next, ArrowLeft /
 * PageUp → previous. Home / End jump to the first / last page.
 *
 * WCAG: provides keyboard equivalents for the dock's prev/next buttons
 * (SC 2.1.1) without trapping focus (SC 2.1.2) — the listener is only
 * active outside text-input contexts and modal surfaces.
 */
import { useAtomValue } from "jotai"
import { useEffect } from "react"
import { appConfigAtom } from "@/shared/state/config.atoms"
import {
  currentSectionIdAtom,
  pagesAtom,
  type PageEntry,
} from "@/features/navigation/state/nav.atoms"
import { dockMenuValueAtom, sidebarOpenAtom } from "@/shared/state/ui.atoms"

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  if (target.isContentEditable) return true
  // Quiz options listen to arrow keys for radio-group navigation in the
  // legacy a11y pattern; let them keep the keystroke when focused.
  if (target.closest("[data-activity-item]")) return true
  return false
}

function isAnyModalOpen(): boolean {
  if (typeof document === "undefined") return false
  // Radix / base-ui popovers and dialogs set `data-state="open"` on their
  // root portals. The dock menu popovers, sidebar, notepad, eli5, admin,
  // and tutorial overlays all share that convention.
  return Boolean(
    document.querySelector(
      '[role="dialog"][data-state="open"], [data-radix-popper-content-wrapper], [data-base-ui-popper-content-wrapper]',
    ),
  )
}

function findIndex(pages: PageEntry[], sectionId: string | null): number {
  if (!sectionId) return -1
  return pages.findIndex((p) => p.section_id === sectionId)
}

export function useKeyboardPageNav(): void {
  const pages = useAtomValue(pagesAtom)
  const currentSectionId = useAtomValue(currentSectionIdAtom)
  const dockMenuValue = useAtomValue(dockMenuValueAtom)
  const sidebarOpen = useAtomValue(sidebarOpenAtom)
  const features = useAtomValue(appConfigAtom).features

  useEffect(() => {
    if (!features.showNavigationControls) return
    if (pages.length === 0) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (event.altKey || event.ctrlKey || event.metaKey) return
      if (isTypingTarget(event.target)) return
      if (sidebarOpen || dockMenuValue !== "") return
      if (isAnyModalOpen()) return

      const idx = findIndex(pages, currentSectionId)
      let target: PageEntry | undefined

      switch (event.key) {
        case "ArrowRight":
        case "PageDown":
          if (idx >= 0 && idx < pages.length - 1) target = pages[idx + 1]
          break
        case "ArrowLeft":
        case "PageUp":
          if (idx > 0) target = pages[idx - 1]
          break
        case "Home":
          if (idx !== 0) target = pages[0]
          break
        case "End":
          if (idx !== pages.length - 1) target = pages[pages.length - 1]
          break
        default:
          return
      }

      if (!target) return
      event.preventDefault()
      window.location.href = target.href
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [pages, currentSectionId, dockMenuValue, sidebarOpen, features.showNavigationControls])
}
