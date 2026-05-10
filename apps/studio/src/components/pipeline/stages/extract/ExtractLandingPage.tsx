import { useState, useEffect, useCallback, useMemo } from "react"
import type { ReactNode } from "react"
import { ArrowDown, BookOpen, FileText, Image as ImageIcon, List, Type } from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import { useBook } from "@/hooks/use-books"
import { useSourcePdfInfo } from "@/hooks/use-source-pdf-info"
import { LandingPageShell } from "@/components/pipeline/components/LandingPageShell"
import { LandingPageWarning } from "@/components/pipeline/components/LandingPageWarning"
import { SettingsCard } from "@/components/pipeline/components/SettingsCard"
import { SettingExplainer } from "@/components/pipeline/components/SettingExplainer"
import { RangeSlider } from "@/components/ui/range-slider"
import { BrandedSwitch } from "@/components/ui/branded-switch"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { useBookConfig, useUpdateBookConfig } from "@/hooks/use-book-config"
import { useStageStatus } from "@/hooks/use-stage-status"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { cn } from "@/lib/utils"

type SpreadModeKey = "single" | "spread"

// eslint-disable-next-line lingui/no-unlocalized-strings -- CSS var, not user-visible
const ACCENT_VAR = `var(--accent-color, #525252)`
// eslint-disable-next-line lingui/no-unlocalized-strings -- pagination labels, identical across locales
const PAGE_LABELS = ["P1", "P2", "P3", "P4", "P5"] as const

