import { useMemo, useState } from "react"
import { Link, useNavigate, useSearch } from "@tanstack/react-router"
import { ChevronDown, HelpCircle, Loader2, Plus, Puzzle } from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import { cn } from "@/lib/utils"
import type { ActivityItem } from "@/api/client"
import { usePageImage } from "@/hooks/use-pages"
import { getSectionTypeLabel } from "@/lib/section-constants"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useActivities } from "../hooks/use-activities"
import { AddQuizDialog } from "./AddQuizDialog"
import { AddActivityDialog } from "./AddActivityDialog"

export function activityItemKey(item: ActivityItem): string {
  return item.kind === "quiz"
    ? `quiz:${item.quizIndex}`
    : `activity:${item.pageId}:${item.sectionIndex}`
}

interface ActivitiesIndexProps {
  bookLabel: string
}

export function ActivitiesIndex({ bookLabel }: ActivitiesIndexProps) {
  const { data, isLoading } = useActivities(bookLabel)
  const search = useSearch({ strict: false }) as { activity?: string }
  const navigate = useNavigate()
  const activeKey = search.activity ?? null
  const items = useMemo(() => data?.items ?? [], [data])
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [addQuizOpen, setAddQuizOpen] = useState(false)
  const [addActivityOpen, setAddActivityOpen] = useState(false)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Trans>Activities</Trans>
        </span>
        <Popover open={addMenuOpen} onOpenChange={setAddMenuOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[10px] font-medium rounded px-1.5 py-0.5 bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              <Trans>Add</Trans>
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={4} className="w-52 p-1">
            <button
              type="button"
              onClick={() => {
                setAddMenuOpen(false)
                setAddQuizOpen(true)
              }}
              className="w-full flex items-start gap-2 rounded px-2 py-1.5 hover:bg-muted text-left transition-colors cursor-pointer"
            >
              <HelpCircle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-foreground">
                  <Trans>Quiz</Trans>
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  <Trans>Standalone comprehension question after a page.</Trans>
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setAddMenuOpen(false)
                setAddActivityOpen(true)
              }}
              className="w-full flex items-start gap-2 rounded px-2 py-1.5 hover:bg-muted text-left transition-colors cursor-pointer"
            >
              <Puzzle className="h-4 w-4 text-violet-600 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-foreground">
                  <Trans>Activity</Trans>
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  <Trans>
                    Interactive activity generated from selected context pages.
                  </Trans>
                </p>
              </div>
            </button>
          </PopoverContent>
        </Popover>
      </div>

      <AddQuizDialog
        open={addQuizOpen}
        onOpenChange={setAddQuizOpen}
        bookLabel={bookLabel}
        onCreated={(quizIndex) =>
          navigate({
            to: "/books/$label/$step",
            params: { label: bookLabel, step: "quizzes" },
            search: { activity: `quiz:${quizIndex}` },
          })
        }
      />

      <AddActivityDialog
        open={addActivityOpen}
        onOpenChange={setAddActivityOpen}
        bookLabel={bookLabel}
        onCreated={(pageId, sectionIndex) =>
          navigate({
            to: "/books/$label/$step",
            params: { label: bookLabel, step: "quizzes" },
            search: { activity: `activity:${pageId}:${sectionIndex}` },
          })
        }
      />

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            <Trans>No activities yet</Trans>
          </div>
        ) : (
          items.map((item) => (
            <ActivityRow
              key={activityItemKey(item)}
              bookLabel={bookLabel}
              item={item}
              isActive={activeKey === activityItemKey(item)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function ActivityRow({
  bookLabel,
  item,
  isActive,
}: {
  bookLabel: string
  item: ActivityItem
  isActive: boolean
}) {
  const { t } = useLingui()
  const isQuiz = item.kind === "quiz"
  const previewPageId = isQuiz ? item.pageIds[0] ?? item.afterPageId : item.pageId
  const { data: imageData } = usePageImage(bookLabel, previewPageId, {
    enabled: !!previewPageId,
  })
  const imgSrc = imageData?.imageBase64
    ? `data:image/png;base64,${imageData.imageBase64}`
    : null
  const Icon = isQuiz ? HelpCircle : Puzzle

  const typeLabel = isQuiz
    ? t`Quiz`
    : getSectionTypeLabel(item.sectionType).replace(/^Activity:\s*/i, "")
  const positionLabel = isQuiz
    ? t`After ${item.afterPageId}`
    : t`On ${item.pageId}`
  const title = isQuiz
    ? item.quiz.question
    : extractActivityPreview(item.html)

  return (
    <Link
      to="/books/$label/$step"
      params={{ label: bookLabel, step: "quizzes" }}
      search={{ activity: activityItemKey(item) }}
      className={cn(
        "flex items-start gap-2 px-2 py-1.5 text-left transition-colors w-full border-l-2",
        isActive
          ? "bg-orange-50 border-l-orange-500 text-foreground"
          : "border-l-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      <div className="relative shrink-0 w-16 h-12">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt=""
            className="w-full h-full rounded object-cover object-center ring-1 ring-border"
          />
        ) : (
          <div className="w-full h-full bg-muted rounded ring-1 ring-border" />
        )}
        <div
          className={cn(
            "absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-background",
            isQuiz ? "bg-orange-500 text-white" : "bg-violet-500 text-white",
          )}
        >
          <Icon className="h-3 w-3" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[10px] min-w-0">
          <span
            className={cn(
              "font-medium uppercase tracking-wider truncate",
              isQuiz ? "text-orange-700" : "text-violet-700",
            )}
            title={typeLabel}
          >
            {typeLabel}
          </span>
          <span className="text-muted-foreground shrink-0">·</span>
          <span className="text-muted-foreground shrink-0">{positionLabel}</span>
        </div>
        <p className="text-xs line-clamp-2 mt-0.5 leading-snug">
          {title || t`(empty)`}
        </p>
      </div>
    </Link>
  )
}

function extractActivityPreview(html: string): string {
  const stripped = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return stripped.slice(0, 120)
}
