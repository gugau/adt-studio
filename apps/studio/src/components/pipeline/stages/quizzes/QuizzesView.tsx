import { useState, useEffect, useRef, useCallback } from "react"
import { Check, CheckCircle2, XCircle, ChevronDown, HelpCircle, Loader2, ImageOff, Eye, Scissors, Trash2 } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { api } from "@/api/client"
import type {
  QuizActivityType,
  QuizGenerationOutput,
  QuizItem,
  QuizQuestion,
  StageRunProviderCredentials,
  VersionEntry,
} from "@/api/client"
import { useQuizzes } from "@/hooks/use-quizzes"
import { usePageImage } from "@/hooks/use-pages"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useStepHeader } from "../../components/StepViewRouter"
import { useApiKey } from "@/hooks/use-api-key"
import { getRequestedPageId, getQuizImageRenderState } from "./lib/quizzes-image-state"
import { QuizzesLandingConfig } from "./components/QuizzesLandingConfig"
import { useLingui } from "@lingui/react/macro"


type QuizData = QuizGenerationOutput

function getQuizQuestions(quiz: QuizItem): QuizQuestion[] {
  if (quiz.questions && quiz.questions.length > 0) return quiz.questions
  return [{
    activityType: quiz.activityType ?? "multiple_choice",
    question: quiz.question,
    options: quiz.options,
    answerIndex: quiz.answerIndex,
    statements: quiz.statements,
    blanks: quiz.blanks,
    pairs: quiz.pairs,
    reasoning: quiz.reasoning,
  }]
}

function syncQuizFromQuestions(quiz: QuizItem, questions: QuizQuestion[]): QuizItem {
  const first = questions[0] ?? getQuizQuestions(quiz)[0]
  return {
    ...quiz,
    activityType: first.activityType,
    question: first.question,
    options: first.options,
    answerIndex: first.answerIndex,
    statements: first.statements,
    blanks: first.blanks,
    pairs: first.pairs,
    reasoning: first.reasoning,
    questions,
  }
}

function getSharedQuestionTitle(questions: QuizQuestion[]): string | null {
  if (questions.length === 0) return null
  const first = questions[0].question.trim()
  if (!first) return null
  return questions.every((q) => q.question.trim() === first) ? first : null
}

function pad3(n: number): string {
  return String(n).padStart(3, "0")
}

function activityBadgeClass(activityType: QuizActivityType): string {
  switch (activityType) {
    case "true_false":
      return "bg-blue-50 text-blue-700 border-blue-200"
    case "fill_in_the_blank":
      return "bg-emerald-50 text-emerald-700 border-emerald-200"
    case "drag_and_drop":
      return "bg-sky-50 text-sky-700 border-sky-200"
    case "multiple_choice":
    default:
      return "bg-orange-50 text-orange-700 border-orange-200"
  }
}

