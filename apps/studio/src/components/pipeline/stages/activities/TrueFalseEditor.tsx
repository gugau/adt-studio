import { Plus, Trash2 } from "lucide-react"
import { useLingui, Trans } from "@lingui/react/macro"
import type { TrueFalseActivity, TrueFalseStatementItem } from "@/api/client"
import { cn } from "@/lib/utils"

export function TrueFalseEditor({
  activity,
  onChange,
}: {
  activity: TrueFalseActivity
  onChange: (next: TrueFalseActivity) => void
}) {
  const { t } = useLingui()

  const setPrompt = (prompt: string) => onChange({ ...activity, prompt })
  const setStatement = (i: number, patch: Partial<TrueFalseStatementItem>) =>
    onChange({
      ...activity,
      statements: activity.statements.map((s, j) => (i === j ? { ...s, ...patch } : s)),
    })
  const addStatement = () =>
    onChange({
      ...activity,
      statements: [...activity.statements, { text: "", isTrue: true, explanation: "" }],
    })
  const removeStatement = (i: number) => {
    if (activity.statements.length <= 1) return
    onChange({ ...activity, statements: activity.statements.filter((_, j) => j !== i) })
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">
          <Trans>Prompt (optional)</Trans>
        </span>
        <textarea
          value={activity.prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={1}
          placeholder={t`Decide whether each statement is true or false.`}
          className="mt-1 w-full text-sm rounded border border-border bg-background p-2 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            <Trans>Statements</Trans>
          </span>
          <button
            type="button"
            onClick={addStatement}
            className="inline-flex items-center gap-1 text-[11px] rounded px-2 py-1 border border-border bg-background hover:bg-muted transition-colors"
          >
            <Plus className="h-3 w-3" />
            <Trans>Add statement</Trans>
          </button>
        </div>
        {activity.statements.map((s, i) => (
          <div key={i} className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-2">
            <div className="shrink-0 inline-flex rounded border border-border overflow-hidden mt-1">
              <button
                type="button"
                onClick={() => setStatement(i, { isTrue: true })}
                className={cn(
                  "px-2 py-0.5 text-[11px] transition-colors",
                  s.isTrue ? "bg-emerald-600 text-white" : "bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                <Trans>True</Trans>
              </button>
              <button
                type="button"
                onClick={() => setStatement(i, { isTrue: false })}
                className={cn(
                  "px-2 py-0.5 text-[11px] transition-colors",
                  !s.isTrue ? "bg-rose-600 text-white" : "bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                <Trans>False</Trans>
              </button>
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <textarea
                value={s.text}
                onChange={(e) => setStatement(i, { text: e.target.value })}
                rows={1}
                placeholder={t`Statement ${i + 1}`}
                className="w-full text-sm rounded border border-transparent bg-transparent p-1 -m-1 hover:border-border focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
              />
              <textarea
                value={s.explanation}
                onChange={(e) => setStatement(i, { explanation: e.target.value })}
                rows={1}
                placeholder={t`Explanation (shown after the learner answers)`}
                className="w-full text-xs opacity-70 rounded border border-transparent bg-transparent p-1 -m-1 hover:border-border focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring focus:opacity-100 transition-colors"
              />
            </div>
            <button
              type="button"
              onClick={() => removeStatement(i)}
              disabled={activity.statements.length <= 1}
              aria-label={t`Remove statement ${i + 1}`}
              className="shrink-0 mt-1.5 text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
