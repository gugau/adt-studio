import { useAtomValue } from "jotai"
import { useMemo } from "react"
import { currentSectionIdAtom, pagesAtom, type PageEntry } from "@/state/nav.atoms"
import { useTranslation } from "@/hooks/useTranslation"
import { cn } from "@/lib/utils"
import { DockContent } from "./DockLayout"

function isActivitySectionId(id: string): boolean {
  return id.startsWith("qz")
}

export function ActivityListContent() {
  const pages = useAtomValue(pagesAtom)
  const currentSectionId = useAtomValue(currentSectionIdAtom)
  const { t } = useTranslation()

  const activities = useMemo<PageEntry[]>(
    () => pages.filter((p) => isActivitySectionId(p.section_id)),
    [pages],
  )

  const title = t("activity-list-title") || "Activities"
  const empty = t("activity-list-empty") || "No activities yet"
  const itemPrefix = t("activity-item-label") || "Activity"

  return (
    <DockContent className="gap-3 h-auto max-h-[max(600px,50vh)]">
      <DockContent.Title>{title}</DockContent.Title>
      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground px-1 py-3">{empty}</p>
      ) : (
        <ol className="flex-1 py-1 overflow-y-auto [scrollbar-gutter:stable]">
          {activities.map((page, index) => {
            const active = page.section_id === currentSectionId
            const label = `${itemPrefix} ${index + 1}`
            return (
              <li key={page.section_id}>
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = page.href
                  }}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 mx-1 px-2.5 py-1.5 rounded-md text-sm text-left",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus:outline-none focus:bg-accent focus:text-accent-foreground",
                    active && "bg-accent text-accent-foreground font-medium",
                  )}
                >
                  <span className="truncate">{label}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {page.section_id}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </DockContent>
  )
}