function VersionPicker({
  currentVersion,
  saving,
  dirty,
  bookLabel,
  onPreview,
  onSave,
  onDiscard,
}: {
  currentVersion: number | null
  saving: boolean
  dirty: boolean
  bookLabel: string
  onPreview: (data: unknown) => void
  onSave: () => void
  onDiscard: () => void
}) {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  const [versions, setVersions] = useState<VersionEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const handleOpen = async () => {
    if (saving || currentVersion == null) return
    setOpen(true)
    setLoading(true)
    const res = await api.getVersionHistory(bookLabel, "quiz-generation", "book", true)
    setVersions(res.versions)
    setLoading(false)
  }

  const handlePick = (v: VersionEntry) => {
    if (v.version === currentVersion && !dirty) {
      setOpen(false)
      return
    }
    setOpen(false)
    onPreview(v.data)
  }

  if (saving) {
    return <Loader2 className="h-3 w-3 animate-spin" />
  }

  if (currentVersion == null) return null

  if (dirty) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onDiscard}
          className="text-[10px] font-medium rounded px-2 py-0.5 bg-black/15 text-black hover:bg-black/25 cursor-pointer transition-colors"
        >
          {t`Discard`}
        </button>
        <button
          type="button"
          onClick={onSave}
          className="flex items-center gap-1 text-[10px] font-medium rounded px-2 py-0.5 bg-white text-orange-800 hover:bg-white/80 cursor-pointer transition-colors"
        >
          <Check className="h-3 w-3" />
          {t`Save`}
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-0.5 text-[10px] font-normal normal-case tracking-normal bg-white/20 text-white hover:bg-white/30 rounded px-1.5 py-0.5 transition-colors"
      >
        v{currentVersion}
        <ChevronDown className="h-2.5 w-2.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-popover border rounded shadow-md min-w-[80px] py-1">
          {loading ? (
            <div className="flex items-center justify-center py-2 px-3">
              <Loader2 className="h-3 w-3 animate-spin" />
            </div>
          ) : versions && versions.length > 0 ? (
            versions.map((v) => (
              <button
                key={v.version}
                type="button"
                onClick={() => handlePick(v)}
                className={`w-full text-left px-3 py-1 text-xs hover:bg-accent transition-colors ${
                  v.version === currentVersion ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                v{v.version}
              </button>
            ))
          ) : (
            <div className="px-3 py-1 text-xs text-muted-foreground">{t`No versions`}</div>
          )}
        </div>
      )}
    </div>
  )
}

function PageThumb({
  bookLabel,
  pageId,
  onClick,
}: {
  bookLabel: string
  pageId: string
  onClick: () => void
}) {
  const { t } = useLingui()
  const [requestImage, setRequestImage] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (requestImage) return
    if (typeof IntersectionObserver === "undefined") {
      setRequestImage(true)
      return
    }
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRequestImage(true)
          observer.disconnect()
        }
      },
      { rootMargin: "200px" }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [requestImage])

  const { data: imageData, isLoading, isError } = usePageImage(
    bookLabel,
    getRequestedPageId(pageId, requestImage)
  )
  const imageState = getQuizImageRenderState({
    isRequested: requestImage,
    isLoading,
    isError,
    hasImage: !!imageData,
  })

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onMouseEnter={() => setRequestImage(true)}
      onFocus={() => setRequestImage(true)}
      aria-label={t`Open page preview for ${pageId}`}
      className="shrink-0 rounded border border-border bg-muted/40 overflow-hidden hover:ring-2 hover:ring-ring transition-shadow cursor-pointer"
    >
      {imageState === "ready" ? (
        <img
          src={`data:image/png;base64,${imageData!.imageBase64}`}
          alt={t`Page ${pageId}`}
          loading="lazy"
          className="h-44 w-auto block"
        />
      ) : imageState === "error" ? (
        <div className="h-44 w-32 flex flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground">
          <ImageOff className="h-4 w-4" />
          <span>{t`No image`}</span>
        </div>
      ) : (
        <div className="h-44 w-32 flex items-center justify-center px-2 text-[10px] text-muted-foreground">
          {t`Page ${pageId}`}
        </div>
      )}
    </button>
  )
}

function PageLightbox({
  bookLabel,
  pageId,
  open,
  onOpenChange,
}: {
  bookLabel: string
  pageId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useLingui()
  const isRequested = open && !!pageId
  const queryPageId = getRequestedPageId(pageId ?? "", isRequested)
  const { data: imageData, isLoading, isError, refetch } = usePageImage(bookLabel, queryPageId)
  const imageState = getQuizImageRenderState({
    isRequested,
    isLoading,
    isError,
    hasImage: !!imageData,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {pageId && (
        <DialogContent className="w-auto max-w-[95vw] overflow-hidden gap-2 p-2 sm:max-w-[90vw] bg-white">
          <DialogTitle className="sr-only">{t`Page preview ${pageId}`}</DialogTitle>
          <DialogDescription className="sr-only">
            {t`Full-size source page preview for the selected quiz.`}
          </DialogDescription>
          <div className="flex max-h-[90vh] max-w-[90vw] items-center justify-center overflow-hidden rounded-md bg-muted/20">
            {imageState === "ready" ? (
              <img
                src={`data:image/png;base64,${imageData!.imageBase64}`}
                alt={t`Page ${pageId}`}
                className="max-h-[90vh] max-w-[90vw] object-contain"
              />
            ) : imageState === "error" ? (
              <div className="flex h-64 w-52 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <ImageOff className="h-5 w-5" />
                <span>{t`Image unavailable`}</span>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="rounded border px-2 py-0.5 text-xs hover:bg-muted transition-colors cursor-pointer"
                >
                  {t`Retry`}
                </button>
              </div>
            ) : (
              <div className="flex h-64 w-52 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t`Loading image...`}</span>
              </div>
            )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}

export function QuizzesView({ bookLabel, selectedPageId }: { bookLabel: string; selectedPageId?: string }) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuizzes(bookLabel)
  const { setExtra } = useStepHeader()
  const {
    apiKey,
    hasApiKey,
    anthropicKey,
    googleKey,
    customBaseUrl,
    customApiKey,
    azureKey,
    azureRegion,
    geminiKey,
  } = useApiKey()
  const providerCredentials: StageRunProviderCredentials = {
    anthropicApiKey: anthropicKey || undefined,
    googleApiKey: googleKey || undefined,
    customBaseUrl: customBaseUrl || undefined,
    customApiKey: customApiKey || undefined,
    azure: { key: azureKey, region: azureRegion },
    geminiApiKey: geminiKey || undefined,
  }

  const getActivityLabel = (activityType: QuizActivityType) => {
    switch (activityType) {
      case "true_false":
        return t`True/False`
      case "fill_in_the_blank":
        return t`Fill in the blanks`
      case "drag_and_drop":
        return t`Drag & Drop`
      case "multiple_choice":
      default:
        return t`Multiple choice`
    }
  }

  const [pending, setPending] = useState<QuizData | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lightboxPageId, setLightboxPageId] = useState<string | null>(null)
  const [tryQuizIndex, setTryQuizIndex] = useState<number | null>(null)

  // Reset pending when data changes
  useEffect(() => {
    setPending(null)
  }, [data?.version])

  const effective = pending ?? data?.quizzes
  const quizzes = effective?.quizzes ?? []
  const dirty = pending != null

  const displayQuizzes = selectedPageId
    ? quizzes.filter((q) => q.pageIds.includes(selectedPageId))
    : quizzes
  const displayQuestionCount = displayQuizzes.reduce(
    (count, quiz) => count + getQuizQuestions(quiz).length,
    0
  )

  const saveQuizzes = useCallback(async () => {
    if (!pending) return
    setSaving(true)
    setSaveError(null)
    const minDelay = new Promise((r) => setTimeout(r, 400))
    try {
      await api.updateQuizzes(bookLabel, pending)
      await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "quizzes"] })
      setPending(null)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      await minDelay
      setSaving(false)
    }
  }, [pending, bookLabel, queryClient])

  const saveRef = useRef(saveQuizzes)
  saveRef.current = saveQuizzes

  useEffect(() => {
    if (!data?.quizzes) return
    setExtra(
      <div className="flex items-center gap-1.5 ml-auto">
        <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5">{t`${String(displayQuestionCount)} questions`}</span>
        <VersionPicker
          currentVersion={data.version}
          saving={saving}
          dirty={dirty}
          bookLabel={bookLabel}
          onPreview={(d) => setPending(d as QuizData)}
          onSave={() => saveRef.current()}
          onDiscard={() => setPending(null)}
        />
      </div>
    )
    return () => setExtra(null)
  }, [data, displayQuestionCount, saving, dirty, bookLabel, selectedPageId])

  const updateQuizQuestions = (
    quizIdx: number,
    updater: (questions: QuizQuestion[]) => QuizQuestion[]
  ) => {
    const base = pending ?? data?.quizzes
    if (!base) return
    setPending({
      ...base,
      quizzes: base.quizzes.map((quiz, i) => {
        if (i !== quizIdx) return quiz
        return syncQuizFromQuestions(quiz, updater(getQuizQuestions(quiz)))
      }),
    })
  }

  const updateSharedTitle = (quizIdx: number, title: string) => {
    updateQuizQuestions(quizIdx, (questions) => questions.map((q) => ({ ...q, question: title })))
  }

  const updateQuestionAt = (
    quizIdx: number,
    questionIdx: number,
    patch: Partial<QuizQuestion>
  ) => {
    updateQuizQuestions(quizIdx, (questions) =>
      questions.map((question, index) =>
        index === questionIdx ? { ...question, ...patch } : question
      )
    )
  }

  const updateQuizAt = (quizIdx: number, patch: Partial<QuizItem>) => {
    const base = pending ?? data?.quizzes
    if (!base) return
    setPending({
      ...base,
      quizzes: base.quizzes.map((quiz, index) =>
        index === quizIdx ? { ...quiz, ...patch } : quiz
      ),
    })
  }

  const deleteQuizAt = async (quizIdx: number) => {
    const base = pending ?? data?.quizzes
    if (!base || saving) return
    const next = {
      ...base,
      quizzes: base.quizzes
        .filter((_, index) => index !== quizIdx)
        .map((quiz, index) => ({ ...quiz, quizIndex: index })),
    }
    setPending(next)
    setSaving(true)
    setSaveError(null)
    const minDelay = new Promise((r) => setTimeout(r, 400))
    try {
      await api.updateQuizzes(bookLabel, next)
      await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "quizzes"] })
      setPending(null)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      await minDelay
      setSaving(false)
    }
  }

  const renderQuestionEditor = (
    quizIdx: number,
    question: QuizQuestion,
    questionIdx: number,
    options: { showTitle?: boolean } = {}
  ) => {
    if (question.activityType === "multiple_choice") {
      return (
        <div className="space-y-2">
          <textarea
            value={question.question}
            onChange={(e) => updateQuestionAt(quizIdx, questionIdx, { question: e.target.value })}
            className="w-full text-sm font-medium resize-none rounded border border-transparent bg-transparent p-1 -m-1 hover:border-border hover:bg-muted/30 focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
            rows={1}
          />
          {(question.options ?? []).map((option, optionIdx) => (
            <div
              key={optionIdx}
              className={`flex items-start gap-2.5 px-3 py-2 rounded-md ${
                optionIdx === question.answerIndex
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-muted/50 text-muted-foreground"
              }`}
            >
              {optionIdx === question.answerIndex ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-1.5" />
              ) : (
                <XCircle className="w-4 h-4 shrink-0 opacity-30 mt-1.5" />
              )}
              <div className="flex-1 min-w-0">
                <textarea
                  value={option.text}
                  onChange={(e) => {
                    const options = (question.options ?? []).map((o, i) =>
                      i === optionIdx ? { ...o, text: e.target.value } : o
                    )
                    updateQuestionAt(quizIdx, questionIdx, { options })
                  }}
                  className="w-full text-sm resize-none rounded border border-transparent bg-transparent p-1 -m-1 hover:border-border hover:bg-white/50 focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                  rows={1}
                />
                <textarea
                  value={option.explanation}
                  onChange={(e) => {
                    const options = (question.options ?? []).map((o, i) =>
                      i === optionIdx ? { ...o, explanation: e.target.value } : o
                    )
                    updateQuestionAt(quizIdx, questionIdx, { options })
                  }}
                  className="w-full text-xs opacity-70 resize-none rounded border border-transparent bg-transparent p-1 -m-1 mt-0.5 hover:border-border hover:bg-white/50 focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring focus:opacity-100 transition-colors"
                  rows={1}
                />
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (question.activityType === "true_false") {
      const statements = question.statements && question.statements.length > 0
        ? question.statements
        : [{ text: "", answer: true }]
      return (
        <div className="space-y-2">
          {options.showTitle && (
            <textarea
              value={question.question}
              onChange={(e) => updateQuestionAt(quizIdx, questionIdx, { question: e.target.value })}
              className="w-full text-sm font-medium resize-none rounded border border-transparent bg-transparent p-1 -m-1 hover:border-border hover:bg-muted/30 focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
              rows={1}
            />
          )}
          {statements.map((statement, statementIdx) => (
            <div key={statementIdx} className="space-y-2">
              <textarea
                value={statement.text}
                onChange={(e) => {
                  const nextStatements = statements.map((s, i) =>
                    i === statementIdx ? { ...s, text: e.target.value } : s
                  )
                  updateQuestionAt(quizIdx, questionIdx, { statements: nextStatements })
                }}
                className="w-full text-sm resize-none rounded border bg-muted/40 p-2 focus:outline-none focus:ring-1 focus:ring-ring"
                rows={2}
              />
              <div className="inline-flex overflow-hidden rounded-md border bg-background p-0.5">
                {[true, false].map((value) => (
                  <button
                    key={String(value)}
                    type="button"
                    onClick={() => {
                      const nextStatements = statements.map((s, i) =>
                        i === statementIdx ? { ...s, answer: value } : s
                      )
                      updateQuestionAt(quizIdx, questionIdx, { statements: nextStatements })
                    }}
                    className={`h-7 px-3 text-xs font-medium transition-colors ${
                      statement.answer === value ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    {value ? t`True` : t`False`}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (question.activityType === "fill_in_the_blank") {
      return (
        <div className="space-y-2">
          {options.showTitle && (
            <textarea
              value={question.question}
              onChange={(e) => updateQuestionAt(quizIdx, questionIdx, { question: e.target.value })}
              className="w-full text-sm font-medium resize-none rounded border border-transparent bg-transparent p-1 -m-1 hover:border-border hover:bg-muted/30 focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
              rows={1}
            />
          )}
          {(question.blanks ?? []).map((blank, blankIdx) => (
            <div key={blankIdx} className="grid gap-2 sm:grid-cols-[1fr_180px]">
              <textarea
                value={blank.prompt}
                onChange={(e) => {
                  const blanks = (question.blanks ?? []).map((b, i) =>
                    i === blankIdx ? { ...b, prompt: e.target.value } : b
                  )
                  updateQuestionAt(quizIdx, questionIdx, { blanks })
                }}
                className="min-h-10 text-sm resize-none rounded border bg-muted/40 p-2 focus:outline-none focus:ring-1 focus:ring-ring"
                rows={2}
              />
              <input
                value={blank.answer}
                onChange={(e) => {
                  const blanks = (question.blanks ?? []).map((b, i) =>
                    i === blankIdx ? { ...b, answer: e.target.value } : b
                  )
                  updateQuestionAt(quizIdx, questionIdx, { blanks })
                }}
                className="h-9 rounded border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <textarea
                value={blank.explanation ?? ""}
                onChange={(e) => {
                  const blanks = (question.blanks ?? []).map((b, i) =>
                    i === blankIdx ? { ...b, explanation: e.target.value } : b
                  )
                  updateQuestionAt(quizIdx, questionIdx, { blanks })
                }}
                className="min-h-9 text-xs resize-none rounded border bg-background p-2 focus:outline-none focus:ring-1 focus:ring-ring sm:col-span-2"
                rows={1}
                placeholder={t`Explanation`}
              />
            </div>
          ))}
        </div>
      )
    }

    return (
      <div className="space-y-2">
        {options.showTitle && (
          <textarea
            value={question.question}
            onChange={(e) => updateQuestionAt(quizIdx, questionIdx, { question: e.target.value })}
            className="w-full text-sm font-medium resize-none rounded border border-transparent bg-transparent p-1 -m-1 hover:border-border hover:bg-muted/30 focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
            rows={1}
          />
        )}
        {(question.pairs ?? []).map((pair, pairIdx) => (
          <div key={pairIdx} className="grid gap-2 sm:grid-cols-2">
            <textarea
              value={pair.item}
              onChange={(e) => {
                const pairs = (question.pairs ?? []).map((p, i) =>
                  i === pairIdx ? { ...p, item: e.target.value } : p
                )
                updateQuestionAt(quizIdx, questionIdx, { pairs })
              }}
              className="min-h-9 resize-none rounded border bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              rows={1}
            />
            <textarea
              value={pair.match}
              onChange={(e) => {
                const pairs = (question.pairs ?? []).map((p, i) =>
                  i === pairIdx ? { ...p, match: e.target.value } : p
                )
                updateQuestionAt(quizIdx, questionIdx, { pairs })
              }}
              className="min-h-9 resize-none rounded border bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              rows={1}
            />
            <textarea
              value={pair.explanation ?? ""}
              onChange={(e) => {
                const pairs = (question.pairs ?? []).map((p, i) =>
                  i === pairIdx ? { ...p, explanation: e.target.value } : p
                )
                updateQuestionAt(quizIdx, questionIdx, { pairs })
              }}
              className="min-h-9 resize-none rounded border bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring sm:col-span-2"
              rows={1}
              placeholder={t`Explanation`}
            />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4">
      <QuizzesLandingConfig
        bookLabel={bookLabel}
        apiKey={apiKey}
        hasApiKey={hasApiKey}
        providerCredentials={providerCredentials}
        initialSelectedPageId={selectedPageId}
      />
      {saveError && <p className="text-xs text-red-500">{saveError}</p>}
      {selectedPageId && displayQuizzes.length === 0 && quizzes.length > 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center mb-3">
            <HelpCircle className="w-6 h-6 text-orange-300" />
          </div>
          <p className="text-sm font-medium">{t`No quizzes for this page`}</p>
          <p className="text-xs mt-1">{t`Quizzes are linked to other pages in this book`}</p>
        </div>
      )}
      {isLoading && quizzes.length === 0 && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          <span className="text-sm">{t`Loading quizzes...`}</span>
        </div>
      )}
      {displayQuizzes.map((quiz) => {
        const idx = quizzes.indexOf(quiz)
        const questions = getQuizQuestions(quiz)
        const activityType = questions[0]?.activityType ?? "multiple_choice"
        const sharedTitle = activityType === "multiple_choice" ? null : getSharedQuestionTitle(questions)
        return (
        <div key={idx} className={`rounded-md border bg-card overflow-hidden ${quiz.isPruned ? "opacity-55" : ""}`}>
          <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-muted/20 border-b">
            <span className={`rounded border px-2 py-0.5 text-[10px] font-medium ${activityBadgeClass(activityType)}`}>
              {getActivityLabel(activityType)}
            </span>
            <span className="text-[10px] text-muted-foreground">{t`After ${quiz.afterPageId}`}</span>
            <button
              type="button"
              onClick={() => setTryQuizIndex(quizzes.filter((q) => !q.isPruned).indexOf(quiz))}
              disabled={quiz.isPruned}
              className="ml-auto inline-flex h-7 items-center gap-1 rounded border bg-background px-2 text-[10px] font-medium transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Eye className="h-3 w-3" />
              {t`Try`}
            </button>
            <button
              type="button"
              onClick={() => updateQuizAt(idx, { isPruned: !quiz.isPruned })}
              className="inline-flex h-7 items-center gap-1 rounded border bg-background px-2 text-[10px] font-medium transition-colors hover:bg-muted/60"
            >
              <Scissors className="h-3 w-3" />
              {quiz.isPruned ? t`Unprune` : t`Prune`}
            </button>
            {quiz.isPruned && (
              <button
                type="button"
                onClick={() => void deleteQuizAt(idx)}
                disabled={saving}
                className="inline-flex h-7 items-center gap-1 rounded border border-red-200 bg-red-50 px-2 text-[10px] font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                title={t`Delete pruned quiz`}
              >
                <Trash2 className="h-3 w-3" />
                {t`Delete`}
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 bg-muted/10 border-b">
            {quiz.pageIds.length > 0 ? (
              quiz.pageIds.map((pageId) => (
                <PageThumb key={pageId} bookLabel={bookLabel} pageId={pageId} onClick={() => setLightboxPageId(pageId)} />
              ))
            ) : (
              <span className="text-xs text-muted-foreground">{t`After ${quiz.afterPageId}`}</span>
            )}
          </div>
          <div className="px-4 py-3 space-y-4">
            {sharedTitle && (
              <textarea
                value={sharedTitle}
                onChange={(e) => updateSharedTitle(idx, e.target.value)}
                className="w-full text-sm font-semibold resize-none rounded border border-transparent bg-transparent p-1 -m-1 hover:border-border hover:bg-muted/30 focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                rows={1}
              />
            )}
            <span className="text-[10px] text-muted-foreground mt-1 inline-block">
              {t`After ${quiz.afterPageId}`}
            </span>
          </div>
          <div className="px-4 pb-3 space-y-4">
            {questions.map((question, questionIdx) => (
              <div key={questionIdx} className="rounded-md border bg-muted/20 p-3 space-y-2">
                {questions.length > 1 && (
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t`Q${String(questionIdx + 1)}`}
                  </p>
                )}
                {renderQuestionEditor(idx, question, questionIdx, {
                  showTitle: activityType !== "multiple_choice" && !sharedTitle,
                })}
              </div>
            ))}
            {quiz.reasoning && (
              <p className="text-xs italic text-muted-foreground px-1 pt-1">{quiz.reasoning}</p>
            )}
          </div>
        </div>
        )
      })}
      <PageLightbox
        bookLabel={bookLabel}
        pageId={lightboxPageId}
        open={lightboxPageId != null}
        onOpenChange={(open) => {
          if (!open) setLightboxPageId(null)
        }}
      />
      <Dialog open={tryQuizIndex != null} onOpenChange={(open) => { if (!open) setTryQuizIndex(null) }}>
        <DialogContent className="h-[85vh] w-[min(1100px,96vw)] max-w-[96vw] gap-0 overflow-hidden p-0 bg-white">
          <DialogTitle className="sr-only">{t`Try quiz`}</DialogTitle>
          <DialogDescription className="sr-only">{t`Interactive preview for the selected quiz.`}</DialogDescription>
          <div className="flex h-11 items-center border-b px-3 pr-12">
            <span className="text-xs font-medium text-muted-foreground">{t`Try`}</span>
          </div>
          {tryQuizIndex != null && (
            <iframe
              title={t`Quiz preview`}
              className="h-[calc(85vh-44px)] w-full bg-white"
              src={`/api/books/${bookLabel}/adt-preview/qz${pad3(tryQuizIndex + 1)}.html?embed=1&v=${data?.version ?? 0}`}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
