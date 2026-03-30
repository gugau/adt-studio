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
    <div className="flex h-full flex-col items-center justify-center gap-6 px-12 py-16">
      <div className="flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-violet-50">
        <Sparkles className="size-10 text-[#2b7fff]" strokeWidth={1.5} />
      </div>
      <div className="flex flex-col items-center gap-3 text-center">
        <h3 className="text-xl font-semibold text-[#0a0a0a]">
          AI-Generated Layout
        </h3>
        <p className="max-w-sm text-sm leading-relaxed text-[#737373]">
          The AI analyzes each page's content — text blocks, images, headings,
          tables — and generates a completely new HTML layout from scratch,
          optimized for readability on screen.
        </p>
      </div>
      <div className="flex flex-col items-center gap-2 rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-5 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-[#a3a3a3]">
          How it works
        </span>
        <ol className="flex flex-col gap-1.5 text-xs leading-relaxed text-[#525252]">
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
  )
}

// ─── Dynamic Overlay (LLM-Overlay) — informational ─────────────────────────

function OverlayPreview() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-12 py-16">
      <div className="flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50">
        <Layers className="size-10 text-amber-500" strokeWidth={1.5} />
      </div>
      <div className="flex flex-col items-center gap-3 text-center">
        <h3 className="text-xl font-semibold text-[#0a0a0a]">
          Original Page + Text Overlay
        </h3>
        <p className="max-w-sm text-sm leading-relaxed text-[#737373]">
          The original PDF page is kept as a background image. The AI positions
          extracted text on top of it, making content selectable and accessible
          while preserving the original visual design.
        </p>
      </div>
      <div className="flex flex-col items-center gap-2 rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-5 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-[#a3a3a3]">
          How it works
        </span>
        <ol className="flex flex-col gap-1.5 text-xs leading-relaxed text-[#525252]">
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
  )
}

// ─── Two Column

function TwoColumnPreview() {
  return (
    <div className="flex h-full gap-4 px-[30px] py-[66px] text-[#0a0a0a]">
      <div className="flex flex-1 flex-col gap-[10px] overflow-hidden px-4">
        <p className="text-center text-2xl font-semibold leading-8 tracking-[-0.6px]">
          Chapter One
        </p>
        <p className="text-xs leading-[14px] text-justify">{LOREM}</p>
        <p className="text-xs leading-[14px] text-justify">{LOREM}</p>
        <p className="text-xs leading-[14px] text-justify">{LOREM}</p>
        <p className="text-xs leading-[14px] text-justify">{LOREM}</p>
        <p className="flex-1 text-xs leading-[14px] text-justify overflow-hidden">{LOREM}</p>
      </div>
      <div className="flex flex-1 flex-col gap-[10px] overflow-hidden px-4 text-xs leading-[14px] text-justify">
        <p>{LOREM}</p>
        <p>{LOREM}</p>
        <p>{LOREM}</p>
        <p>{LOREM}</p>
      </div>
    </div>
  )
}

// ─── Two Column Story 

function TwoColumnStoryPreview() {
  return (
    <div className="flex h-full items-center gap-4 px-[30px] py-[66px]">
      <div className="flex flex-1 items-center justify-center overflow-hidden px-4">
        <img
          alt=""
          src="/previews/two-column-story.png"
          className="size-[444px] object-contain pointer-events-none"
        />
      </div>
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-center text-[30px] font-semibold leading-10 tracking-[0.3px] text-[#0a0a0a]">
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
    <div className="flex h-full w-full flex-col rounded-md bg-white overflow-hidden shadow-[0px_17px_38px_0px_rgba(0,0,0,0.1),0px_69px_69px_0px_rgba(0,0,0,0.09),0px_155px_93px_0px_rgba(0,0,0,0.05)] animate-in fade-in duration-300">
      {
        Preview ? <Preview /> : <span className="text-sm text-[#a3a3a3] h-full w-full flex items-center justify-center">Select a layout to preview</span>
      }
    </div>
  )
}