export function ExtractLandingPage({ bookLabel }: { bookLabel: string }) {
  const { t } = useLingui()
  const { data: bookConfigData } = useBookConfig(bookLabel)
  const updateConfig = useUpdateBookConfig()
  const { apiKey, hasApiKey } = useApiKey()
  const { queueRun } = useBookRun()
  const status = useStageStatus("extract")
  const sectioningStatus = useStageStatus("sectioning")
  const storyboardStatus = useStageStatus("storyboard")
  const downstreamHasOutput =
    sectioningStatus.isCompleted ||
    sectioningStatus.isRunning ||
    storyboardStatus.isCompleted ||
    storyboardStatus.isRunning
  const { data: book } = useBook(bookLabel)
  const { data: sourcePdfInfo, isPending: sourcePdfPending } = useSourcePdfInfo(bookLabel)

  const totalPages = sourcePdfInfo?.pageCount ?? book?.pageCount ?? 0

  const [pageRange, setPageRange] = useState<[number, number]>([1, 1])
  const [spreadMode, setSpreadMode] = useState<SpreadModeKey>("single")
  const [vectorTextGrouping, setVectorTextGrouping] = useState(true)

  useEffect(() => {
    if (!bookConfigData) return
    const c = bookConfigData.config
    setSpreadMode(c.spread_mode === true ? "spread" : "single")
    setVectorTextGrouping(c.vector_text_grouping !== false)
    const start = c.start_page != null ? Number(c.start_page) : 1
    const end = c.end_page != null ? Number(c.end_page) : Math.max(start, totalPages || 1)
    setPageRange([start, end])
  }, [bookConfigData, totalPages])

  const persist = useCallback(
    (patch: Record<string, unknown>) => {
      const base = bookConfigData?.config ?? {}
      updateConfig.mutate({ label: bookLabel, config: { ...base, ...patch } })
    },
    [bookConfigData, bookLabel, updateConfig]
  )

  const handlePageRangeChange = ([start, end]: [number, number]) => {
    setPageRange([start, end])
    persist({ start_page: start, end_page: end })
  }

  const handleSpreadModeChange = (value: SpreadModeKey) => {
    setSpreadMode(value)
    persist({ spread_mode: value === "spread" })
  }

  const handleVectorTextChange = (next: boolean) => {
    setVectorTextGrouping(next)
    persist({ vector_text_grouping: next })
  }

  const spreadOptions = useMemo(
    () => [
      { value: "spread" as const, label: t`Spread` },
      { value: "single" as const, label: t`Single` },
    ],
    [t],
  )

  const pageRangeDisabled = sourcePdfPending || !totalPages

  const handleRun = () => {
    if (!hasApiKey || status.isRunning) return
    queueRun({ fromStage: "extract", toStage: "extract", apiKey })
  }

  const disabledReason = !hasApiKey ? (
    <Trans>Add an API key in Book settings to run extraction.</Trans>
  ) : undefined

  return (
    <LandingPageShell
      bookLabel={bookLabel}
      stageSlug="extract"
      settingsTab="general"
      colorClass="bg-blue-600 hover:bg-blue-700"
      accentColor="#2563eb"
      accentColorSoft="#dbeafe"
      isRunning={status.isRunning}
      isCompleted={status.isCompleted}
      hasError={status.hasError}
      canRun={true}
      extraDisabled={!hasApiKey}
      disabledReason={disabledReason}
      runLabel={<Trans>Run Extract</Trans>}
      rerunLabel={<Trans>Re-run</Trans>}
      previewLabel={t`Extract Preview`}
      onRun={handleRun}
      preview={
        <ExtractPreview
          bookTitle={book?.title ?? bookLabel}
          pageCount={totalPages || null}
        />
      }
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
          <Trans>Extract</Trans>
        </h1>
        <p className="text-[14px] text-[#737373] leading-relaxed">
          <Trans>
            Pull structured content from the source PDF. Extraction identifies
            headings, paragraphs, lists, and images so downstream stages work
            with clean, typed content instead of raw PDF.
          </Trans>
        </p>
      </div>

      <LandingPageWarning
        show={downstreamHasOutput}
        variant="cascade"
        title={<Trans>Re-running clears every later stage</Trans>}
        description={
          <Trans>
            Sectioning, Storyboard, and every Enhancement that has run
            (Captions, Quizzes, Glossary, TOC, Translation, Speech) plus
            Packaging will all be reset and need to run again before final
            outputs are available.
          </Trans>
        }
      />

      <SettingsCard>
        <RangeSlider
          label={t`Page Range`}
          tooltip={t`In case you don't want to convert the whole book, adjust the sliders to define which pages will be digitized.`}
          min={1}
          max={totalPages || 1}
          startLabel={t`Initial Page`}
          endLabel={t`Final Page`}
          value={pageRange}
          onChange={handlePageRangeChange}
          disabled={pageRangeDisabled}
        />
      </SettingsCard>

      <SettingsCard>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-foreground">
              <Trans>Page Grouping Mode</Trans>
            </span>
            <SettingExplainer visual={<PageGroupingVisual />} />
          </div>
          <SegmentedControl
            options={spreadOptions}
            value={spreadMode}
            onValueChange={handleSpreadModeChange}
          />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <Trans>
              Use Spread for printed books with facing-page layouts (covers
              stay solo, then 2+3, 4+5, …). Use Single when each PDF page
              should be processed on its own.
            </Trans>
          </p>
        </div>
      </SettingsCard>

      <FigureExtractionToggle
        checked={vectorTextGrouping}
        onCheckedChange={handleVectorTextChange}
      />
    </LandingPageShell>
  )
}

function NeutralPage({ label }: { label: ReactNode }) {
  return (
    <div className="flex h-[60px] w-7 items-center justify-center rounded border border-[#e5e5e5] bg-white text-[8px] font-medium text-[#a3a3a3]">
      {label}
    </div>
  )
}

function SpreadPair({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div
      className="relative flex h-[60px] w-[56px] overflow-hidden rounded border-2"
      style={{ borderColor: ACCENT_VAR }}
    >
      <div
        className="absolute inset-0"
        style={{ background: ACCENT_VAR, opacity: 0.1 }}
        aria-hidden
      />
      <div
        className="relative flex flex-1 items-center justify-center border-r border-dashed text-[8px] font-semibold"
        style={{ color: ACCENT_VAR, borderColor: ACCENT_VAR }}
      >
        {left}
      </div>
      <div
        className="relative flex flex-1 items-center justify-center text-[8px] font-semibold"
        style={{ color: ACCENT_VAR }}
      >
        {right}
      </div>
    </div>
  )
}

