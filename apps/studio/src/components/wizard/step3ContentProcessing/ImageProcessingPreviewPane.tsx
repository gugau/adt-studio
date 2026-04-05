import { useState, useCallback, useEffect, type FC, type ReactNode } from "react"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { Trans, useLingui } from "@lingui/react/macro"
import { cn } from "@/lib/utils"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel"
import type { ImageProcessingPreviewFocus } from "./imageProcessingPreviewTypes"

/** Mobile carousel skips the idle placeholder (focus ids, not UI copy). */
/* eslint-disable lingui/no-unlocalized-strings */
const MOBILE_FOCUSES: ImageProcessingPreviewFocus[] = [
  "activities",
  "cropping",
  "segmentation",
  "minSide",
  "filterSize",
]
/* eslint-enable lingui/no-unlocalized-strings */

function PreviewShell({
  labelMsg,
  children,
  className,
}: {
  labelMsg: MessageDescriptor
  children: ReactNode
  className?: string
}) {
  const { i18n } = useLingui()

  return (
    <div
      className={cn(
        "@container flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md bg-white shadow-[0px_17px_38px_0px_rgba(0,0,0,0.1),0px_69px_69px_0px_rgba(0,0,0,0.09),0px_155px_93px_0px_rgba(0,0,0,0.05)]",
        className,
      )}
    >
      <div className="shrink-0 border-b border-border/80 bg-muted/25 px-3 py-2">
        <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {i18n._(labelMsg)}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-[#fafafa] h-full flex">{children}</div>
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
        <p className="text-base font-semibold text-foreground">
          <Trans>Preview</Trans>
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          <Trans>
            Hover a setting to see how LLM cropping, segmentation, or the size threshold changes
            extracted images.
          </Trans>
        </p>
      </div>
    </div>
  )
}

function ActivitiesIllustration() {
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-6 px-4 py-6 @sm:flex-row @sm:gap-8 @sm:px-6">
      <div className="flex flex-col items-center gap-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Trans>PDF</Trans>
        </span>
        <div className="w-[138px] rounded-xl border border-border bg-white p-3 shadow-sm">
          <div className="mb-2.5 h-2 w-20 rounded bg-muted-foreground/20" />
          <div className="mb-1.5 h-1.5 w-full rounded bg-muted-foreground/15" />
          <div className="mb-2.5 h-1.5 w-4/5 rounded bg-muted-foreground/15" />
          <div className="flex flex-col gap-1.5">
            {["w-3/4", "w-2/3", "w-4/5"].map((w, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="h-3 w-3 shrink-0 rounded-full border border-muted-foreground/30" />
                <div className={`h-1.5 rounded bg-muted-foreground/15 ${w}`} />
              </div>
            ))}
          </div>
          <div className="mt-3 mb-1 h-2 w-16 rounded bg-muted-foreground/20" />
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-12 rounded bg-muted-foreground/15" />
            <div className="h-3.5 w-14 rounded border border-dashed border-muted-foreground/25 bg-muted/20" />
            <div className="h-1.5 w-8 rounded bg-muted-foreground/15" />
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1.5 text-muted-foreground" aria-hidden>
        <svg className="h-5 w-5 rotate-90 @sm:rotate-0" viewBox="0 0 20 20" fill="none">
          <path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[9px] font-semibold uppercase tracking-wider">
          <Trans>Converted</Trans>
        </span>
      </div>

      <div className="flex flex-col items-center gap-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Trans>Interactive</Trans>
        </span>
        <div className="w-[138px] rounded-xl border border-[#2b7fff]/30 bg-white p-3 shadow-md ring-1 ring-[#2b7fff]/10">
          <div className="mb-2.5 h-2 w-20 rounded bg-muted-foreground/20" />
          <div className="mb-1.5 h-1.5 w-full rounded bg-muted-foreground/15" />
          <div className="mb-2.5 h-1.5 w-4/5 rounded bg-muted-foreground/15" />
          <div className="flex flex-col gap-1.5">
            {[
              { w: "w-3/4", checked: false },
              { w: "w-2/3", checked: true },
              { w: "w-4/5", checked: false },
            ].map(({ w, checked }, i) => (
              <div key={i} className={`flex items-center gap-1.5 rounded-md px-1 py-0.5 ${checked ? "bg-[#2b7fff]/8" : ""}`}>
                <div className={`h-3 w-3 shrink-0 rounded-full border ${checked ? "border-[#2b7fff] bg-[#2b7fff]" : "border-muted-foreground/40 bg-white"} flex items-center justify-center`}>
                  {checked && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
                <div className={`h-1.5 rounded bg-muted-foreground/15 ${w}`} />
              </div>
            ))}
          </div>
          <div className="mt-3 mb-1 h-2 w-16 rounded bg-muted-foreground/20" />
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-12 rounded bg-muted-foreground/15" />
            <div className="h-4 w-14 rounded border border-[#2b7fff]/40 bg-[#2b7fff]/5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]" />
            <div className="h-1.5 w-8 rounded bg-muted-foreground/15" />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <svg className="h-3 w-3 text-emerald-500" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M3 8.5l3.5 3.5L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[10px] font-medium text-emerald-600">
            <Trans>Fully interactive</Trans>
          </span>
        </div>
      </div>
    </div>
  )
}

function CroppingIllustration() {
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-6 px-4 py-6 @sm:flex-row @sm:gap-8 @sm:px-6">
      <div className="flex flex-col items-center gap-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Trans>Before</Trans>
        </span>
        <div className="relative rounded-xl border-2 border-dashed border-amber-300/70 bg-amber-50/40 p-4 transition-shadow">
          <div className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded bg-amber-100/80 px-1 py-px">
            <svg className="h-2.5 w-2.5 text-amber-600/70" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-[7px] font-medium text-amber-600/80">
              <Trans>margin</Trans>
            </span>
          </div>
          <div className="relative h-[100px] w-[120px] overflow-hidden rounded-md bg-gradient-to-br from-sky-300 via-amber-200 to-emerald-400 shadow-inner" aria-hidden>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.3),transparent_60%)]" />
          </div>
          <div className="absolute -right-1.5 top-1/2 flex -translate-y-1/2 items-center rounded-sm bg-red-400/80 px-1 py-0.5 shadow-sm">
            <span className="text-[6px] font-bold text-white">
              <Trans>ABC</Trans>
            </span>
          </div>
          <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 rounded bg-amber-100/80 px-1 py-px">
            <span className="text-[7px] font-medium text-amber-600/80">
              <Trans>noise</Trans>
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1.5 text-muted-foreground" aria-hidden>
        <svg className="h-5 w-5 rotate-90 @sm:rotate-0" viewBox="0 0 20 20" fill="none">
          <path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[9px] font-semibold uppercase tracking-wider">
          <Trans>LLM crop</Trans>
        </span>
      </div>

      <div className="flex flex-col items-center gap-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Trans>After</Trans>
        </span>
        <div className="rounded-xl border-2 border-emerald-400/50 bg-white p-1 shadow-md ring-1 ring-emerald-400/20 transition-shadow">
          <div className="relative h-[100px] w-[120px] overflow-hidden rounded-lg bg-gradient-to-br from-sky-300 via-amber-200 to-emerald-400" aria-hidden>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.3),transparent_60%)]" />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <svg className="h-3 w-3 text-emerald-500" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M3 8.5l3.5 3.5L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[10px] font-medium text-emerald-600">
            <Trans>Clean & focused</Trans>
          </span>
        </div>
      </div>
    </div>
  )
}

