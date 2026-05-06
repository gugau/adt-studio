import { ExternalLink, PenLine, Puzzle, Sparkles } from "lucide-react"
import { useLingui, Trans } from "@lingui/react/macro"
import { i18n } from "@lingui/core"
import type { Activity } from "@/api/client"
import { ACTIVITY_TEMPLATE_LABELS } from "./activity-helpers"
import { cn } from "@/lib/utils"

/**
 * One row in the Activities list. Two modes:
 *   - kind="templated"  → editable; clicking opens the editor.
 *   - kind="ai-laid-out"→ read-only inventory; clicking jumps to the storyboard
 *     section that owns the activity. There's no in-stage editor for these.
 */
export type ActivityListEntry =
  | {
      kind: "templated"
      activity: Activity
    }
  | {
      kind: "ai-laid-out"
      pageId: string
      sectionIndex: number
      sectionType: string
      preview: string
    }

export function ActivityListItem({
  entry,
  onOpen,
  onJumpToStoryboard,
}: {
  entry: ActivityListEntry
  onOpen: (activityId: string) => void
  onJumpToStoryboard: (pageId: string, sectionIndex: number) => void
}) {
  const { t } = useLingui()

  if (entry.kind === "ai-laid-out") {
    return (
      <button
        type="button"
        onClick={() => onJumpToStoryboard(entry.pageId, entry.sectionIndex)}
        className="group w-full text-left rounded-md border border-border bg-card hover:border-orange-300 transition-colors px-3 py-2.5"
      >
        <div className="flex items-center gap-2">
          <ChipIcon kind="ai" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-orange-800">
              <Trans>AI layout · Storyboard</Trans>
              <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                {entry.pageId}
                {" · "}
                {entry.sectionType}
              </span>
            </div>
            <div className="text-xs text-muted-foreground truncate mt-0.5">
              {entry.preview || t`(no preview)`}
            </div>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-orange-600 transition-colors" />
        </div>
      </button>
    )
  }

  const a = entry.activity
  const templateLabel = i18n._(ACTIVITY_TEMPLATE_LABELS[a.templateType])
  const preview = activityPreview(a)

  return (
    <button
      type="button"
      onClick={() => onOpen(a.activityId)}
      className="group w-full text-left rounded-md border border-border bg-card hover:border-orange-400 transition-colors px-3 py-2.5"
    >
      <div className="flex items-center gap-2">
        <ChipIcon kind="templated" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-orange-800">
              <Trans>Template · {templateLabel}</Trans>
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {a.activityId}
              {a.afterPageId && (
                <>
                  {" · "}
                  <Trans>after {a.afterPageId}</Trans>
                </>
              )}
            </span>
          </div>
          <div className={cn("text-xs truncate mt-0.5", preview ? "text-foreground" : "italic text-muted-foreground")}>
            {preview || t`(empty)`}
          </div>
        </div>
        <PenLine className="w-3.5 h-3.5 text-muted-foreground group-hover:text-orange-600 transition-colors" />
      </div>
    </button>
  )
}

function ChipIcon({ kind }: { kind: "templated" | "ai" }) {
  return (
    <div
      className={cn(
        "shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-white",
        kind === "ai" ? "bg-orange-400" : "bg-orange-600",
      )}
    >
      {kind === "ai" ? <Sparkles className="w-3.5 h-3.5" /> : <Puzzle className="w-3.5 h-3.5" />}
    </div>
  )
}

function activityPreview(a: Activity): string {
  switch (a.templateType) {
    case "multiple_choice":
      return a.question
    case "true_false":
      return a.prompt || a.statements[0]?.text || ""
    case "fill_in_the_blank":
      return a.prompt || a.sentences[0]?.text || ""
  }
}
