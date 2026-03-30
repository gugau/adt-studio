/* eslint-disable lingui/no-unlocalized-strings */
import { Sparkles, Layers } from "lucide-react"
import type { RenderStrategyId } from "@/components/wizard/constants"

// ─── Per-strategy preview width ──────────────────────────────────────────────

const STRATEGY_WIDTHS: Record<RenderStrategyId, number> = {
  llm: 650,
  "llm-overlay": 650,
  two_column: 650,
  two_column_story: 980,
}

export function getPreviewWidth(strategy: string): number {
  return STRATEGY_WIDTHS[strategy as RenderStrategyId] ?? 650
}

// ─── Shared placeholder primitives ──────────────────────────────────────────

const LOREM =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur."

// ─── Dynamic (LLM) — informational ─────────────────────────────────────────

function DynamicPreview() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-4 py-6 @sm:gap-6 @sm:px-8 @sm:py-10 @md:px-12 @md:py-16">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 @sm:gap-6">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-violet-50 @sm:size-20">
          <Sparkles className="size-8 text-[#2b7fff] @sm:size-10" strokeWidth={1.5} />
        </div>
        <div className="flex flex-col items-center gap-2 text-center @sm:gap-3">
          <h3 className="text-balance text-lg font-semibold text-[#0a0a0a] @sm:text-xl">
            AI-Generated Layout
          </h3>
          <p className="max-w-sm text-pretty text-sm leading-relaxed text-[#737373]">
            The AI analyzes each page's content — text blocks, images, headings,
            tables — and generates a completely new HTML layout from scratch,
            optimized for readability on screen.
          </p>
        </div>
        <div className="flex w-full max-w-sm flex-col items-center gap-2 rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-4 py-3 @sm:px-5">
          <span className="text-xs font-medium uppercase tracking-wider text-[#a3a3a3]">
            How it works
          </span>
          <ol className="flex w-full flex-col gap-1.5 text-xs leading-relaxed text-[#525252]">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#2b7fff] text-[10px] font-bold text-white">1</span>
              Content is extracted from the PDF page
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#2b7fff] text-[10px] font-bold text-white">2</span>
              AI designs a fresh layout using Tailwind CSS
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#2b7fff] text-[10px] font-bold text-white">3</span>
              Visual refinement loop compares output to original
            </li>
          </ol>
        </div>
      </div>
    </div>
  )
}

// ─── Dynamic Overlay (LLM-Overlay) — informational ─────────────────────────

function OverlayPreview() {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center items-center gap-4 overflow-y-auto px-4 py-6 @sm:gap-6 @sm:px-8 @sm:py-10 @md:px-12 @md:py-16">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 @sm:gap-6">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 @sm:size-20">
          <Layers className="size-8 text-amber-500 @sm:size-10" strokeWidth={1.5} />
        </div>
        <div className="flex flex-col items-center gap-2 text-center @sm:gap-3">
          <h3 className="text-balance text-lg font-semibold text-[#0a0a0a] @sm:text-xl">
            Original Page + Text Overlay
          </h3>
          <p className="max-w-sm text-pretty text-sm leading-relaxed text-[#737373]">
            The original PDF page is kept as a background image. The AI positions
            extracted text on top of it, making content selectable and accessible
            while preserving the original visual design.
          </p>
        </div>
        <div className="flex w-full max-w-sm flex-col items-center gap-2 rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-4 py-3 @sm:px-5">
          <span className="text-xs font-medium uppercase tracking-wider text-[#a3a3a3]">
            How it works
          </span>
          <ol className="flex w-full flex-col gap-1.5 text-xs leading-relaxed text-[#525252]">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">1</span>
              Original page rendered as full background
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">2</span>
              AI positions text in their original locations
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">3</span>
              Text becomes selectable, searchable, and accessible
            </li>
          </ol>
        </div>
      </div>
    </div>
  )
}

// ─── Two Column (always two columns — scale type + margins when container is narrow)

