import { useCallback, useEffect, useRef, useState } from "react"
import { AlignLeft, ArrowLeft, ArrowRight, BookOpen, Building2, FileText, Globe, Image, Loader2, Play, RotateCcw, User, FileSearch, ArrowRight as ArrowRightIcon } from "lucide-react"
import { Trans } from "@lingui/react/macro"
import { useLingui } from "@lingui/react/macro"
import { useBook } from "@/hooks/use-books"
import { usePages, usePageImage } from "@/hooks/use-pages"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { ExtractPageDetail } from "./components/ExtractPageDetail"
import { useStepHeader } from "../../components/StepViewRouter"
import { getStepLabelI18n } from "../../pipeline-i18n"
import { PIPELINE } from "@adt/types"
import type { PageSummaryItem } from "@/api/client"

/** Returns true once the element has scrolled into view. */
function useInView(): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin: "200px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, inView]
}

function PageCard({
  bookLabel,
  page,
  onClick,
}: {
  bookLabel: string
  page: PageSummaryItem
  onClick: () => void
}) {
  const { t } = useLingui()
  const [ref, inView] = useInView()
  const { data: imageData, isLoading: imageLoading } = usePageImage(
    bookLabel,
    page.pageId,
    { enabled: inView },
  )

  return (
    <div ref={ref}>
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col w-full rounded-lg border bg-card overflow-hidden hover:border-blue-300 transition-colors cursor-pointer text-left"
    >
      {/* Page image — fixed aspect ratio so all cards in a row match */}
      <div className="w-full aspect-[3/4] bg-muted/30">
        {!inView || imageLoading ? (
          <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
            ...
          </div>
        ) : imageData ? (
          <img
            src={`data:image/png;base64,${imageData.imageBase64}`}
            alt={t`Page ${String(page.pageNumber)}`}
            className="w-full h-full object-contain block"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
            <Trans>No image</Trans>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-2.5 py-2 border-t">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs font-medium"><Trans>Page {String(page.pageNumber)}</Trans></span>
          <div className="flex items-center gap-2">
            {page.wordCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <AlignLeft className="h-2.5 w-2.5" />
                {page.wordCount}
              </span>
            )}
            {page.imageCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Image className="h-2.5 w-2.5" />
                {page.imageCount}
              </span>
            )}
          </div>
        </div>
        <p className="line-clamp-2 text-[11px] text-muted-foreground leading-relaxed">
          {page.textPreview?.replace(/\n/g, " ") || t`No text extracted`}
        </p>
      </div>
    </button>
    </div>
  )
}


