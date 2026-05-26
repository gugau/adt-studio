import { HelpCircle, Puzzle } from "lucide-react"
import { useLingui } from "@lingui/react/macro"
import type { ActivityItem } from "@/api/client"
import { getSectionTypeLabel } from "@/lib/section-constants"

export type ActivityItemKey =
  | { kind: "quiz"; quizIndex: number }
  | { kind: "section-activity"; pageId: string; sectionIndex: number }

export function activityKey(item: ActivityItem): string {
  return item.kind === "quiz"
    ? `quiz:${item.quizIndex}`
    : `activity:${item.pageId}:${item.sectionIndex}`
}

interface ActivitiesListProps {
  items: ActivityItem[]
  selectedKey: string | null
  onSelect: (item: ActivityItem) => void
}

export function ActivitiesList({ items, selectedKey, onSelect }: ActivitiesListProps) {
  const { t } = useLingui()

  if (items.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-xs text-muted-foreground">
        {t`No activities yet`}
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {items.map((item) => {
        const key = activityKey(item)
        const selected = key === selectedKey
        return (
          <ActivityListItem
            key={key}
            item={item}
            selected={selected}
            onSelect={() => onSelect(item)}
          />
        )
      })}
    </div>
  )
}

interface ActivityListItemProps {
  item: ActivityItem
  selected: boolean
  onSelect: () => void
}

function ActivityListItem({ item, selected, onSelect }: ActivityListItemProps) {
  const { t } = useLingui()

  const isQuiz = item.kind === "quiz"
  const Icon = isQuiz ? HelpCircle : Puzzle
  const typeLabel = isQuiz
    ? t`Quiz`
    : getSectionTypeLabel(item.sectionType)
  const title = isQuiz ? item.quiz.question : extractActivityPreview(item.html)
  const position = isQuiz
    ? t`After ${item.afterPageId}`
    : t`On ${item.pageId}`

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group flex items-start gap-2.5 px-3 py-2.5 border-l-2 text-left transition-colors cursor-pointer ${
        selected
          ? "bg-orange-50 border-l-orange-500"
          : "bg-transparent border-l-transparent hover:bg-muted/40"
      }`}
    >
      <div
        className={`shrink-0 mt-0.5 flex h-7 w-7 items-center justify-center rounded ${
          isQuiz
            ? "bg-orange-100 text-orange-700"
            : "bg-violet-100 text-violet-700"
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className={`text-[10px] font-medium uppercase tracking-wider ${
              isQuiz ? "text-orange-700" : "text-violet-700"
            }`}
          >
            {typeLabel}
          </span>
          <span className="text-[10px] text-muted-foreground">·</span>
          <span className="text-[10px] text-muted-foreground">{position}</span>
        </div>
        <p className="text-xs text-foreground line-clamp-2 leading-snug">
          {title || t`(empty)`}
        </p>
      </div>
    </button>
  )
}

function extractActivityPreview(html: string): string {
  const stripped = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return stripped.slice(0, 140)
}
