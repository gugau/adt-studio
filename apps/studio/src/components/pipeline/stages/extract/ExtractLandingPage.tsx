import { FileText, Image as ImageIcon, Type, List, BookText, ArrowRight, BookOpen } from "lucide-react"
import { useNavigate } from "@tanstack/react-router"
import { useLingui } from "@lingui/react/macro"
import { Trans } from "@lingui/react/macro"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { useStageStatus } from "@/hooks/use-stage-status"
import { useBook } from "@/hooks/use-books"
import { usePages } from "@/hooks/use-pages"
import { LandingPageShell } from "../../components/LandingPageShell"
import { RunProgress } from "../../components/RunProgress"

// ─── Extract preview (book cover → extracted blocks, vertical) ─────────────

function ExtractPreview({ bookLabel }: { bookLabel: string }) {
  const { data: book } = useBook(bookLabel)
  const title = book?.title ?? book?.metadata?.title ?? bookLabel
  const totalPages = book?.pageCount ?? null

  /* eslint-disable lingui/no-unlocalized-strings */
  return (
    <div className="relative flex flex-1 min-h-0 overflow-hidden bg-gradient-to-b from-blue-50/30 via-white to-blue-50/20">
      <div className="flex flex-1 flex-col items-center gap-3 px-5 py-5 overflow-hidden">

        {/* Top: book cover (real PDF cover) */}
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1 self-stretch">
            <FileText className="w-3 h-3 text-blue-600" />
            <span className="text-[8px] font-semibold text-blue-800 uppercase tracking-wide">
              Source PDF
            </span>
            {book?.pageCount ? (
              <span className="ml-auto text-[7.5px] text-blue-500/70 tabular-nums">
                {book.pageCount} pages
              </span>
            ) : null}
          </div>
          <div className="w-[110px] aspect-[3/4] rounded-md overflow-hidden shadow-md ring-1 ring-blue-200 bg-white transition-all">
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
              <BookOpen className="w-8 h-8 text-blue-300" />
            </div>
          </div>
          <span className="text-[8px] text-blue-700/70 max-w-[140px] text-center truncate">
            {title}
          </span>
        </div>

        {/* Arrow divider — pointing down */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="w-[1px] h-2 bg-blue-300" />
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white shadow-md">
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M6 13l6 6 6-6" />
            </svg>
          </div>
          <div className="w-[1px] h-2 bg-blue-300" />
        </div>

        {/* Bottom: extracted blocks (representative types) */}
        <div className="flex-1 min-h-0 w-full flex flex-col gap-1.5 overflow-hidden">
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[8px] font-semibold text-blue-800 uppercase tracking-wide">
              Extracted blocks
            </span>
          </div>

          {/* Heading */}
          <div className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1.5">
            <div className="flex items-center gap-1 mb-0.5">
              <Type className="w-2.5 h-2.5 text-blue-600" />
              <span className="text-[7px] font-semibold text-blue-800 uppercase tracking-wide">Heading</span>
            </div>
            <p className="text-[8.5px] font-bold text-foreground leading-tight">Chapter 2: Photosynthesis</p>
          </div>

          {/* Paragraph */}
          <div className="rounded-md border border-blue-200 bg-white px-2 py-1.5">
            <div className="flex items-center gap-1 mb-0.5">
              <Type className="w-2.5 h-2.5 text-blue-500" />
              <span className="text-[7px] font-semibold text-blue-700 uppercase tracking-wide">Paragraph</span>
              <span className="ml-auto text-[7px] text-blue-400 tabular-nums">25 words</span>
            </div>
            <p className="text-[7.5px] leading-[10px] text-foreground/70">
              Plants convert sunlight into chemical energy through a complex series of reactions known as photosynthesis...
            </p>
          </div>

          {/* List */}
          <div className="rounded-md border border-blue-200 bg-white px-2 py-1.5">
            <div className="flex items-center gap-1 mb-0.5">
              <List className="w-2.5 h-2.5 text-blue-500" />
              <span className="text-[7px] font-semibold text-blue-700 uppercase tracking-wide">List</span>
              <span className="ml-auto text-[7px] text-blue-400 tabular-nums">3 items</span>
            </div>
            <ul className="text-[7.5px] leading-[10px] text-foreground/70 list-disc pl-3 space-y-[1px]">
              <li>Light intensity</li>
              <li>Temperature</li>
              <li>CO₂ concentration</li>
            </ul>
          </div>

          {/* Image */}
          <div className="rounded-md border border-blue-200 bg-white px-2 py-1.5">
            <div className="flex items-center gap-1 mb-1">
              <ImageIcon className="w-2.5 h-2.5 text-blue-500" />
              <span className="text-[7px] font-semibold text-blue-700 uppercase tracking-wide">Image</span>
              <span className="ml-auto text-[7px] text-blue-400 tabular-nums">842×320</span>
            </div>
            <div className="w-full h-8 rounded bg-gradient-to-br from-emerald-100 via-green-100 to-amber-100 border border-green-200/60" />
          </div>

          {/* Ghost chip — fades out, signaling more content across the book */}
          <div className="relative rounded-md border border-dashed border-blue-200/70 bg-white/40 px-2 py-1.5 opacity-60">
            <div className="flex items-center gap-1 mb-0.5">
              <Type className="w-2.5 h-2.5 text-blue-400" />
              <span className="text-[7px] font-semibold text-blue-500 uppercase tracking-wide">Paragraph</span>
            </div>
            <div className="flex flex-col gap-[2px]">
              <div className="h-[3px] w-full rounded-sm bg-blue-200/70" />
              <div className="h-[3px] w-4/5 rounded-sm bg-blue-200/70" />
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 pt-0.5 pb-1 shrink-0">
            <span className="tracking-[2px] text-[10px] font-bold text-blue-400">···</span>
            <span className="text-[8px] font-medium text-blue-600/70">
              {totalPages != null && totalPages > 0 ? (
                <Trans>and many more blocks across {totalPages} pages</Trans>
              ) : (
                <Trans>and many more blocks across the entire book</Trans>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
  /* eslint-enable lingui/no-unlocalized-strings */
}

// ─── Main landing page ────────────────────────────────────────────────────────

export function ExtractLandingPage({
  bookLabel,
}: {
  bookLabel: string
}) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const { queueRun } = useBookRun()
  const { apiKey, hasApiKey } = useApiKey()
  const { isRunning, isCompleted, hasError } = useStageStatus("extract")
  const { data: book } = useBook(bookLabel)
  const { data: pages } = usePages(bookLabel)

  const totalPages = pages?.length ?? null
  const totalImages = pages?.reduce((sum, p) => sum + p.imageCount, 0) ?? null
  const totalWords = pages?.reduce((sum, p) => sum + p.wordCount, 0) ?? null
  const hasExtractedData = (totalPages ?? 0) > 0

  const handleRun = () => {
    if (!hasApiKey || isRunning) return
    queueRun({ fromStage: "extract", toStage: "extract", apiKey })
  }

  const handleContinue = () => {
    void navigate({
      to: "/books/$label/$step",
      params: { label: bookLabel, step: "storyboard" },
    })
  }

  return (
    <LandingPageShell
      bookLabel={bookLabel}
      stageSlug="extract"
      colorClass="bg-blue-600 hover:bg-blue-700"
      isRunning={isRunning}
      isCompleted={isCompleted}
      hasError={hasError}
      canRun={true}
      extraDisabled={!hasApiKey}
      disabledReason={
        !hasApiKey ? (
          <Trans>Add an OpenAI API key in settings to run this stage.</Trans>
        ) : undefined
      }
      runLabel={<Trans>Run Extract</Trans>}
      rerunLabel={<Trans>Re-run</Trans>}
      previewLabel={t`Extract Preview`}
      onRun={handleRun}
      preview={
        isRunning ? (
          <div className="flex flex-1 items-center justify-center">
            <RunProgress stepKey="extract" spinnerColorClass="text-blue-500" />
          </div>
        ) : (
          <ExtractPreview bookLabel={bookLabel} />
        )
      }
    >
      {/* Title + description */}
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
          <Trans>Extract</Trans>
        </h1>
        <p className="text-[14px] text-[#737373] leading-relaxed">
          <Trans>
            Pull structured content from the source PDF. The extract pipeline
            identifies headings, paragraphs, lists, and images on each page so
            downstream stages can work with clean, typed content instead of raw
            PDF.
          </Trans>
        </p>
      </div>

      {/* Book context card */}
      {book && (
        <div className="flex items-center gap-3 rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-4 py-3 transition-colors">
          <div className="shrink-0 rounded-md bg-blue-100 p-2">
            <BookText className="w-4 h-4 text-blue-700" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[13px] font-medium text-[#0a0a0a] truncate">
              {book.title ?? bookLabel}
            </span>
            <span className="text-[11px] text-[#737373] tabular-nums">
              {book.pageCount > 0 ? (
                <Trans>{book.pageCount} pages in source PDF</Trans>
              ) : (
                <Trans>Source PDF</Trans>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Completion summary — only after extract has produced pages */}
      {isCompleted && hasExtractedData && (
        <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white px-5 py-4 transition-all">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[12px] font-semibold text-emerald-700 uppercase tracking-wider">
              <Trans>Extraction complete</Trans>
            </span>
          </div>
          <div className="flex gap-3">
            <div className="flex flex-col gap-0.5 rounded-lg bg-white border border-blue-100 px-3 py-2.5 flex-1">
              <span className="text-[10px] font-medium text-[#a3a3a3] uppercase tracking-wider">
                <Trans>Pages</Trans>
              </span>
              <span className="text-[18px] font-semibold text-[#0a0a0a] tabular-nums leading-none">
                {totalPages}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-lg bg-white border border-blue-100 px-3 py-2.5 flex-1">
              <span className="text-[10px] font-medium text-[#a3a3a3] uppercase tracking-wider">
                <Trans>Images</Trans>
              </span>
              <span className="text-[18px] font-semibold text-[#0a0a0a] tabular-nums leading-none">
                {totalImages}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-lg bg-white border border-blue-100 px-3 py-2.5 flex-1">
              <span className="text-[10px] font-medium text-[#a3a3a3] uppercase tracking-wider">
                <Trans>Words</Trans>
              </span>
              <span className="text-[18px] font-semibold text-[#0a0a0a] tabular-nums leading-none">
                {totalWords?.toLocaleString() ?? 0}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleContinue}
            className="group flex items-center justify-between gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-[13px] font-medium transition-colors"
          >
            <span>
              <Trans>Continue to Storyboard</Trans>
            </span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      )}

      {/* Info banner — hide when completion summary is showing */}
      {!(isCompleted && hasExtractedData) && (
        <div className="rounded-xl bg-blue-50 px-5 py-4">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="shrink-0 rounded-full bg-blue-100 p-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <span className="text-[13px] font-semibold text-blue-900">
              <Trans>Required by every later stage</Trans>
            </span>
          </div>
          <p className="text-[12.5px] text-blue-800/80 leading-relaxed pl-[34px]">
            <Trans>
              Storyboard, quizzes, translation, and speech all depend on the
              output of extraction.
            </Trans>
          </p>
        </div>
      )}
    </LandingPageShell>
  )
}
