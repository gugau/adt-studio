import { Plus, Trash2, Info } from "lucide-react"
import { useLingui, Trans } from "@lingui/react/macro"
import type { FillInTheBlankActivity, FillInTheBlankSentenceItem } from "@/api/client"

export function FillInTheBlankEditor({
  activity,
  onChange,
}: {
  activity: FillInTheBlankActivity
  onChange: (next: FillInTheBlankActivity) => void
}) {
  const { t } = useLingui()

  const setPrompt = (prompt: string) => onChange({ ...activity, prompt })
  const setSentence = (i: number, patch: Partial<FillInTheBlankSentenceItem>) =>
    onChange({
      ...activity,
      sentences: activity.sentences.map((s, j) => (i === j ? { ...s, ...patch } : s)),
    })
  const addSentence = () =>
    onChange({ ...activity, sentences: [...activity.sentences, { text: "", hint: "" }] })
  const removeSentence = (i: number) => {
    if (activity.sentences.length <= 1) return
    onChange({ ...activity, sentences: activity.sentences.filter((_, j) => j !== i) })
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
          placeholder={t`Fill in the missing word in each sentence.`}
          className="mt-1 w-full text-sm rounded border border-border bg-background p-2 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </label>

      <div className="rounded-md border border-orange-200 bg-orange-50/50 px-3 py-2 text-[11px] text-orange-900 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          <Trans>
            Wrap each blank in square brackets — alternate spellings can be separated with `|`.
            Example: <code>The capital is [Paris|paris].</code>
          </Trans>
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            <Trans>Sentences</Trans>
          </span>
          <button
            type="button"
            onClick={addSentence}
            className="inline-flex items-center gap-1 text-[11px] rounded px-2 py-1 border border-border bg-background hover:bg-muted transition-colors"
          >
            <Plus className="h-3 w-3" />
            <Trans>Add sentence</Trans>
          </button>
        </div>
        {activity.sentences.map((s, i) => (
          <div key={i} className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-2">
            <div className="flex-1 min-w-0 space-y-1">
              <textarea
                value={s.text}
                onChange={(e) => setSentence(i, { text: e.target.value })}
                rows={2}
                placeholder={t`Sentence with [answers] in brackets`}
                className="w-full text-sm font-mono rounded border border-transparent bg-transparent p-1 -m-1 hover:border-border focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
              />
              <input
                type="text"
                value={s.hint}
                onChange={(e) => setSentence(i, { hint: e.target.value })}
                placeholder={t`Hint (optional)`}
                className="w-full text-xs opacity-70 rounded border border-transparent bg-transparent p-1 -m-1 hover:border-border focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring focus:opacity-100 transition-colors"
              />
            </div>
            <button
              type="button"
              onClick={() => removeSentence(i)}
              disabled={activity.sentences.length <= 1}
              aria-label={t`Remove sentence ${i + 1}`}
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
