import { Trans, useLingui } from "@lingui/react/macro"
import { HelpCircle, PenLine } from "lucide-react"
import { Link } from "@tanstack/react-router"
import { BASE_URL, type PageQuizItem } from "@/api/client"

/**
 * Read-only preview for a generated quiz inside the Storyboard stage. Editing
 * still happens in the Quizzes stage; we only surface the rendered quiz HTML
 * here so the storyboard sidebar can show every item in the book.
 */
export function StoryboardQuizDetail({
  bookLabel,
  quiz,
}: {
  bookLabel: string
  quiz: PageQuizItem
}) {
  const { t } = useLingui()
  const previewSrc = `${BASE_URL}/books/${bookLabel}/adt-preview/${quiz.quizId}.html?embed=1&v=${String(quiz.renderingVersion ?? 0)}`

  return (
    <div className="flex flex-col h-full min-h-0 p-4 gap-3">
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-orange-600 text-white">
          <HelpCircle className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-orange-700">
            <Trans>Quiz {quiz.quizIndex + 1}</Trans>
          </h2>
          {quiz.question && (
            <p className="text-xs text-muted-foreground line-clamp-1">{quiz.question}</p>
          )}
        </div>
        <Link
          to="/books/$label/$step"
          params={{ label: bookLabel, step: "quizzes" }}
          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-orange-200 text-orange-700 bg-white hover:bg-orange-50 transition-colors"
          title={t`Edit in Quizzes stage`}
        >
          <PenLine className="w-3.5 h-3.5" />
          <Trans>Edit</Trans>
        </Link>
      </div>

      <div className="flex-1 min-h-0 rounded border bg-white overflow-hidden">
        <iframe
          src={previewSrc}
          title={t`Quiz preview`}
          className="w-full h-full"
          sandbox="allow-same-origin allow-scripts"
        />
      </div>

      <p className="shrink-0 text-[11px] text-muted-foreground">
        <Trans>
          Read-only preview. Edit quiz content in the Quizzes stage.
        </Trans>
      </p>
    </div>
  )
}