const SEGMENT_PREVIEW_PARTS = [
  { slug: "sky", labelMsg: msg`Sky`, className: "h-10 w-14 bg-sky-400/90" },
  { slug: "sun", labelMsg: msg`Sun`, className: "h-10 w-10 rounded-full bg-amber-300" },
  { slug: "hill", labelMsg: msg`Hill`, className: "h-10 w-16 rounded-sm bg-emerald-600" },
] as const

function SegmentationIllustration() {
  const { i18n } = useLingui()

  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-4 px-4 py-6">
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          <Trans>Single composited image</Trans>
        </span>
        <div className="relative flex h-28 w-36 items-center justify-center overflow-hidden rounded-lg border border-border bg-white shadow-inner">
          <div className="absolute left-2 top-2 h-10 w-12 rounded bg-sky-300/90" />
          <div className="absolute right-4 top-4 h-8 w-8 rounded-full bg-amber-300" />
          <div className="absolute bottom-3 left-4 right-4 h-9 rounded bg-emerald-600/85" />
          <div className="absolute inset-2 rounded border-2 border-dashed border-violet-500/50 pointer-events-none" />
        </div>
      </div>

      <div className="flex items-center gap-2 text-muted-foreground" aria-hidden>
        <span className="text-xl">↓</span>
        <span className="text-[10px] font-medium uppercase tracking-wide">
          <Trans>Split segments</Trans>
        </span>
      </div>

      <div className="flex flex-wrap items-end justify-center gap-2">
        {SEGMENT_PREVIEW_PARTS.map(({ slug, labelMsg, className: c }) => (
          <div key={slug} className="flex flex-col items-center gap-1">
            <div className={cn("rounded-md border border-primary/30 shadow-sm", c)} />
            <span className="text-[9px] font-medium text-muted-foreground">{i18n._(labelMsg)}</span>
          </div>
        ))}
      </div>
      <p className="max-w-xs text-center text-xs leading-relaxed text-muted-foreground">
        <Trans>
          The model detects bounding boxes so each visual element can be stored and laid out separately.
        </Trans>
      </p>
    </div>
  )
}

