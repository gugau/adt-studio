import { useState, useEffect, useCallback, useMemo } from "react"
import { Trans, useLingui } from "@lingui/react/macro"
import { useBook } from "@/hooks/use-books"
import { useSourcePdfInfo } from "@/hooks/use-source-pdf-info"
import { LandingPageShell } from "@/components/pipeline/components/LandingPageShell"
import { SettingsCard } from "@/components/pipeline/components/SettingsCard"
import { RangeSlider } from "@/components/ui/range-slider"
import { BrandedSwitch } from "@/components/ui/branded-switch"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { useBookConfig, useUpdateBookConfig } from "@/hooks/use-book-config"
import { useStageStatus } from "@/hooks/use-stage-status"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { cn } from "@/lib/utils"

type SpreadModeKey = "single" | "spread"

export function ExtractLandingPage({ bookLabel }: { bookLabel: string }) {
  const { t } = useLingui()
  const { data: bookConfigData } = useBookConfig(bookLabel)
  const updateConfig = useUpdateBookConfig()
  const { apiKey, hasApiKey } = useApiKey()
  const { queueRun } = useBookRun()
  const status = useStageStatus("extract")
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
          <span className="text-sm font-medium text-foreground">
            <Trans>Page Grouping Mode</Trans>
          </span>
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
  pageCount,
}: {
  bookTitle: string
  pageCount: number | null
}) {
  const totalPages = pageCount ?? 47
  return (
    <div
      className="relative flex flex-1 min-h-0 overflow-hidden"
      style={{
        backgroundColor: "#f5f5f4",
        backgroundImage:
          "linear-gradient(to right, rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.05) 1px, transparent 1px)",
        backgroundSize: "14px 14px",
      }}
    >
      <div
        className="absolute pointer-events-none"
        style={{
          inset: 0,
          backgroundImage:
            "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.85), transparent 60%)",
        }}
      />

      <div className="relative flex flex-1 items-stretch justify-center px-4 py-4">
        {/* Page sheet */}
        <div
          className="relative w-full max-w-[460px] bg-[#fdfdfb]"
          style={{
            boxShadow:
              "0 1px 0 rgba(15,23,42,0.04), 0 12px 28px -8px rgba(15,23,42,0.18)",
          }}
        >
          <CornerTick className="absolute -top-px -left-px" />
          <CornerTick className="absolute -top-px -right-px rotate-90" />
          <CornerTick className="absolute -bottom-px -left-px -rotate-90" />
          <CornerTick className="absolute -bottom-px -right-px rotate-180" />

          <div
            className="absolute top-2 right-3 font-mono text-[8px] tracking-[0.18em] text-neutral-400 uppercase"
            aria-hidden
          >
            <Trans>Page</Trans> 01 / {String(totalPages).padStart(2, "0")}
          </div>

          {/* Page body — 5/8 content column, 3/8 inspector margin */}
          <div className="grid h-full grid-cols-[1fr_120px] gap-3 px-5 pt-9 pb-6">
            <div className="flex flex-col gap-3 min-w-0">
              {/* Title — annotated as METADATA */}
              <div className="relative">
                <div className="absolute -inset-x-1 -inset-y-1 border border-blue-500/40 pointer-events-none" />
                <div className="absolute -top-2 left-1 px-1 bg-[#fdfdfb] font-mono text-[7.5px] tracking-[0.18em] text-blue-600 uppercase">
                  <Trans>Metadata</Trans>
                </div>
                <h2 className="text-[15px] font-semibold leading-tight tracking-tight text-[#0a0a0a] pt-0.5">
                  <Trans>Photosynthesis 101</Trans>
                </h2>
                <p className="text-[9px] text-[#525252] mt-1 font-medium">
                  <Trans>J. Olsen · M. Bose · 2021</Trans>
                </p>
              </div>

              <BodyText widths={["100%", "94%", "88%"]} />

              {/* KEPT image */}
              <div className="relative">
                <div
                  className="aspect-[16/8] rounded-[2px] ring-1 ring-emerald-500/70"
                  style={{
                    background:
                      "linear-gradient(135deg, #d1fae5 0%, #ccfbf1 45%, #dbeafe 100%)",
                  }}
                />
                <CropTicks className="absolute -inset-1.5 text-emerald-500/60" />
              </div>

              <BodyText widths={["96%", "90%", "70%"]} />

              {/* SEGMENTED image */}
              <div className="relative">
                <div
                  className="aspect-[16/10] rounded-[2px] ring-1 ring-dashed ring-violet-500/70 relative overflow-hidden"
                  style={{
                    background:
                      "linear-gradient(135deg, #ede9fe 0%, #f5f3ff 60%, #fef3c7 100%)",
                  }}
                >
                  <div className="absolute inset-0 flex">
                    <div className="flex-[3] border-r border-dashed border-violet-500/40" />
                    <div className="flex-[2]" />
                  </div>
                </div>
              </div>

              <BodyText widths={["88%", "60%"]} />

              {/* PRUNED decoration */}
              <div className="flex items-center gap-2">
                <div className="relative inline-flex items-center justify-center w-5 h-5 opacity-40 line-through">
                  <span className="text-neutral-400 text-base leading-none">✦</span>
                  <span className="absolute inset-0 ring-1 ring-dashed ring-neutral-400/60 rounded-[2px]" />
                </div>
              </div>
            </div>

            {/* Inspector margin — connectors + labels */}
            <div className="relative flex flex-col gap-3 min-w-0">
              <div className="absolute left-0 top-0 bottom-0 w-px bg-neutral-200" aria-hidden />

              <Finding
                color="blue"
                tag={<Trans>Title</Trans>}
                value={<Trans>Photosynthesis 101</Trans>}
                offsetTop={0}
              />

              <Finding
                color="blue"
                tag={<Trans>Authors</Trans>}
                value={<Trans>J. Olsen + 1</Trans>}
                offsetTop={36}
              />

              <Finding
                color="blue"
                tag={<Trans>Lang</Trans>}
                value="EN"
                offsetTop={72}
              />

              <Finding
                color="emerald"
                tag={<Trans>Kept</Trans>}
                value={<Trans>chart_02.png</Trans>}
                offsetTop={144}
              />

              <Finding
                color="violet"
                tag={<Trans>Segmented → 2</Trans>}
                offsetTop={236}
                splits={[<Trans key="a">chart</Trans>, <Trans key="b">legend</Trans>]}
              />

              <Finding
                color="neutral"
                tag={<Trans>Pruned</Trans>}
                value={<Trans>low complexity</Trans>}
                offsetTop={360}
              />
            </div>
          </div>

          {/* Footer — book ribbon */}
          <div className="absolute bottom-2 left-5 right-5 flex items-center gap-2 font-mono text-[8px] tracking-[0.16em] uppercase text-neutral-400">
            <span className="h-px flex-1 bg-neutral-200" />
            <span className="text-blue-600/80">
              <Trans>Extract</Trans>
            </span>
            <span>·</span>
            <span>{totalPages} <Trans>pages</Trans></span>
            <span className="h-px flex-1 bg-neutral-200" />
          </div>
        </div>
      </div>
    </div>
  )
}

