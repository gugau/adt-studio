import { useAtomValue } from "jotai"
import { currentSectionIdAtom, pagesAtom, tocAtom } from "@/state/nav.atoms"
import { useTranslation } from "@/hooks/useTranslation"
import { cn } from "@/lib/utils"

/**
 * TOC list rendered inside a NavigationMenu content panel. Selecting an
 * entry triggers `window.location.href = entry.href` — the runtime is MPA
 * so each navigation is a real document load.
 */
export function TocContent() {
  const toc = useAtomValue(tocAtom)
  const pages = useAtomValue(pagesAtom)
  const currentSectionId = useAtomValue(currentSectionIdAtom)
  const { t } = useTranslation()

  const entries =
    toc.length > 0
      ? toc
      : pages.map((p) => ({
          section_id: p.section_id,
          href: p.href,
          title: p.section_id,
          chapter_id: p.section_id,
          level: undefined as number | undefined,
        }))

  return (
    <div className="flex flex-col w-[var(--dock-width,32rem)] max-w-[calc(100vw-2rem)]">
      <div className="px-3 py-2 border-b border-border">
        <h3 className="text-sm font-semibold">{t("nav-label") || "Contents"}</h3>
      </div>
      <ul className="py-1 max-h-[28rem] overflow-y-auto [scrollbar-gutter:stable]">
        {entries.map((entry) => {
          const active = entry.section_id === currentSectionId
          return (
            <li key={entry.section_id}>
              <button
                type="button"
                onClick={() => {
                  window.location.href = entry.href
                }}
                className={cn(
                  "w-full text-left rounded-md mx-1 px-2.5 py-1.5 text-sm",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus:outline-none focus:bg-accent focus:text-accent-foreground",
                  active && "bg-accent text-accent-foreground font-medium",
                  entry.level === 2 && "pl-6",
                  entry.level === 3 && "pl-9",
                )}
                aria-current={active ? "page" : undefined}
              >
                {entry.title}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