function MinSideIllustration() {
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-6 px-6 py-8">
      <p className="max-w-sm text-center text-sm text-muted-foreground">
        <Trans>
          Images smaller than your minimum dimension skip segmentation - saving cost and avoiding false
          splits on icons.
        </Trans>
      </p>
      <div className="flex flex-wrap items-start justify-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="relative flex h-20 w-24 items-center justify-center rounded-lg border-2 border-emerald-500/40 bg-white">
            <div className="h-14 w-20 rounded bg-gradient-to-br from-violet-300 to-indigo-400" />
            <span className="absolute -bottom-5 text-[10px] font-medium text-emerald-700">
              <Trans>Large enough</Trans>
            </span>
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white">
              ✓
            </span>
          </div>
          <span className="pt-4 text-xs text-muted-foreground">
            <Trans>Segmentation runs</Trans>
          </span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-lg border border-muted bg-muted/30">
            <div className="h-6 w-6 rounded bg-muted-foreground/30" />
            <span className="absolute -bottom-5 text-[10px] font-medium text-muted-foreground">
              <Trans>Too small</Trans>
            </span>
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/80 text-[10px] text-white">
              <Trans>-</Trans>
            </span>
          </div>
          <span className="pt-4 text-xs text-muted-foreground">
            <Trans>Skipped</Trans>
          </span>
        </div>
      </div>
    </div>
  )
}

