import { useAtomValue } from "jotai"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { currentSectionIdAtom, pagesAtom } from "@/state/nav.atoms"
import { appConfigAtom } from "@/state/config.atoms"
import { useTranslation } from "@/hooks/useTranslation"

/**
 * Replaces `#back-forward-buttons` from interface.html. Each page is its own
 * HTML file, so navigation is `window.location.href = entry.href` — a real
 * browser navigation that triggers the full boot sequence on the next page.
 */
export function BackForwardBar() {
  const pages = useAtomValue(pagesAtom)
  const currentSectionId = useAtomValue(currentSectionIdAtom)
  const features = useAtomValue(appConfigAtom).features
  const { t } = useTranslation()

  if (!features.showNavigationControls || pages.length === 0) return null

  const idx = pages.findIndex((p) => p.section_id === currentSectionId)
  const prev = idx > 0 ? pages[idx - 1] : undefined
  const next = idx >= 0 && idx < pages.length - 1 ? pages[idx + 1] : undefined
  const pageNumber = pages[idx]?.page_number ?? (idx >= 0 ? idx + 1 : null)

  const go = (href: string | undefined) => {
    if (!href) return
    window.location.href = href
  }

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 flex flex-row-reverse items-center bg-white border border-gray-300 rounded-2xl shadow-md z-[55]">
      <button
        type="button"
        aria-label={t("next-page") || "Next page"}
        disabled={!next}
        onClick={() => go(next?.href)}
        className="text-2xl no-underline text-gray-800 px-4 py-2 disabled:opacity-30"
      >
        <ChevronRight className="w-6 h-6" />
      </button>
      <span className="align-text-bottom no-underline text-gray-800 px-4 py-2 text-lg border-r border-gray-300">
        {pageNumber ?? ""}
      </span>
      <button
        type="button"
        aria-label={t("previous-page") || "Previous page"}
        disabled={!prev}
        onClick={() => go(prev?.href)}
        className="text-2xl no-underline text-gray-800 px-4 py-2 border-r border-gray-300 disabled:opacity-30"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
    </div>
  )
}
