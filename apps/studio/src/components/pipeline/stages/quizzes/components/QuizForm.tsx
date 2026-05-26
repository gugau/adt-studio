import { CheckCircle2, XCircle } from "lucide-react"
import { useLingui } from "@lingui/react/macro"
import type { QuizItem } from "@/api/client"
import { PageThumb } from "./PageThumb"

interface QuizFormProps {
  bookLabel: string
  quiz: QuizItem
  disabled?: boolean
  onChange: (next: QuizItem) => void
  onOpenPage?: (pageId: string) => void
}

export function QuizForm({
  bookLabel,
  quiz,
  disabled,
  onChange,
  onOpenPage,
}: QuizFormProps) {
  const { t } = useLingui()

  const updateQuestion = (question: string) => onChange({ ...quiz, question })
  const updateAnswer = (answerIndex: number) => onChange({ ...quiz, answerIndex })
  const updateOptionText = (i: number, text: string) =>
    onChange({
      ...quiz,
      options: quiz.options.map((o, j) => (j === i ? { ...o, text } : o)),
    })
  const updateOptionExplanation = (i: number, explanation: string) =>
    onChange({
      ...quiz,
      options: quiz.options.map((o, j) => (j === i ? { ...o, explanation } : o)),
    })

  return (
    <div className="space-y-4">
      {quiz.pageIds.length > 0 && (
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
            {t`Source pages`}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {quiz.pageIds.map((pageId) => (
              <PageThumb
                key={pageId}
                bookLabel={bookLabel}
                pageId={pageId}
                height="sm"
                onClick={onOpenPage ? () => onOpenPage(pageId) : undefined}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block">
          {t`Question`}
        </label>
        <textarea
          value={quiz.question}
          disabled={disabled}
          onChange={(e) => updateQuestion(e.target.value)}
          rows={2}
          className="w-full text-sm rounded-md border bg-background px-3 py-2 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors disabled:opacity-50"
        />
      </div>

      <div>
        <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block">
          {t`Options`}
        </label>
        <div className="space-y-2">
          {quiz.options.map((option, i) => {
            const isCorrect = i === quiz.answerIndex
            return (
              <div
                key={i}
                className={`rounded-md border p-2 ${
                  isCorrect
                    ? "border-emerald-300 bg-emerald-50/60"
                    : "border-border bg-muted/30"
                }`}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => updateAnswer(i)}
                    aria-label={t`Mark option ${i + 1} as correct`}
                    className={`mt-1.5 shrink-0 transition-colors ${
                      isCorrect ? "text-emerald-600" : "text-muted-foreground/40 hover:text-emerald-500"
                    }`}
                  >
                    {isCorrect ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0 space-y-1">
                    <textarea
                      value={option.text}
                      disabled={disabled}
                      onChange={(e) => updateOptionText(i, e.target.value)}
                      rows={1}
                      placeholder={t`Option text`}
                      className="w-full text-sm rounded border border-transparent bg-transparent px-1.5 py-1 hover:border-border hover:bg-white focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors disabled:opacity-50"
                    />
                    <textarea
                      value={option.explanation}
                      disabled={disabled}
                      onChange={(e) => updateOptionExplanation(i, e.target.value)}
                      rows={1}
                      placeholder={t`Explanation shown to the learner`}
                      className="w-full text-xs opacity-80 rounded border border-transparent bg-transparent px-1.5 py-1 hover:border-border hover:bg-white focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring focus:opacity-100 transition-colors disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {quiz.reasoning && (
        <p className="text-xs italic text-muted-foreground border-l-2 border-orange-200 pl-3">
          {quiz.reasoning}
        </p>
      )}
    </div>
  )
}