function BodyText({ widths }: { widths: string[] }) {
  return (
    <div className="flex flex-col gap-[5px]">
      {widths.map((w, i) => (
        <div
          key={i}
          className="h-[3px] rounded-[1px] bg-neutral-200/80"
          style={{ width: w }}
        />
      ))}
    </div>
  )
}

function CornerTick({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      <svg width="10" height="10" viewBox="0 0 10 10" className="text-blue-600/40">
        <path
          d="M0 1 L0 0 L1 0"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
        />
      </svg>
    </div>
  )
}

function CropTicks({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="0" y1="0" x2="6" y2="0" stroke="currentColor" />
        <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" />
        <line x1="100" y1="0" x2="94" y2="0" stroke="currentColor" />
        <line x1="100" y1="0" x2="100" y2="6" stroke="currentColor" />
        <line x1="0" y1="100" x2="6" y2="100" stroke="currentColor" />
        <line x1="0" y1="100" x2="0" y2="94" stroke="currentColor" />
        <line x1="100" y1="100" x2="94" y2="100" stroke="currentColor" />
        <line x1="100" y1="100" x2="100" y2="94" stroke="currentColor" />
      </svg>
    </div>
  )
}

function Finding({
  color,
  tag,
  value,
  offsetTop,
  splits,
}: {
  color: "blue" | "emerald" | "violet" | "neutral"
  tag: React.ReactNode
  value?: React.ReactNode
  offsetTop: number
  splits?: React.ReactNode[]
}) {
  const colorMap = {
    blue: { dot: "bg-blue-500", text: "text-blue-600", chip: "bg-blue-50 ring-blue-200" },
    emerald: { dot: "bg-emerald-500", text: "text-emerald-600", chip: "bg-emerald-50 ring-emerald-200" },
    violet: { dot: "bg-violet-500", text: "text-violet-600", chip: "bg-violet-50 ring-violet-200" },
    neutral: { dot: "bg-neutral-400", text: "text-neutral-500", chip: "bg-neutral-50 ring-neutral-200" },
  }
  const c = colorMap[color]
  return (
    <div
      className="absolute flex flex-col gap-1 pl-3"
      style={{ top: `${offsetTop}px`, left: 0, right: 0 }}
    >
      <div className="absolute left-0 top-[7px] w-2 h-px bg-neutral-300" aria-hidden />
      <div className={`absolute -left-[2px] top-[5px] w-[5px] h-[5px] rounded-full ${c.dot}`} aria-hidden />
      <div className="flex items-center gap-1.5">
        <span
          className={`font-mono text-[7.5px] tracking-[0.18em] uppercase ${c.text}`}
        >
          {tag}
        </span>
      </div>
      {value && (
        <span className="font-mono text-[8.5px] text-neutral-700 truncate">
          {value}
        </span>
      )}
      {splits && (
        <div className="flex flex-wrap gap-1">
          {splits.map((s, i) => (
            <span
              key={i}
              className={`inline-flex items-center font-mono text-[7.5px] px-1 py-px rounded-sm ring-1 ${c.chip} ${c.text}`}
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
