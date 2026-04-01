import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { ImageProcessingPreviewFocus } from "./imageProcessingPreviewTypes"

function PreviewShell({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "@container flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md bg-white shadow-[0px_17px_38px_0px_rgba(0,0,0,0.1),0px_69px_69px_0px_rgba(0,0,0,0.09),0px_155px_93px_0px_rgba(0,0,0,0.05)]",
        className,
      )}
    >
      <div className="shrink-0 border-b border-border/80 bg-muted/25 px-3 py-2">
        <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-[#fafafa]">{children}</div>
    </div>
  )
}

function IdleIllustration() {
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-6 px-6 py-8">
      <div className="flex gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-border bg-white text-muted-foreground">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 7h16M4 12h10M4 17h14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-border bg-white text-muted-foreground">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3" y="5" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="13" y="11" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
      </div>
      <div className="max-w-[280px] text-center">
        <p className="text-base font-semibold text-foreground">Preview</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Hover a setting to see how LLM cropping, segmentation, or the size threshold changes extracted
          images.
        </p>
      </div>
    </div>
  )
}

/** Before: noisy margins; after: tight crop around the illustration. */
function CroppingIllustration() {
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-6 px-4 py-6 @sm:flex-row @sm:gap-8 @sm:px-6">
      <div className="flex flex-col items-center gap-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Before</span>
        <div className="relative rounded-xl border-2 border-dashed border-amber-300/70 bg-amber-50/40 p-4 transition-shadow">
          <div className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded bg-amber-100/80 px-1 py-px">
            <svg className="h-2.5 w-2.5 text-amber-600/70" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-[7px] font-medium text-amber-600/80">margin</span>
          </div>
          <div className="relative h-[100px] w-[120px] overflow-hidden rounded-md bg-gradient-to-br from-sky-300 via-amber-200 to-emerald-400 shadow-inner" aria-hidden>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.3),transparent_60%)]" />
          </div>
          <div className="absolute -right-1.5 top-1/2 flex -translate-y-1/2 items-center rounded-sm bg-red-400/80 px-1 py-0.5 shadow-sm">
            <span className="text-[6px] font-bold text-white">ABC</span>
          </div>
          <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 rounded bg-amber-100/80 px-1 py-px">
            <span className="text-[7px] font-medium text-amber-600/80">noise</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1.5 text-muted-foreground" aria-hidden>
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none">
          <path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[9px] font-semibold uppercase tracking-wider">LLM crop</span>
      </div>

      <div className="flex flex-col items-center gap-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">After</span>
        <div className="rounded-xl border-2 border-emerald-400/50 bg-white p-1 shadow-md ring-1 ring-emerald-400/20 transition-shadow">
          <div className="relative h-[100px] w-[120px] overflow-hidden rounded-lg bg-gradient-to-br from-sky-300 via-amber-200 to-emerald-400" aria-hidden>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.3),transparent_60%)]" />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <svg className="h-3 w-3 text-emerald-500" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M3 8.5l3.5 3.5L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[10px] font-medium text-emerald-600">Clean & focused</span>
        </div>
      </div>
    </div>
  )
}

/** Composite collage split into separate assets. */
function SegmentationIllustration() {
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-4 px-4 py-6">
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Single composited image</span>
        <div className="relative flex h-28 w-36 items-center justify-center overflow-hidden rounded-lg border border-border bg-white shadow-inner">
          <div className="absolute left-2 top-2 h-10 w-12 rounded bg-sky-300/90" />
          <div className="absolute right-4 top-4 h-8 w-8 rounded-full bg-amber-300" />
          <div className="absolute bottom-3 left-4 right-4 h-9 rounded bg-emerald-600/85" />
          <div className="absolute inset-2 rounded border-2 border-dashed border-violet-500/50 pointer-events-none" />
        </div>
      </div>

      <div className="flex items-center gap-2 text-muted-foreground" aria-hidden>
        <span className="text-xl">↓</span>
        <span className="text-[10px] font-medium uppercase tracking-wide">Split segments</span>
      </div>

      <div className="flex flex-wrap items-end justify-center gap-2">
        {[
          { k: "sky", className: "h-10 w-14 bg-sky-400/90" },
          { k: "sun", className: "h-10 w-10 rounded-full bg-amber-300" },
          { k: "hill", className: "h-10 w-16 rounded-sm bg-emerald-600" },
        ].map(({ k, className: c }) => (
          <div key={k} className="flex flex-col items-center gap-1">
            <div className={cn("rounded-md border border-primary/30 shadow-sm", c)} />
            <span className="text-[9px] font-medium capitalize text-muted-foreground">{k}</span>
          </div>
        ))}
      </div>
      <p className="max-w-xs text-center text-xs leading-relaxed text-muted-foreground">
        The model detects bounding boxes so each visual element can be stored and laid out separately.
      </p>
    </div>
  )
}

