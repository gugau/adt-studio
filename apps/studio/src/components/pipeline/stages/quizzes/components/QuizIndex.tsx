import { useMemo, useRef, useEffect } from "react"
import { FileText } from "lucide-react"
import { useLingui } from "@lingui/react/macro"
import { cn } from "@/lib/utils"
import { useQuizzes } from "@/hooks/use-quizzes"
import { usePages, usePageImage } from "@/hooks/use-pages"
import { formatPageNumbers } from "../lib/format-page-numbers"

/** Small page-image preview for a quiz row, badged with the quiz number. */
function QuizThumb({
  bookLabel,
  pageId,
  badge,
}: {
  bookLabel: string
  pageId: string
  badge: number
}) {
  const { data } = usePageImage(bookLabel, pageId)
  const src = data?.imageBase64
    ? `data:image/png;base64,${data.imageBase64}`
    : null
  return (
    <div className="relative shrink-0 w-12 h-16 rounded ring-1 ring-border overflow-hidden bg-muted">
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover object-top"
        />
      )}
      <span className="absolute left-0 top-0 flex h-4 min-w-[16px] items-center justify-center rounded-br bg-black/60 px-1 text-[9px] font-semibold text-white">
        {badge}
      </span>
    </div>
  )
}

/**
 * Sidebar navigation for the Quizzes stage. Unlike PageIndex (which lists the
 * book's pages), this lists the generated quizzes themselves — each with a
 * preview of its first source page. Selecting a quiz navigates to the page it
 * sits after, which the QuizzesView uses to show that quiz alongside the pages
 * it was generated from.
 */
export function QuizIndex({
  bookLabel,
  selectedPageId,
  onSelectPage,
}: {
  bookLabel: string
  selectedPageId?: string
  onSelectPage?: (pageId: string) => void
}) {
  const { t } = useLingui()
  const { data } = useQuizzes(bookLabel)
  const { data: pages } = usePages(bookLabel)
  const quizzes = data?.quizzes?.quizzes ?? []

  const pageNumberById = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of pages ?? []) m.set(p.pageId, p.pageNumber)
    return m
  }, [pages])

  const activeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" })
  }, [selectedPageId])

  // When there are no quizzes the stage shows its landing page instead, and the
  // side panel stays closed — so there is nothing to render here.
  if (quizzes.length === 0) return null

  return (
    <div className="flex-1 overflow-y-auto py-1">
      {quizzes.map((quiz, i) => {
        const isActive =
          !!selectedPageId && quiz.afterPageId === selectedPageId
        const pageNumbers = quiz.pageIds
          .map((id) => pageNumberById.get(id))
          .filter((n): n is number => n != null)
        const label = formatPageNumbers(pageNumbers)
        const thumbPageId = quiz.pageIds[0] ?? quiz.afterPageId
        return (
          <button
            key={`${quiz.afterPageId}-${i}`}
            ref={isActive ? activeRef : undefined}
            type="button"
            onClick={() => onSelectPage?.(quiz.afterPageId)}
            className={cn(
              "flex w-full items-start gap-2.5 px-2.5 py-2 text-left transition-colors",
              isActive
                ? "bg-orange-50 text-orange-700"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <QuizThumb bookLabel={bookLabel} pageId={thumbPageId} badge={i + 1} />
            <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
              <span
                className={cn(
                  "line-clamp-2 text-[11px] leading-snug",
                  isActive && "font-medium",
                )}
              >
                {quiz.question || t`Untitled quiz`}
              </span>
              {label && (
                <span className="flex items-center gap-1 text-[9px] leading-none opacity-60">
                  <FileText className="h-2.5 w-2.5" />
                  {label}
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
