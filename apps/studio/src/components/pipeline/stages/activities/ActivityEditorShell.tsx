import { useEffect, useState } from "react"
import { Check, X, Trash2, Puzzle } from "lucide-react"
import { useLingui, Trans } from "@lingui/react/macro"
import { i18n } from "@lingui/core"
import type { Activity } from "@/api/client"
import { ACTIVITY_TEMPLATE_LABELS } from "./activity-helpers"
import { MultipleChoiceEditor } from "./MultipleChoiceEditor"
import { TrueFalseEditor } from "./TrueFalseEditor"
import { FillInTheBlankEditor } from "./FillInTheBlankEditor"

/**
 * Shared chrome for editing one templated activity. The shell owns dirty
 * state, save/discard buttons, and dispatch to the per-template body.
 */
export function ActivityEditorShell({
  activity,
  saving,
  onSave,
  onDelete,
  onClose,
}: {
  activity: Activity
  saving: boolean
  onSave: (next: Activity) => void
  onDelete: () => void
  onClose: () => void
}) {
  const { t } = useLingui()
  const [draft, setDraft] = useState<Activity>(activity)

  // Reset draft if a new activity is loaded into the same shell.
  useEffect(() => {
    setDraft(activity)
  }, [activity])

  const dirty = JSON.stringify(draft) !== JSON.stringify(activity)
  const templateLabel = i18n._(ACTIVITY_TEMPLATE_LABELS[activity.templateType])

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b bg-background">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-orange-600 text-white">
          <Puzzle className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-orange-700">{templateLabel}</div>
          <div className="text-[11px] text-muted-foreground font-mono truncate">
            {activity.activityId}
            {activity.afterPageId && (
              <>
                {" · "}
                <Trans>after {activity.afterPageId}</Trans>
              </>
            )}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={onDelete}
            aria-label={t`Delete activity`}
            className="inline-flex items-center gap-1 text-xs rounded px-2 py-1 border border-border text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            <Trans>Delete</Trans>
          </button>
          {dirty && (
            <button
              type="button"
              onClick={() => setDraft(activity)}
              disabled={saving}
              className="inline-flex items-center gap-1 text-xs rounded px-2 py-1 border border-border bg-background hover:bg-muted transition-colors"
            >
              <X className="w-3 h-3" />
              <Trans>Discard</Trans>
            </button>
          )}
          <button
            type="button"
            onClick={() => onSave(draft)}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1 text-xs font-medium rounded px-2 py-1 bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Check className="w-3 h-3" />
            {saving ? <Trans>Saving…</Trans> : <Trans>Save</Trans>}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t`Close editor`}
            className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {draft.templateType === "multiple_choice" && (
          <MultipleChoiceEditor activity={draft} onChange={setDraft} />
        )}
        {draft.templateType === "true_false" && (
          <TrueFalseEditor activity={draft} onChange={setDraft} />
        )}
        {draft.templateType === "fill_in_the_blank" && (
          <FillInTheBlankEditor activity={draft} onChange={setDraft} />
        )}
      </div>
    </div>
  )
}