function MinSideIllustration() {
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-6 px-6 py-8">
      <p className="max-w-sm text-center text-sm text-muted-foreground">
        Images smaller than your minimum dimension skip segmentation — saving cost and avoiding false
        splits on icons.
      </p>
      <div className="flex flex-wrap items-start justify-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="relative flex h-20 w-24 items-center justify-center rounded-lg border-2 border-emerald-500/40 bg-white">
            <div className="h-14 w-20 rounded bg-gradient-to-br from-violet-300 to-indigo-400" />
            <span className="absolute -bottom-5 text-[10px] font-medium text-emerald-700">Large enough</span>
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white">
              ✓
            </span>
          </div>
          <span className="pt-4 text-xs text-muted-foreground">Segmentation runs</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-lg border border-muted bg-muted/30">
            <div className="h-6 w-6 rounded bg-muted-foreground/30" />
            <span className="absolute -bottom-5 text-[10px] font-medium text-muted-foreground">
              Too small
            </span>
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/80 text-[10px] text-white">
              —
            </span>
          </div>
          <span className="pt-4 text-xs text-muted-foreground">Skipped</span>
        </div>
      </div>
    </div>
  )
}

function FilterSizeIllustration() {
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-6 px-6 py-8">
      <p className="max-w-sm text-center text-sm text-muted-foreground">
        Images outside the min/max size range are excluded from processing — filtering out tiny icons
        and oversized scans.
      </p>
      <div className="flex flex-wrap items-end justify-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="relative flex h-8 w-8 items-center justify-center rounded border border-muted bg-muted/30">
            <div className="h-4 w-4 rounded-sm bg-muted-foreground/30" />
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
              ✕
            </span>
          </div>
          <span className="text-[10px] font-medium text-muted-foreground">Too small</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="relative flex h-20 w-24 items-center justify-center rounded-lg border-2 border-emerald-500/40 bg-white">
            <div className="h-14 w-20 rounded bg-gradient-to-br from-violet-300 to-indigo-400" />
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white">
              ✓
            </span>
          </div>
          <span className="text-[10px] font-medium text-emerald-700">Within range</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="relative flex h-24 w-28 items-center justify-center rounded border border-muted bg-muted/30">
            <div className="h-16 w-22 rounded bg-muted-foreground/20" />
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
              ✕
            </span>
          </div>
          <span className="text-[10px] font-medium text-muted-foreground">Too large</span>
        </div>
      </div>
    </div>
  )
}

const LABELS: Record<ImageProcessingPreviewFocus, string> = {
  idle: "Image processing",
  cropping: "LLM cropping",
  segmentation: "LLM segmentation",
  minSide: "Minimum size threshold",
  filterSize: "Image filter size",
}

export function ImageProcessingPreviewPane({
  focus,
}: {
  focus: ImageProcessingPreviewFocus
}) {
  return (
    <PreviewShell label={LABELS[focus]} key={focus}>
      {focus === "idle" ? <IdleIllustration /> : null}
      {focus === "cropping" ? <CroppingIllustration /> : null}
      {focus === "segmentation" ? <SegmentationIllustration /> : null}
      {focus === "minSide" ? <MinSideIllustration /> : null}
      {focus === "filterSize" ? <FilterSizeIllustration /> : null}
    </PreviewShell>
  )
}