function SpreadPagesDiagram() {
  return (
    <div className="flex items-end justify-center gap-1.5">
      <NeutralPage label={<Trans>Cover</Trans>} />
      <SpreadPair left={PAGE_LABELS[1]} right={PAGE_LABELS[2]} />
      <SpreadPair left={PAGE_LABELS[3]} right={PAGE_LABELS[4]} />
    </div>
  )
}

function SinglePagesDiagram() {
  return (
    <div className="flex items-end justify-center gap-1.5">
      {PAGE_LABELS.map((label, i) => (
        <NeutralPage key={i} label={label} />
      ))}
    </div>
  )
}

function PageGroupingVisual() {
  return (
    <div className="flex flex-col gap-3 py-1">
      <DiagramWithLabel label={<Trans>Spread</Trans>}>
        <SpreadPagesDiagram />
      </DiagramWithLabel>
      <div
        className="mx-auto h-px w-16"
        style={{ background: ACCENT_VAR, opacity: 0.18 }}
        aria-hidden
      />
      <DiagramWithLabel label={<Trans>Single</Trans>}>
        <SinglePagesDiagram />
      </DiagramWithLabel>
    </div>
  )
}

function DiagramWithLabel({
  label,
  children,
}: {
  label: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      {children}
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: ACCENT_VAR }}
      >
        {label}
      </span>
    </div>
  )
}