function TwoColumnPreview() {
  return (
    <div className="flex h-full min-h-0 flex-row gap-2 px-2 py-4 text-[#0a0a0a] @min-[420px]:gap-3 @min-[420px]:px-3 @min-[420px]:py-6 @min-[540px]:gap-4 @min-[540px]:px-5 @min-[620px]:px-[30px] @min-[620px]:py-[66px]">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-y-hidden px-1 @min-[420px]:gap-1.5 @min-[420px]:px-2 @min-[540px]:gap-2 @min-[620px]:gap-[10px] @min-[620px]:px-4">
        <p className="text-center text-sm font-semibold leading-tight tracking-[-0.6px] @min-[420px]:text-base @min-[420px]:leading-snug @min-[540px]:text-lg @min-[540px]:leading-7 @min-[620px]:text-2xl @min-[620px]:leading-8">
          Chapter One
        </p>
        <p className="text-[8px] leading-[11px] text-justify @min-[420px]:text-[9px] @min-[420px]:leading-[12px] @min-[540px]:text-[10px] @min-[540px]:leading-[13px] @min-[620px]:text-xs @min-[620px]:leading-[14px]">
          {LOREM}
        </p>
        <p className="text-[8px] leading-[11px] text-justify @min-[420px]:text-[9px] @min-[420px]:leading-[12px] @min-[540px]:text-[10px] @min-[540px]:leading-[13px] @min-[620px]:text-xs @min-[620px]:leading-[14px]">
          {LOREM}
        </p>
        <p className="text-[8px] leading-[11px] text-justify @min-[420px]:text-[9px] @min-[420px]:leading-[12px] @min-[540px]:text-[10px] @min-[540px]:leading-[13px] @min-[620px]:text-xs @min-[620px]:leading-[14px]">
          {LOREM}
        </p>
        <p className="text-[8px] leading-[11px] text-justify @min-[420px]:text-[9px] @min-[420px]:leading-[12px] @min-[540px]:text-[10px] @min-[540px]:leading-[13px] @min-[620px]:text-xs @min-[620px]:leading-[14px]">
          {LOREM}
        </p>
        <p className="min-h-0 flex-1 overflow-hidden text-[8px] leading-[11px] text-justify @min-[420px]:text-[9px] @min-[420px]:leading-[12px] @min-[540px]:text-[10px] @min-[540px]:leading-[13px] @min-[620px]:text-xs @min-[620px]:leading-[14px]">
          {LOREM}
        </p>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-y-auto px-1 text-[8px] leading-[11px] text-justify @min-[420px]:gap-1.5 @min-[420px]:px-2 @min-[420px]:text-[9px] @min-[420px]:leading-[12px] @min-[540px]:gap-2 @min-[540px]:text-[10px] @min-[540px]:leading-[13px] @min-[620px]:gap-[10px] @min-[620px]:px-4 @min-[620px]:text-xs @min-[620px]:leading-[14px]">
        <p>{LOREM}</p>
        <p>{LOREM}</p>
        <p>{LOREM}</p>
        <p>{LOREM}</p>
      </div>
    </div>
  )
}

// ─── Two Column Story (always image | text — scale image + type when container is narrow)

function TwoColumnStoryPreview() {
  return (
    <div className="flex h-full min-h-0 flex-row items-center gap-2 px-2 py-4 @min-[420px]:gap-3 @min-[420px]:px-3 @min-[420px]:py-6 @min-[540px]:gap-4 @min-[540px]:px-5 @min-[620px]:px-[30px] @min-[620px]:py-[66px]">
      <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden @min-[620px]:px-4">
        <img
          alt=""
          src="/previews/two-column-story.png"
          className="pointer-events-none h-auto w-full max-h-[min(444px,42cqh)] max-w-[min(444px,44cqi)] object-contain @min-[540px]:max-h-[min(444px,48cqh)] @min-[540px]:max-w-[min(444px,46cqi)] @min-[620px]:max-h-[444px] @min-[620px]:max-w-[444px]"
        />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center px-1 @min-[420px]:px-2 @min-[620px]:px-4">
        <p className="text-pretty text-center text-[11px] font-semibold leading-snug tracking-[0.3px] text-[#0a0a0a] @min-[380px]:text-xs @min-[380px]:leading-snug @min-[480px]:text-sm @min-[480px]:leading-normal @min-[540px]:text-base @min-[540px]:leading-7 @min-[620px]:text-2xl @min-[620px]:leading-9 @min-[760px]:text-[30px] @min-[760px]:leading-10">
          This is Pip! He is a happy caramel dog with a very wiggly tail. Pip
          loves the green grass, the bright yellow sun, and making new friends
          in his garden.
        </p>
      </div>
    </div>
  )
}

// ─── Registry & export ──────────────────────────────────────────────────────

const STRATEGY_PREVIEWS: Record<RenderStrategyId, React.FC> = {
  llm: DynamicPreview,
  "llm-overlay": OverlayPreview,
  two_column: TwoColumnPreview,
  two_column_story: TwoColumnStoryPreview,
}

export function LayoutPreview({ strategy }: { strategy: string }) {
  const Preview = STRATEGY_PREVIEWS[strategy as RenderStrategyId]

  return (
    <div className="@container flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md bg-white shadow-[0px_17px_38px_0px_rgba(0,0,0,0.1),0px_69px_69px_0px_rgba(0,0,0,0.09),0px_155px_93px_0px_rgba(0,0,0,0.05)] animate-in fade-in duration-300">
      {Preview ? (
        <Preview />
      ) : (
        <span className="flex min-h-[12rem] w-full items-center justify-center px-4 py-8 text-center text-sm text-[#a3a3a3]">
          Select a layout to preview
        </span>
      )}
    </div>
  )
}
