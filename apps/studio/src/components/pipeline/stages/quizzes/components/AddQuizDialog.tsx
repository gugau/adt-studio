import { useState } from "react"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { Trans, useLingui } from "@lingui/react/macro"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { api } from "@/api/client"
import type { QuizOption } from "@/api/client"
import { usePages } from "@/hooks/use-pages"
import { PageThumb } from "./PageThumb"

interface AddQuizDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookLabel: string
  onCreated?: (quizIndex: number) => void
}

const emptyOption: QuizOption = { text: "", explanation: "" }

export function AddQuizDialog({
  open,
  onOpenChange,
  bookLabel,
  onCreated,
}: AddQuizDialogProps) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const { data: pages } = usePages(bookLabel)

  const [afterPageId, setAfterPageId] = useState<string | null>(null)
  const [question, setQuestion] = useState("")
  const [options, setOptions] = useState<QuizOption[]>([
    { ...emptyOption },
    { ...emptyOption },
    { ...emptyOption },
  ])
  const [answerIndex, setAnswerIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setAfterPageId(null)
    setQuestion("")
    setOptions([{ ...emptyOption }, { ...emptyOption }, { ...emptyOption }])
    setAnswerIndex(0)
    setError(null)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const canSubmit =
    !!afterPageId &&
    question.trim().length > 0 &&
    options.every((o) => o.text.trim().length > 0) &&
    !submitting

  const handleSubmit = async () => {
    if (!canSubmit || !afterPageId) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await api.addQuiz(bookLabel, {
        afterPageId,
        pageIds: [afterPageId],
        quizType: "multiple-choice",
        question: question.trim(),
        options: options.map((o, i) => ({
          text: o.text.trim().startsWith(`${i + 1})`)
            ? o.text.trim()
            : `${i + 1}) ${o.text.trim()}`,
          explanation: o.explanation.trim(),
        })),
        answerIndex,
        reasoning: "",
      })
      await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "quizzes"] })
      await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "activities"] })
      onCreated?.(result.quizIndex)
      handleOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            <Trans>Add quiz</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Choose where the quiz appears and write its content.</Trans>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 py-1">
          <section>
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
              <Trans>Place after page</Trans>
            </div>
            <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto pr-1">
              {(pages ?? []).map((page) => (
                <PageThumb
                  key={page.pageId}
                  bookLabel={bookLabel}
                  pageId={page.pageId}
                  selected={afterPageId === page.pageId}
                  height="sm"
                  onClick={() => setAfterPageId(page.pageId)}
                />
              ))}
            </div>
            {afterPageId && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                <Trans>Quiz will appear after {afterPageId}.</Trans>
              </p>
            )}
          </section>

          <section>
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
              <Trans>Quiz type</Trans>
            </div>
            <div className="inline-flex rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs">
              <Trans>Multiple choice (3 options)</Trans>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block">
                <Trans>Question</Trans>
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={t`What does the learner need to figure out?`}
                rows={2}
                className="w-full text-sm rounded-md border bg-background px-3 py-2 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
              />
            </div>

            <div>
              <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block">
                <Trans>Options</Trans>
              </label>
              <div className="space-y-2">
                {options.map((option, i) => {
                  const isCorrect = i === answerIndex
                  return (
                    <div
                      key={i}
                      className={`rounded-md border p-2 ${
                        isCorrect
                          ? "border-emerald-300 bg-emerald-50/60"
                          : "border-border bg-muted/20"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => setAnswerIndex(i)}
                          aria-label={t`Mark option ${i + 1} as correct`}
                          className={`mt-1.5 shrink-0 transition-colors ${
                            isCorrect
                              ? "text-emerald-600"
                              : "text-muted-foreground/40 hover:text-emerald-500"
                          }`}
                        >
                          {isCorrect ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0 space-y-1">
                          <input
                            type="text"
                            value={option.text}
                            onChange={(e) =>
                              setOptions((prev) =>
                                prev.map((o, j) =>
                                  j === i ? { ...o, text: e.target.value } : o,
                                ),
                              )
                            }
                            placeholder={t`Option ${i + 1}`}
                            className="w-full text-sm rounded border bg-white px-2 py-1 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                          />
                          <input
                            type="text"
                            value={option.explanation}
                            onChange={(e) =>
                              setOptions((prev) =>
                                prev.map((o, j) =>
                                  j === i ? { ...o, explanation: e.target.value } : o,
                                ),
                              )
                            }
                            placeholder={t`Explanation shown to the learner`}
                            className="w-full text-xs rounded border bg-white px-2 py-1 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {error && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="text-xs px-3 py-1.5 rounded-md hover:bg-accent transition-colors cursor-pointer"
          >
            <Trans>Cancel</Trans>
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="inline-flex items-center gap-1.5 text-xs font-medium rounded-md bg-orange-600 text-white px-3 py-1.5 hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <Trans>Create quiz</Trans>
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