function FigureExtractionToggle({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: (next: boolean) => void
}) {
  function toggle() {
    onCheckedChange(!checked)
  }

  return (
    <div
      role="switch"
      id="extract-figure-extraction"
      aria-checked={checked}
      aria-labelledby="extract-figure-extraction-title"
      aria-describedby="extract-figure-extraction-subtitle"
      tabIndex={0}
      className={cn(
        "flex w-full cursor-pointer select-none items-center justify-center gap-2.5 rounded-lg border px-4 py-3 shadow-sm transition-colors",
        "bg-white border-border",
        "hover:bg-muted hover:border-input",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault()
          toggle()
        }
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col items-start justify-center gap-0.5">
        <p
          id="extract-figure-extraction-title"
          className="select-none text-sm font-semibold leading-5 text-foreground"
        >
          <Trans>Figure Extraction</Trans>
        </p>
        <p
          id="extract-figure-extraction-subtitle"
          className="w-full select-none text-xs font-normal leading-4 text-muted-foreground"
        >
          <Trans>
            Detects complex charts and figures that contain a mix of text,
            vectors and images and crops them out of the page.
          </Trans>
        </p>
      </div>
      <BrandedSwitch
        id="extract-figure-extraction-switch"
        checked={checked}
        decorative
      />
    </div>
  )
}

function ExtractPreview({
  bookTitle,
  pageCount,
}: {
  bookTitle: string
  pageCount: number | null
}) {
  const totalPages = pageCount ?? 0
  const truncatedTitle =
    bookTitle.length > 32 ? `${bookTitle.slice(0, 32)}…` : bookTitle
  return (
    <div className="relative flex flex-1 min-h-0 overflow-hidden bg-gradient-to-b from-blue-50/40 via-white to-white">
      <div className="flex flex-col items-center w-full px-5 py-4 gap-3">
        {/* SOURCE PDF */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-blue-600" strokeWidth={2} />
            <span className="font-semibold text-[10px] tracking-[0.18em] uppercase text-blue-700">
              <Trans>Source PDF</Trans>
            </span>
          </div>
          <div className="w-[88px] aspect-[3/4] rounded-md bg-blue-50/80 ring-1 ring-blue-200 flex items-center justify-center">
            <BookOpen className="w-7 h-7 text-blue-300" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[11px] font-medium text-blue-700/90 truncate max-w-[200px]">
              {truncatedTitle}
            </span>
            {totalPages > 0 && (
              <span className="font-mono text-[9px] tabular-nums text-blue-500/70">
                <Trans>{totalPages} pages</Trans>
              </span>
            )}
          </div>
        </div>

        {/* CONNECTOR */}
        <div className="flex flex-col items-center" aria-hidden>
          <div className="w-px h-2 bg-blue-200" />
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white shadow-sm">
            <ArrowDown className="w-3 h-3" strokeWidth={2.5} />
          </div>
          <div className="w-px h-2 bg-blue-200" />
        </div>

        {/* EXTRACTED BLOCKS */}
        <div className="flex flex-col items-stretch w-full gap-1.5">
          <span className="font-semibold text-[10px] tracking-[0.18em] uppercase text-blue-700">
            <Trans>Extracted Blocks</Trans>
          </span>

          <BlockCard
            icon={<Type className="w-3 h-3" strokeWidth={2.25} />}
            label={<Trans>Heading</Trans>}
            highlighted
          >
            <p className="text-[12px] font-bold text-foreground leading-tight">
              <Trans>Section 3 · Overview</Trans>
            </p>
          </BlockCard>

          <BlockCard
            icon={<Type className="w-3 h-3" strokeWidth={2.25} />}
            label={<Trans>Paragraph</Trans>}
            meta={<Trans>22 words</Trans>}
          >
            <p className="text-[10px] text-muted-foreground leading-snug">
              <Trans>
                Each section introduces a new theme with worked examples,
                followed by short practice activities at the end of the page.
              </Trans>
            </p>
          </BlockCard>

          <BlockCard
            icon={<List className="w-3 h-3" strokeWidth={2.25} />}
            label={<Trans>List</Trans>}
            meta={<Trans>3 items</Trans>}
          >
            <ul className="text-[10px] text-muted-foreground leading-snug list-disc pl-3.5 space-y-[1px]">
              <li>
                <Trans>Read the prompt aloud</Trans>
              </li>
              <li>
                <Trans>Identify the key idea</Trans>
              </li>
              <li>
                <Trans>Try the practice problem</Trans>
              </li>
            </ul>
          </BlockCard>

          <BlockCard
            icon={<ImageIcon className="w-3 h-3" strokeWidth={2} />}
            label={<Trans>Image</Trans>}
            meta="842×320"
          >
            <div className="w-full h-9 rounded-[3px] bg-gradient-to-br from-blue-100 via-sky-100 to-indigo-100" />
          </BlockCard>

          <BlockCard
            icon={<Type className="w-3 h-3" strokeWidth={2.25} />}
            label={<Trans>Paragraph</Trans>}
            faded
          >
            <div className="flex flex-col gap-[3px]">
              <div className="h-[3px] w-full rounded-[1px] bg-blue-200/60" />
              <div className="h-[3px] w-[80%] rounded-[1px] bg-blue-200/60" />
            </div>
          </BlockCard>
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-center gap-2 mt-auto pt-1">
          <span className="tracking-[0.3em] text-[10px] font-bold text-blue-400">···</span>
          <span className="text-[10px] font-medium text-blue-600/70">
            <Trans>and many more blocks across the entire book</Trans>
          </span>
        </div>
      </div>
    </div>
  )
}

function BlockCard({
  icon,
  label,
  meta,
  highlighted = false,
  faded = false,
  children,
}: {
  icon: React.ReactNode
  label: React.ReactNode
  meta?: React.ReactNode
  highlighted?: boolean
  faded?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 flex flex-col gap-1.5 transition-colors",
        highlighted
          ? "border-blue-400/60 bg-blue-50/70"
          : faded
          ? "border-dashed border-blue-200/70 bg-white/60"
          : "border-blue-200 bg-white",
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn(faded ? "text-blue-400" : "text-blue-500")}>{icon}</span>
        <span
          className={cn(
            "font-semibold text-[8.5px] tracking-[0.16em] uppercase",
            faded ? "text-blue-500/70" : "text-blue-700",
          )}
        >
          {label}
        </span>
        {meta && (
          <span className="ml-auto font-mono text-[8.5px] text-blue-500/70 tabular-nums">
            {meta}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}
