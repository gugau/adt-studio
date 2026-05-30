import { useMemo, useRef, useEffect, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { FileText, CheckCircle2, Circle, HelpCircle } from "lucide-react"
import { useLingui } from "@lingui/react/macro"
import { cn } from "@/lib/utils"
import { useQuizzes } from "@/hooks/use-quizzes"
import { usePages } from "@/hooks/use-pages"
import type { QuizItem } from "@/api/client"
import { formatPageNumbers } from "../lib/format-page-numbers"

const PREVIEW_W = 288
const PREVIEW_H = 230

/** Floating card that previews the quiz itself (question + options). */
function QuizPreviewCard({ quiz }: { quiz: QuizItem }) {
  const { t } = useLingui()
  return (
    <div className="w-72 overflow-hidden rounded-lg border bg-card shadow-xl ring-1 ring-border">
      <div className="border-b bg-muted/30 px-3 py-2">
        <p className="line-clamp-3 text-xs font-semibold leading-snug text-foreground">
          {quiz.question || t`Untitled quiz`}
        </p>
      </div>
      <div className="flex flex-col gap-1 p-2">
        {quiz.options.map((option, i) => (
          <div
            key={i}
            className={cn(
              "flex items-start gap-1.5 rounded px-2 py-1 text-[11px] leading-snug",
              i === quiz.answerIndex
                ? "bg-emerald-50 text-emerald-700"
                : "bg-muted/40 text-muted-foreground",
            )}
          >
            {i === quiz.answerIndex ? (
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
            ) : (
              <Circle className="mt-0.5 h-3 w-3 shrink-0 opacity-40" />
            )}
            <span className="line-clamp-2">{option.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function QuizRow({
  quiz,
  index,
  isActive,
  pagesLabel,
  onSelect,
}: {
  quiz: QuizItem
  index: number
  isActive: boolean
  pagesLabel: string
  onSelect: () => void
}) {
  const { t } = useLingui()
  const rowRef = useRef<HTMLButtonElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (isActive) rowRef.current?.scrollIntoView({ block: "nearest" })
  }, [isActive])

  const handleEnter = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const el = rowRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const margin = 8
      const gap = 12
      const top = Math.max(
        margin,
        Math.min(rect.top, window.innerHeight - PREVIEW_H - margin),
      )
      const rightSide = rect.right + gap
      const leftSide = rect.left - PREVIEW_W - gap
      const left =
        rightSide + PREVIEW_W <= window.innerWidth - margin
          ? rightSide
          : Math.max(margin, leftSide)
      setPos({ top, left })
      setShowPreview(true)
    }, 300)
  }, [])

  const handleLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setShowPreview(false)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <button
      ref={rowRef}
      type="button"
      onClick={onSelect}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
      className={cn(
        "flex w-full items-start gap-2.5 px-2.5 py-2 text-left transition-colors",
        isActive
          ? "bg-orange-50 text-orange-700"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
          isActive
            ? "bg-orange-500 text-white"
            : "bg-muted text-muted-foreground",
        )}
      >
        <HelpCircle className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
        <span className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide opacity-60">
            {t`Quiz ${index + 1}`}
          </span>
          {pagesLabel && (
            <span className="flex items-center gap-0.5 text-[9px] leading-none opacity-50">
              <FileText className="h-2.5 w-2.5" />
              {pagesLabel}
            </span>
          )}
        </span>
        <span
          className={cn(
            "line-clamp-2 text-[11px] leading-snug",
            isActive && "font-medium",
          )}
        >
          {quiz.question || t`Untitled quiz`}
        </span>
      </div>

      {showPreview &&
        createPortal(
          <div
            className="fixed z-50 pointer-events-none animate-in fade-in duration-150"
            style={{ top: pos.top, left: pos.left }}
          >
            <QuizPreviewCard quiz={quiz} />
          </div>,
          document.body,
        )}
    </button>
  )
}

/**
 * Sidebar navigation for the Quizzes stage. Lists the generated quizzes (not the
 * book's pages). Each row previews the quiz itself, with a full question/answer
 * preview card on hover. Selecting a quiz navigates to the page it sits after.
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
  const { data } = useQuizzes(bookLabel)
  const { data: pages } = usePages(bookLabel)
  const quizzes = data?.quizzes?.quizzes ?? []

  const pageNumberById = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of pages ?? []) m.set(p.pageId, p.pageNumber)
    return m
  }, [pages])

  // When there are no quizzes the stage shows its landing page instead, and the
  // side panel stays closed — so there is nothing to render here.
  if (quizzes.length === 0) return null

  return (
    <div className="flex-1 overflow-y-auto py-1">
      {quizzes.map((quiz, i) => {
        const pageNumbers = quiz.pageIds
          .map((id) => pageNumberById.get(id))
          .filter((n): n is number => n != null)
        return (
          <QuizRow
            key={`${quiz.afterPageId}-${i}`}
            quiz={quiz}
            index={i}
            isActive={!!selectedPageId && quiz.afterPageId === selectedPageId}
            pagesLabel={formatPageNumbers(pageNumbers)}
            onSelect={() => onSelectPage?.(quiz.afterPageId)}
          />
        )
      })}
    </div>
  )
}
