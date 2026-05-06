import { CheckCircle2, XCircle, Plus, Trash2 } from "lucide-react"
import { useLingui, Trans } from "@lingui/react/macro"
import type { MultipleChoiceActivity } from "@/api/client"
import { cn } from "@/lib/utils"

export function MultipleChoiceEditor({
  activity,
  onChange,
}: {
  activity: MultipleChoiceActivity
  onChange: (next: MultipleChoiceActivity) => void
}) {
  const { t } = useLingui()

  const setQuestion = (question: string) => onChange({ ...activity, question })
  const setOption = (i: number, patch: Partial<{ text: string; explanation: string }>) =>
    onChange({
      ...activity,
      options: activity.options.map((o, j) => (i === j ? { ...o, ...patch } : o)),
    })
  const setAnswer = (i: number) => onChange({ ...activity, answerIndex: i })
  const addOption = () => {
    if (activity.options.length >= 6) return
    onChange({
      ...activity,
      options: [...activity.options, { text: "", explanation: "" }],
    })
  }
  const removeOption = (i: number) => {
    if (activity.options.length <= 2) return
    const nextOptions = activity.options.filter((_, j) => j !== i)
    const nextAnswer =
      activity.answerIndex === i
        ? 0
        : activity.answerIndex > i
          ? activity.answerIndex - 1
          : activity.answerIndex
    onChange({ ...activity, options: nextOptions, answerIndex: nextAnswer })
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">
          <Trans>Question</Trans>
        </span>
        <textarea
          value={activity.question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          placeholder={t`What does the page tell us about…?`}
          className="mt-1 w-full text-sm rounded border border-border bg-background p-2 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            <Trans>Options · click circle to mark correct</Trans>
          </span>
          <button
            type="button"
            onClick={addOption}
            disabled={activity.options.length >= 6}
            className="inline-flex items-center gap-1 text-[11px] rounded px-2 py-1 border border-border bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="h-3 w-3" />
            <Trans>Add option</Trans>
          </button>
        </div>
        {activity.options.map((opt, i) => {
          const isCorrect = i === activity.answerIndex
          return (
            <div
              key={i}
              className={cn(
                "flex items-start gap-2 rounded-md border p-2 transition-colors",
                isCorrect
                  ? "bg-emerald-50 border-emerald-300"
                  : "bg-muted/30 border-border",
              )}
            >
              <button
                type="button"
                onClick={() => setAnswer(i)}
                aria-label={t`Mark option ${i + 1} as correct`}
                className="mt-1.5 shrink-0"
              >
                {isCorrect ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-muted-foreground/40 hover:text-muted-foreground transition-colors" />
                )}
              </button>
              <div className="flex-1 min-w-0 space-y-1">
                <textarea
                  value={opt.text}
                  onChange={(e) => setOption(i, { text: e.target.value })}
                  rows={1}
                  placeholder={t`Option ${i + 1}`}
                  className="w-full text-sm rounded border border-transparent bg-transparent p-1 -m-1 hover:border-border focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                />
                <textarea
                  value={opt.explanation}
                  onChange={(e) => setOption(i, { explanation: e.target.value })}
                  rows={1}
                  placeholder={t`Explanation (shown after the learner picks this option)`}
                  className="w-full text-xs opacity-70 rounded border border-transparent bg-transparent p-1 -m-1 hover:border-border focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring focus:opacity-100 transition-colors"
                />
              </div>
              <button
                type="button"
                onClick={() => removeOption(i)}
                disabled={activity.options.length <= 2}
                aria-label={t`Remove option ${i + 1}`}
                className="shrink-0 mt-1.5 text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
