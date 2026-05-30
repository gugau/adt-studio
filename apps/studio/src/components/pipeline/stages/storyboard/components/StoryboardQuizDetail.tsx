import { useEffect, useState, type ReactNode } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  CheckCircle2,
  Circle,
  CircleDot,
  ExternalLink,
  HelpCircle,
  RotateCcw,
  XCircle,
} from "lucide-react"
import { Trans } from "@lingui/react/macro"
import { useLingui } from "@lingui/react/macro"
import { useStepHeader } from "../../../components/StepViewRouter"
import { StorySectionBanner } from "./StorySectionBanner"
import { useQuizzes } from "@/hooks/use-quizzes"
import { usePageImage, usePages } from "@/hooks/use-pages"
import { cn } from "@/lib/utils"
import type { Quiz } from "@adt/types"

/**
 * Interactive quiz panel rendered inside the storyboard stage when a quiz row
 * is selected. Fills the full content area and lets the user take the quiz —
 * select an option, check it, and see correct/incorrect feedback — mirroring
 * the runtime experience. Editing happens on the dedicated Quizzes stage.
 */
export function StoryboardQuizDetail({
  bookLabel,
  quizIndex,
  navigationExtra,
  navigationArrows,
}: {
  bookLabel: string
  quizIndex: number
  navigationExtra?: ReactNode
  navigationArrows?: ReactNode
}) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const { setExtra, setOnLabelClick } = useStepHeader()
  const { data: quizzesData, isLoading } = useQuizzes(bookLabel)
  const { data: pages } = usePages(bookLabel)

  // Interactive state — selected option + whether it has been checked.
  const [selected, setSelected] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)

  const quiz: Quiz | undefined = quizzesData?.quizzes?.quizzes?.find(
    (q) => q.quizIndex === quizIndex,
  )

  const afterPage = pages?.find((p) => p.pageId === quiz?.afterPageId)

  // Reset interaction when navigating to a different quiz.
  useEffect(() => {
    setSelected(null)
    setChecked(false)
  }, [quizIndex])

  const openQuizzesStage = () =>
    navigate({
      to: "/books/$label/$step",
      params: { label: bookLabel, step: "quizzes" },
    })

  // Header: "Storyboard / Quiz / after page X"
  useEffect(() => {
    setOnLabelClick(null)
    setExtra(
      <>
        {navigationExtra}
        <span className="inline-flex items-center gap-1 px-1.5 h-5 rounded bg-orange-300/30 ring-1 ring-white/20 text-white text-[10px] font-semibold uppercase tracking-wide">
          <HelpCircle className="h-3 w-3" />
          {t`Quiz`}
        </span>
        {afterPage && (
          <span className="text-white/60 text-[11px]">
            {t`after page ${afterPage.pageNumber}`}
          </span>
        )}
        <div className="flex-1" />
        {navigationArrows}
      </>,
    )
    return () => {
      setExtra(null)
      setOnLabelClick(null)
    }
  }, [setExtra, setOnLabelClick, navigationExtra, navigationArrows, afterPage?.pageNumber, t])

  if (isLoading && !quiz) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        <Trans>Loading quiz...</Trans>
      </div>
    )
  }

  if (!quiz) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md text-center text-sm text-muted-foreground">
          <Trans>Quiz not found. It may have been removed since you opened the storyboard.</Trans>
        </div>
      </div>
    )
  }

  const isCorrect = checked && selected === quiz.answerIndex

  const handleCheck = () => {
    if (selected !== null) setChecked(true)
  }
  const handleReset = () => {
    setSelected(null)
    setChecked(false)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-muted/20">
      {/* Header — banner + the source pages used to generate the quiz */}
      <div className="shrink-0 px-6 pt-6">
        <StorySectionBanner
          icon={<HelpCircle className="w-4 h-4" />}
          title={t`Quiz`}
          subtitle={
            afterPage
              ? t`Knowledge check generated from the source pages, after page ${afterPage.pageNumber}.`
              : t`Knowledge check generated from the source pages.`
          }
          action={
            <button
              type="button"
              onClick={openQuizzesStage}
              className="flex items-center gap-1.5 px-2.5 h-7 rounded-md bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors text-xs font-medium cursor-pointer"
              title={t`Open the Quizzes stage to edit this quiz`}
            >
              <ExternalLink className="h-3 w-3" />
              {t`Edit in Quizzes`}
            </button>
          }
        />
        {quiz.pageIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pb-4">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
              <Trans>Drawn from</Trans>
            </span>
            {quiz.pageIds.map((pid) => (
              <QuizPageChip key={pid} bookLabel={bookLabel} pageId={pid} pages={pages} />
            ))}
          </div>
        )}
      </div>

      {/* Interactive quiz — fills the remaining height */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="h-full flex flex-col rounded-xl bg-card ring-1 ring-border shadow-sm overflow-hidden">
          {/* Question */}
          <div className="px-6 pt-6 pb-4">
            <div className="text-[10px] uppercase tracking-wide font-semibold text-orange-700 mb-2">
              <Trans>Question</Trans>
            </div>
            <p className="text-lg font-medium leading-snug">{quiz.question}</p>
          </div>

          {/* Options */}
          <div
            className="flex-1 px-6 pb-6 space-y-2"
            role="radiogroup"
            aria-label={t`Answer options`}
          >
            <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">
              <Trans>Options</Trans>
            </div>
            {quiz.options.map((option, i) => {
              const isSelected = selected === i
              const isAnswer = i === quiz.answerIndex
              const showCorrect = checked && isAnswer
              const showWrong = checked && isSelected && !isAnswer
              return (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={checked}
                  onClick={() => setSelected(i)}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3 rounded-lg border text-left transition-colors",
                    !checked &&
                      (isSelected
                        ? "bg-orange-50 border-orange-300 ring-1 ring-orange-300"
                        : "bg-muted/40 border-transparent hover:bg-muted cursor-pointer"),
                    showCorrect && "bg-emerald-50 border-emerald-300",
                    showWrong && "bg-red-50 border-red-300",
                    checked && !showCorrect && !showWrong && "bg-muted/40 border-transparent opacity-50",
                  )}
                >
                  {showCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : showWrong ? (
                    <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  ) : isSelected ? (
                    <CircleDot className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground/40 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        "text-sm",
                        showCorrect && "font-medium text-emerald-900",
                        showWrong && "font-medium text-red-900",
                      )}
                    >
                      {option.text}
                    </div>
                    {checked && (showCorrect || showWrong) && option.explanation && (
                      <div
                        className={cn(
                          "text-xs mt-1",
                          showCorrect ? "text-emerald-700/80" : "text-red-700/80",
                        )}
                      >
                        {option.explanation}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Action bar — check / result + try again */}
          <div className="px-6 py-4 border-t bg-muted/20 flex items-center gap-3">
            {!checked ? (
              <button
                type="button"
                onClick={handleCheck}
                disabled={selected === null}
                className="flex items-center gap-1.5 px-4 h-9 rounded-md bg-orange-600 text-white hover:bg-orange-700 transition-colors text-sm font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trans>Check answer</Trans>
              </button>
            ) : (
              <>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-sm font-semibold",
                    isCorrect ? "text-emerald-700" : "text-red-700",
                  )}
                >
                  {isCorrect ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <Trans>Correct!</Trans>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      <Trans>Not quite</Trans>
                    </>
                  )}
                </span>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 h-9 rounded-md bg-muted text-foreground hover:bg-muted/70 transition-colors text-sm font-medium cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <Trans>Try again</Trans>
                </button>
              </>
            )}
          </div>

          {/* Author's reasoning — revealed only after checking to avoid spoilers */}
          {checked && quiz.reasoning && (
            <div className="px-6 py-3 border-t bg-muted/20">
              <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">
                <Trans>Author's reasoning</Trans>
              </div>
              <p className="text-xs text-muted-foreground italic leading-relaxed">{quiz.reasoning}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function QuizPageChip({
  bookLabel,
  pageId,
  pages,
}: {
  bookLabel: string
  pageId: string
  pages: ReturnType<typeof usePages>["data"]
}) {
  const { data } = usePageImage(bookLabel, pageId)
  const page = pages?.find((p) => p.pageId === pageId)
  const src = data?.imageBase64 ? `data:image/png;base64,${data.imageBase64}` : null
  return (
    <div className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-background ring-1 ring-border">
      <div className="w-6 h-8 rounded-sm bg-muted overflow-hidden ring-1 ring-border">
        {src && <img src={src} alt="" className="w-full h-full object-cover" />}
      </div>
      <span className="text-[10px] font-mono text-muted-foreground">
        {page ? `pg ${page.pageNumber}` : pageId}
      </span>
    </div>
  )
}
