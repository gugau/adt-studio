import { useEffect, type ReactNode } from "react"
import { useNavigate } from "@tanstack/react-router"
import { CheckCircle2, ExternalLink, HelpCircle, XCircle } from "lucide-react"
import { Trans } from "@lingui/react/macro"
import { useLingui } from "@lingui/react/macro"
import { useStepHeader } from "../../../components/StepViewRouter"
import { StorySectionBanner } from "./StorySectionBanner"
import { useQuizzes } from "@/hooks/use-quizzes"
import { usePageImage, usePages } from "@/hooks/use-pages"
import type { Quiz } from "@adt/types"

/**
 * Read-only quiz panel rendered inside the storyboard stage when a quiz row
 * is selected. Editing happens on the dedicated Quizzes stage — this view is
 * a quick reference, with a link out for full editing.
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

  const quiz: Quiz | undefined = quizzesData?.quizzes?.quizzes?.find(
    (q) => q.quizIndex === quizIndex,
  )

  const afterPage = pages?.find((p) => p.pageId === quiz?.afterPageId)

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

  return (
    <div className="flex-1 overflow-auto bg-muted/20">
      <div className="max-w-3xl mx-auto px-6 py-8">
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
        <div className="rounded-xl bg-card ring-1 ring-border shadow-sm overflow-hidden">
          {/* Source page strip */}
          {quiz.pageIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-5 py-3 bg-muted/40 border-b">
              <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
                <Trans>Drawn from</Trans>
              </span>
              {quiz.pageIds.map((pid) => (
                <QuizPageChip key={pid} bookLabel={bookLabel} pageId={pid} pages={pages} />
              ))}
            </div>
          )}
          {/* Question */}
          <div className="px-6 pt-6 pb-4">
            <div className="text-[10px] uppercase tracking-wide font-semibold text-orange-700 mb-2">
              <Trans>Question</Trans>
            </div>
            <p className="text-lg font-medium leading-snug">{quiz.question}</p>
          </div>
          {/* Options */}
          <div className="px-6 pb-6 space-y-2">
            <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">
              <Trans>Options</Trans>
            </div>
            {quiz.options.map((option, i) => {
              const correct = i === quiz.answerIndex
              return (
                <div
                  key={i}
                  className={
                    correct
                      ? "flex items-start gap-3 px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200"
                      : "flex items-start gap-3 px-4 py-3 rounded-lg bg-muted/40 border border-transparent"
                  }
                >
                  {correct ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-muted-foreground/40 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={correct ? "text-sm font-medium text-emerald-900" : "text-sm"}>
                      {option.text}
                    </div>
                    {option.explanation && (
                      <div
                        className={
                          correct
                            ? "text-xs text-emerald-700/80 mt-1"
                            : "text-xs text-muted-foreground mt-1"
                        }
                      >
                        {option.explanation}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {quiz.reasoning && (
            <div className="px-6 py-3 border-t bg-muted/20">
              <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">
                <Trans>Author's reasoning</Trans>
              </div>
              <p className="text-xs text-muted-foreground italic leading-relaxed">{quiz.reasoning}</p>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-6">
          <Trans>Editing happens on the Quizzes stage. Use the button above to jump there.</Trans>
        </p>
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

