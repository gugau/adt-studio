import { useState, useEffect, useRef, useCallback } from "react"
import { CheckCircle2, XCircle, HelpCircle, Loader2, ImageOff } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { api } from "@/api/client"
import type { QuizGenerationOutput } from "@/api/client"
import { useQuizzes } from "@/hooks/use-quizzes"
import { usePageImage } from "@/hooks/use-pages"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useStepHeader } from "../../components/StepViewRouter"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { StageRunCard } from "../../components/StageRunCard"
import { VersionPicker } from "../../components/VersionPicker"
import { StageContentGuard } from "../../components/StageContentGuard"
import { StageEmptyState } from "../../components/StageEmptyState"
import { getRequestedPageId, getQuizImageRenderState } from "./lib/quizzes-image-state"
import { useLingui } from "@lingui/react/macro"


type QuizData = QuizGenerationOutput

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
  const { stageState, queueRun } = useBookRun()
  const { apiKey, hasApiKey } = useApiKey()
  const quizzesState = stageState("quizzes")
  const quizzesDone = quizzesState === "done"
  const quizzesRunning = quizzesState === "running" || quizzesState === "queued"
  const showRunCard = !quizzesDone || quizzesRunning

  const handleRunQuizzes = useCallback(() => {
    if (!hasApiKey || quizzesRunning) return
    queueRun({ fromStage: "quizzes", toStage: "quizzes", apiKey })
  }, [hasApiKey, quizzesRunning, apiKey, queueRun])

  const [pending, setPending] = useState<QuizData | null>(null)
  const [saving, setSaving] = useState(false)
  const [lightboxPageId, setLightboxPageId] = useState<string | null>(null)

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

  const saveQuizzes = useCallback(async () => {
    if (!pending) return
    setSaving(true)
    const minDelay = new Promise((r) => setTimeout(r, 400))
    await api.updateQuizzes(bookLabel, pending)
    setPending(null)
    await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "quizzes"] })
    await minDelay
    setSaving(false)
  }, [pending, bookLabel, queryClient])

  const saveRef = useRef(saveQuizzes)
  saveRef.current = saveQuizzes

  useEffect(() => {
    if (!data?.quizzes) return
    setExtra(
      <div className="flex items-center gap-1.5 ml-auto">
        <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5">{t`${String(displayQuizzes.length)} questions`}</span>
        <VersionPicker
          step="quiz-generation"
          itemId="book"
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
  }, [data, displayQuizzes.length, saving, dirty, bookLabel, selectedPageId])

  const updateQuestion = (idx: number, question: string) => {
    const base = pending ?? data?.quizzes
    if (!base) return
    setPending({
      ...base,
      quizzes: base.quizzes.map((q, i) =>
        i === idx ? { ...q, question } : q
      ),
    })
  }

  const updateOptionText = (quizIdx: number, optIdx: number, text: string) => {
    const base = pending ?? data?.quizzes
    if (!base) return
    setPending({
      ...base,
      quizzes: base.quizzes.map((q, i) =>
        i === quizIdx
          ? { ...q, options: q.options.map((o, j) => (j === optIdx ? { ...o, text } : o)) }
          : q
      ),
    })
  }

  const updateOptionExplanation = (quizIdx: number, optIdx: number, explanation: string) => {
    const base = pending ?? data?.quizzes
    if (!base) return
    setPending({
      ...base,
      quizzes: base.quizzes.map((q, i) =>
        i === quizIdx
          ? { ...q, options: q.options.map((o, j) => (j === optIdx ? { ...o, explanation } : o)) }
          : q
      ),
    })
  }

  const showPerPageEmpty =
    selectedPageId && displayQuizzes.length === 0 && quizzes.length > 0

  return (
    <StageContentGuard
      stageSlug="quizzes"
      isLoading={!showRunCard && isLoading}
      loadingLabel={t`Loading quizzes...`}
      showRunCard={showRunCard || quizzes.length === 0}
      runCard={
        <StageRunCard
          stageSlug="quizzes"
          isRunning={quizzesRunning}
          completed={quizzesDone}
          onRun={handleRunQuizzes}
          disabled={!hasApiKey || quizzesRunning}
        />
      }
    >
      {showPerPageEmpty ? (
        <StageEmptyState
          icon={HelpCircle}
          color="orange"
          title={t`No quizzes for this page`}
          subtitle={t`Quizzes are linked to other pages in this book`}
        />
      ) : (
    <div className="space-y-2">
      {displayQuizzes.map((quiz) => {
        const idx = quizzes.indexOf(quiz)
        return (
        <div key={idx} className="rounded-md border bg-card overflow-hidden">
          <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 bg-muted/20 border-b">
            {quiz.pageIds.length > 0 ? (
              quiz.pageIds.map((pageId) => (
                <PageThumb key={pageId} bookLabel={bookLabel} pageId={pageId} onClick={() => setLightboxPageId(pageId)} />
              ))
            ) : (
              <span className="text-xs text-muted-foreground">{t`After ${quiz.afterPageId}`}</span>
            )}
          </div>
          <div className="px-4 py-3">
            <textarea
              value={quiz.question}
              onChange={(e) => updateQuestion(idx, e.target.value)}
              className="w-full text-sm font-medium resize-none rounded border border-transparent bg-transparent p-1 -m-1 hover:border-border hover:bg-muted/30 focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
              rows={1}
            />
            <span className="text-[10px] text-muted-foreground mt-1 inline-block">
              {t`After ${quiz.afterPageId}`}
            </span>
          </div>
          <div className="px-4 pb-3 space-y-1.5">
            {quiz.options.map((option, i) => (
              <div
                key={i}
                className={`flex items-start gap-2.5 px-3 py-2 rounded-md ${
                  i === quiz.answerIndex
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-muted/50 text-muted-foreground"
                }`}
              >
                {i === quiz.answerIndex ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-1.5" />
                ) : (
                  <XCircle className="w-4 h-4 shrink-0 opacity-30 mt-1.5" />
                )}
                <div className="flex-1 min-w-0">
                  <textarea
                    value={option.text}
                    onChange={(e) => updateOptionText(idx, i, e.target.value)}
                    className="w-full text-sm resize-none rounded border border-transparent bg-transparent p-1 -m-1 hover:border-border hover:bg-white/50 focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                    rows={1}
                  />
                  <textarea
                    value={option.explanation}
                    onChange={(e) => updateOptionExplanation(idx, i, e.target.value)}
                    className="w-full text-xs opacity-70 resize-none rounded border border-transparent bg-transparent p-1 -m-1 mt-0.5 hover:border-border hover:bg-white/50 focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring focus:opacity-100 transition-colors"
                    rows={1}
                  />
                </div>
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
    </div>
      )}
    </StageContentGuard>
  )
}