function ExtractWelcome({ bookLabel, onRun, isRunning, isError, disabled }: {
  bookLabel: string
  onRun: () => void
  isRunning: boolean
  isError: boolean
  disabled: boolean
}) {
  const { t } = useLingui()
  const { data: book } = useBook(bookLabel)
  const { stepState, stepProgress, stepError } = useBookRun()

  const extractStage = PIPELINE.find((s) => s.name === "extract")
  const steps = extractStage?.steps ?? []
  const title = book?.title ?? book?.metadata?.title ?? bookLabel

  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <div className="w-full max-w-md flex flex-col items-center text-center">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-5">
          <FileSearch className="w-8 h-8 text-blue-500" />
        </div>

        {/* Title & subtitle */}
        <h2 className="text-lg font-semibold tracking-tight mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-sm">
          {isError
            ? <Trans>Extraction failed. You can retry to extract content from your PDF.</Trans>
            : <Trans>Extract text, images, and document structure from your PDF to start building the book.</Trans>
          }
        </p>

        {/* Run button */}
        <button
          type="button"
          onClick={onRun}
          disabled={disabled}
          className={`
            inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-medium
            transition-all duration-200 cursor-pointer
            ${isRunning
              ? "bg-blue-50 text-blue-600 cursor-default"
              : isError
                ? "bg-red-500 text-white hover:bg-red-600 active:scale-[0.98] shadow-md shadow-red-500/20"
                : "bg-blue-500 text-white hover:bg-blue-600 active:scale-[0.98] shadow-md shadow-blue-500/20"
            }
            disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100
          `}
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <Trans>Extracting...</Trans>
            </>
          ) : isError ? (
            <>
              <RotateCcw className="w-4 h-4" />
              <Trans>Retry extraction</Trans>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <Trans>Run extraction</Trans>
            </>
          )}
        </button>

        {/* Step progress (shown while running) */}
        {isRunning && (
          <div className="mt-6 w-full max-w-xs">
            <div className="space-y-1.5">
              {steps.map((step) => {
                const state = stepState(step.name)
                const progress = stepProgress(step.name)
                const error = stepError(step.name)
                const isDone = state === "done"
                const isActive = state === "running"
                const isFailed = state === "error"

                return (
                  <div key={step.name} className="flex items-center gap-2 text-xs">
                    <div className="w-4 h-4 flex items-center justify-center shrink-0">
                      {isDone ? (
                        <div className="w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center">
                          <svg className="w-2 h-2 text-white" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      ) : isActive ? (
                        <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                      ) : isFailed ? (
                        <div className="w-3.5 h-3.5 rounded-full bg-red-500 flex items-center justify-center">
                          <svg className="w-2 h-2 text-white" viewBox="0 0 12 12" fill="none">
                            <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/20" />
                      )}
                    </div>
                    <span className={`flex-1 ${isActive ? "text-foreground font-medium" : isDone ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
                      {getStepLabelI18n(step.name)}
                    </span>
                    {progress && (progress.totalPages ?? 0) > 0 && isActive && (
                      <span className="text-muted-foreground tabular-nums">
                        {progress.page ?? 0}/{progress.totalPages}
                      </span>
                    )}
                    {isFailed && error && (
                      <span className="text-red-500 truncate max-w-[140px]" title={error}>{error}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Error detail */}
        {isError && !isRunning && (
          <div className="mt-4 w-full max-w-xs">
            {steps.map((step) => {
              const error = stepError(step.name)
              if (!error) return null
              return (
                <div key={step.name} className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  <span className="font-medium">{getStepLabelI18n(step.name)}:</span> {error}
                </div>
              )
            })}
          </div>
        )}

        {/* What happens next */}
        {!isRunning && !isError && (
          <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground/60">
            <ArrowRightIcon className="w-3 h-3" />
            <Trans>After extraction, your content flows into the Storyboard for layout.</Trans>
          </div>
        )}
      </div>
    </div>
  )
}

function BookBanner({ bookLabel, pages, metadataRunning }: { bookLabel: string; pages: PageSummaryItem[] | undefined; metadataRunning?: boolean }) {
  const { t } = useLingui()
  const { data: book } = useBook(bookLabel)
  const coverPageNumber = book?.metadata?.cover_page_number ?? 1
  const coverPage = pages?.find((p) => p.pageNumber === coverPageNumber)
  const { data: coverImage } = usePageImage(bookLabel, coverPage?.pageId ?? "")

  if (!book) return null

  const title = book.title ?? book.metadata?.title ?? bookLabel
  const authors = book.metadata?.authors?.join(", ")
  const publisher = book.publisher ?? book.metadata?.publisher
  const language = book.languageCode ?? book.metadata?.language_code

  return (
    <div className="flex gap-5 items-start p-4 pb-0">
      {/* Cover thumbnail */}
      <div className="shrink-0 w-24 rounded-md overflow-hidden shadow-sm bg-muted">
        {coverImage ? (
          <img
            src={`data:image/png;base64,${coverImage.imageBase64}`}
            alt={t`Cover of ${title}`}
            className="w-full h-auto block"
          />
        ) : (
          <div className="w-full aspect-[3/4] flex items-center justify-center text-muted-foreground">
            <BookOpen className="w-8 h-8" />
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="flex-1 min-w-0 space-y-2">
        <h3 className="text-lg font-semibold tracking-tight truncate">{title}</h3>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {authors && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {authors}
            </span>
          )}
          {publisher && (
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {publisher}
            </span>
          )}
          {language && (
            <span className="flex items-center gap-1">
              <Globe className="w-3 h-3" />
              {language}
            </span>
          )}
          {book.pageCount > 0 && (
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {book.pageCount} {book.pageCount === 1 ? t`page` : t`pages`}
            </span>
          )}
        </div>
        {book.bookSummary?.summary && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {book.bookSummary.summary}
          </p>
        )}
        {metadataRunning && !book.metadata && (
          <div className="flex items-center gap-2 rounded border border-dashed p-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            <Trans>Processing metadata…</Trans>
          </div>
        )}
      </div>
    </div>
  )
}

export function ExtractView({ bookLabel, selectedPageId: selectedPageIdProp, onSelectPage }: { bookLabel: string; selectedPageId?: string; onSelectPage?: (pageId: string | null) => void }) {
  const { t } = useLingui()
  const { data: pages, isLoading } = usePages(bookLabel)
  const { stageState, stepState, queueRun } = useBookRun()
  const { apiKey, hasApiKey } = useApiKey()
  const selectedPageId = selectedPageIdProp ?? null
  const setSelectedPageId = onSelectPage ?? (() => {})
  const { setExtra, setOnLabelClick } = useStepHeader()
  const extractState = stageState("extract")
  const extractDone = extractState === "done"
  const extractRunning = extractState === "running" || extractState === "queued"
  const extractError = extractState === "error"
  const metadataRunning = stepState("metadata") === "running"
  // Show pages progressively: once pages appear in the DB (during or after
  // the PDF extraction step), display the grid. Only show the run card when
  // no pages exist yet — remaining steps run in the background TaskIndicator.
  const hasPages = (pages ?? []).length > 0
  const showRunCard = extractError
    ? true
    : extractRunning
      ? !hasPages
      : !extractDone

  const handleRetryExtract = useCallback(() => {
    if (!hasApiKey || extractRunning) return
    queueRun({ fromStage: "extract", toStage: "extract", apiKey })
  }, [hasApiKey, extractRunning, apiKey, queueRun])

  const pageList = pages ?? []
  const currentIndex = selectedPageId ? pageList.findIndex((p) => p.pageId === selectedPageId) : -1
  const selectedPage = currentIndex >= 0 ? pageList[currentIndex] : null
  const prevPageId = currentIndex > 0 ? pageList[currentIndex - 1].pageId : null
  const nextPageId = currentIndex < pageList.length - 1 ? pageList[currentIndex + 1].pageId : null

  // Header breadcrumb + navigation
  useEffect(() => {
    if (showRunCard) {
      setOnLabelClick(null)
      setExtra(null)
      return () => {
        setExtra(null)
        setOnLabelClick(null)
      }
    }

    if (selectedPage) {
      setOnLabelClick(() => setSelectedPageId(null))
      setExtra(
        <>
          <span className="text-white/40 text-sm">/</span>
          <span className="text-sm font-medium">{t`Page ${String(selectedPage.pageNumber)}`}</span>
          <div className="ml-auto flex gap-1">
            <button
              type="button"
              className="flex items-center justify-center w-7 h-7 rounded bg-white/15 hover:bg-white/25 transition-colors disabled:opacity-30 disabled:cursor-default"
              disabled={!prevPageId}
              onClick={() => prevPageId && setSelectedPageId(prevPageId)}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="flex items-center justify-center w-7 h-7 rounded bg-white/15 hover:bg-white/25 transition-colors disabled:opacity-30 disabled:cursor-default"
              disabled={!nextPageId}
              onClick={() => nextPageId && setSelectedPageId(nextPageId)}
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      )
    } else if (pageList.length > 0 && !showRunCard) {
      setOnLabelClick(null)
      setExtra(
        <span className="ml-auto text-[11px] font-medium bg-white/20 rounded-full px-2.5 py-0.5">
          {pageList.length} {pageList.length === 1 ? t`page` : t`pages`}
        </span>
      )
    } else {
      setOnLabelClick(null)
      setExtra(null)
    }
    return () => {
      setExtra(null)
      setOnLabelClick(null)
    }
  }, [selectedPageId, selectedPage?.pageNumber, pageList.length, prevPageId, nextPageId, showRunCard, setExtra, setOnLabelClick, setSelectedPageId])

  // Keyboard arrow navigation
  useEffect(() => {
    if (!selectedPageId || showRunCard) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && prevPageId) {
        setSelectedPageId(prevPageId)
      } else if (e.key === "ArrowRight" && nextPageId) {
        setSelectedPageId(nextPageId)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedPageId, prevPageId, nextPageId, showRunCard, setSelectedPageId])

  if (!showRunCard && isLoading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <Trans>Loading pages...</Trans>
      </div>
    )
  }

  // Page detail view — available once pages exist (even while later steps run)
  if (!showRunCard && selectedPageId && pages) {
    return (
      <ExtractPageDetail
        bookLabel={bookLabel}
        pageId={selectedPageId}
      />
    )
  }

  // Welcome / run card — full-height centered layout
  if (showRunCard) {
    return (
      <ExtractWelcome
        bookLabel={bookLabel}
        onRun={handleRetryExtract}
        isRunning={extractRunning}
        isError={extractError}
        disabled={!hasApiKey || extractRunning}
      />
    )
  }

  // Page grid view
  return (
    <div>
      {pageList.length > 0 && <BookBanner bookLabel={bookLabel} pages={pages} metadataRunning={metadataRunning} />}
      <div className="p-4">
      {pageList.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          <Trans>No pages extracted yet. Run the pipeline to extract content.</Trans>
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {pageList.map((page) => (
            <PageCard
              key={page.pageId}
              bookLabel={bookLabel}
              page={page}
              onClick={() => setSelectedPageId(page.pageId)}
            />
          ))}
        </div>
      )}
      </div>
    </div>
  )
}