function FilterSizeIllustration() {
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-6 px-6 py-8">
      <p className="max-w-sm text-center text-sm text-muted-foreground">
        <Trans>
          Images outside the min/max size range are excluded from processing - filtering out tiny icons and
          oversized scans.
        </Trans>
      </p>
      <div className="flex flex-wrap items-end justify-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="relative flex h-8 w-8 items-center justify-center rounded border border-muted bg-muted/30">
            <div className="h-4 w-4 rounded-sm bg-muted-foreground/30" />
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
              ✕
            </span>
          </div>
          <span className="text-[10px] font-medium text-muted-foreground">
            <Trans>Too small</Trans>
          </span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="relative flex h-20 w-24 items-center justify-center rounded-lg border-2 border-emerald-500/40 bg-white">
            <div className="h-14 w-20 rounded bg-gradient-to-br from-violet-300 to-indigo-400" />
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white">
              ✓
            </span>
          </div>
          <span className="text-[10px] font-medium text-emerald-700">
            <Trans>Within range</Trans>
          </span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="relative flex h-24 w-28 items-center justify-center rounded border border-muted bg-muted/30">
            <div className="h-16 w-22 rounded bg-muted-foreground/20" />
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
              ✕
            </span>
          </div>
          <span className="text-[10px] font-medium text-muted-foreground">
            <Trans>Too large</Trans>
          </span>
        </div>
      </div>
    </div>
  )
}

const PREVIEW_LABEL_MSGS: Record<ImageProcessingPreviewFocus, MessageDescriptor> = {
  idle: msg`Image processing`,
  activities: msg`Activities generator`,
  cropping: msg`LLM cropping`,
  segmentation: msg`LLM segmentation`,
  minSide: msg`Minimum size threshold`,
  filterSize: msg`Image filter size`,
}

const ILLUSTRATIONS: Record<ImageProcessingPreviewFocus, FC> = {
  idle: IdleIllustration,
  activities: ActivitiesIllustration,
  cropping: CroppingIllustration,
  segmentation: SegmentationIllustration,
  minSide: MinSideIllustration,
  filterSize: FilterSizeIllustration,
}

function MobileCarousel() {
  const { i18n } = useLingui()
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)

  const onSelect = useCallback(() => {
    if (!api) return
    setCurrent(api.selectedScrollSnap())
  }, [api])

  useEffect(() => {
    if (!api) return
    onSelect()
    api.on("select", onSelect)
    return () => {
      api.off("select", onSelect)
    }
  }, [api, onSelect])

  const currentFocus = MOBILE_FOCUSES[current]
  const currentLabelMsg = PREVIEW_LABEL_MSGS[currentFocus]

  return (
    <PreviewShell labelMsg={currentLabelMsg} className="min-h-[600px]">
      <Carousel
        setApi={setApi}
        opts={{ loop: true }}
        className="flex min-h-0 flex-1 flex-col w-full h-auto"
      >
        <CarouselContent className="m-0 min-h-0 flex-1 w-full h-auto">
          {MOBILE_FOCUSES.map((f) => {
            const Illustration = ILLUSTRATIONS[f]
            return (
              <CarouselItem
                key={f}
                className="flex min-h-[600px] h-full items-center justify-center p-0"
              >
                <Illustration />
              </CarouselItem>
            )
          })}
        </CarouselContent>

        <div className="flex items-center justify-center gap-3 border-t border-border/60 px-4 py-2.5">
          <CarouselPrevious className="static translate-y-0 size-7 rounded-full" />

          <div className="flex items-center gap-1.5">
            {MOBILE_FOCUSES.map((f, i) => (
              <button
                key={f}
                type="button"
                onClick={() => api?.scrollTo(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === current
                    ? "w-4 bg-primary"
                    : "w-1.5 bg-muted-foreground/25 hover:bg-muted-foreground/40",
                )}
                aria-label={i18n._(PREVIEW_LABEL_MSGS[f])}
              />
            ))}
          </div>

          <CarouselNext className="static translate-y-0 size-7 rounded-full" />
        </div>
      </Carousel>
    </PreviewShell>
  )
}

export function ImageProcessingPreviewPane({
  focus,
  mobile = false,
}: {
  focus: ImageProcessingPreviewFocus
  mobile?: boolean
}) {
  if (mobile) {
    return <MobileCarousel />
  }

  const Illustration = ILLUSTRATIONS[focus]

  return (
    <PreviewShell labelMsg={PREVIEW_LABEL_MSGS[focus]} key={focus}>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Illustration />
      </div>
    </PreviewShell>
  )
}
