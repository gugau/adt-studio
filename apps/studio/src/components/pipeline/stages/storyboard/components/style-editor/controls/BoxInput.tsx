import { useState, type FocusEventHandler, type SVGProps } from "react"
import { LayoutGrid, Square } from "lucide-react"
import { useLingui } from "@lingui/react/macro"
import { cn } from "@/lib/utils"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export interface BoxValue {
  /** top — or top-left when `variant="corners"` */
  t: number
  /** right — or top-right when `variant="corners"` */
  r: number
  /** bottom — or bottom-right when `variant="corners"` */
  b: number
  /** left — or bottom-left when `variant="corners"` */
  l: number
}

export type BoxInputVariant = "sides" | "corners"

interface BoxInputProps {
  value: BoxValue
  onChange: (next: BoxValue) => void
  /**
   * Per-cell labelling for split mode.
   * - `sides` (default): T / R / B / L
   * - `corners`: TL / TR / BR / BL (clockwise from top-left, mapped onto t/r/b/l)
   */
  variant?: BoxInputVariant
  /** Static unit suffix shown after the number (e.g. "px"). Defaults to "px". */
  unit?: string
  min?: number
  max?: number
}

const SIDE_LABELS: Record<BoxInputVariant, [string, string, string, string]> = {
  // eslint-disable-next-line lingui/no-unlocalized-strings -- universal direction abbreviations
  sides: ["T", "R", "B", "L"],
  // eslint-disable-next-line lingui/no-unlocalized-strings -- universal corner abbreviations
  corners: ["TL", "TR", "BR", "BL"],
}

export function BoxInput({
  value,
  onChange,
  variant = "sides",
  unit = "px",
  min = 0,
  max = 999,
}: BoxInputProps) {
  const { t } = useLingui()
  const allEqual =
    value.t === value.r && value.r === value.b && value.b === value.l
  const [mode, setMode] = useState<"single" | "split">(
    allEqual ? "single" : "split"
  )
  const [focusedSide, setFocusedSide] = useState<keyof BoxValue | null>(null)

  const setAll = (raw: string) => {
    const v = clamp(parseNumber(raw), min, max)
    onChange({ t: v, r: v, b: v, l: v })
  }
  const setSide = (k: keyof BoxValue, raw: string) => {
    const v = clamp(parseNumber(raw), min, max)
    onChange({ ...value, [k]: v })
  }

  // Choose the split-mode icon: when a cell is focused, render a square with
  // that specific side (or corner) highlighted so the toggle visually echoes
  // which input is being edited. Falls back to a generic split icon when
  // nothing is focused.
  const splitIcon = !focusedSide ? (
    <LayoutGrid className="h-3.5 w-3.5" />
  ) : variant === "sides" ? (
    <SideEmphasisIcon side={focusedSide} className="h-3.5 w-3.5" />
  ) : (
    <CornerEmphasisIcon corner={focusedSide} className="h-3.5 w-3.5" />
  )

  return (
    <div className="w-full min-w-0">
      <div className="flex items-center gap-1">
        <div className="relative flex-1 min-w-0">
          <input
            type="number"
            inputMode="numeric"
            value={value.t}
            onChange={(e) => setAll(e.target.value)}
            disabled={mode === "split"}
            min={min}
            max={max}
            className={cn(
              "h-8 w-full bg-muted/60 rounded-md px-2 pr-8 text-[12px] tabular-nums outline-none",
              "focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-violet-500",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            )}
          />
          {unit ? (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/70 select-none pointer-events-none">
              {unit}
            </span>
          ) : null}
        </div>
        <ToggleGroup
          type="single"
          size="xs"
          sliding
          value={mode}
          onValueChange={(v) => v && setMode(v as "single" | "split")}
          className="w-auto shrink-0"
        >
          <ToggleGroupItem value="single" title={t`Single value`}>
            <Square className="h-3.5 w-3.5" />
          </ToggleGroupItem>
          <ToggleGroupItem value="split" title={t`Individual sides`}>
            {splitIcon}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div
        className={cn(
          "grid grid-cols-4 gap-1 overflow-hidden transition-all duration-300 ease-in-out",
          mode === "split"
            ? "opacity-100 max-h-24 mt-2 mb-1"
            : "opacity-0 max-h-0 mt-0 mb-0 pointer-events-none"
        )}
      >
        <SideField
          label={SIDE_LABELS[variant][0]}
          value={value.t}
          onChange={(v) => setSide("t", v)}
          onFocus={() => setFocusedSide("t")}
          onBlur={() => setFocusedSide(null)}
          min={min}
          max={max}
        />
        <SideField
          label={SIDE_LABELS[variant][1]}
          value={value.r}
          onChange={(v) => setSide("r", v)}
          onFocus={() => setFocusedSide("r")}
          onBlur={() => setFocusedSide(null)}
          min={min}
          max={max}
        />
        <SideField
          label={SIDE_LABELS[variant][2]}
          value={value.b}
          onChange={(v) => setSide("b", v)}
          onFocus={() => setFocusedSide("b")}
          onBlur={() => setFocusedSide(null)}
          min={min}
          max={max}
        />
        <SideField
          label={SIDE_LABELS[variant][3]}
          value={value.l}
          onChange={(v) => setSide("l", v)}
          onFocus={() => setFocusedSide("l")}
          onBlur={() => setFocusedSide(null)}
          min={min}
          max={max}
        />
      </div>
    </div>
  )
}

function SideField({
  label,
  value,
  onChange,
  onFocus,
  onBlur,
  min,
  max,
}: {
  label: string
  value: number
  onChange: (raw: string) => void
  onFocus?: FocusEventHandler<HTMLInputElement>
  onBlur?: FocusEventHandler<HTMLInputElement>
  min: number
  max: number
}) {
  return (
    <div className="flex flex-col items-stretch gap-0.5 min-w-0">
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        min={min}
        max={max}
        className={cn(
          "h-7 w-full bg-muted/60 rounded-md px-1.5 text-[11px] tabular-nums text-center outline-none",
          "focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-violet-500",
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        )}
      />
      <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 text-center select-none">
        {label}
      </span>
    </div>
  )
}

function parseNumber(raw: string): number {
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : 0
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

// Faint outline rect drawn by both side- and corner-emphasis icons.
function FaintOutline(props: SVGProps<SVGRectElement>) {
  return (
    <rect
      x="4"
      y="4"
      width="16"
      height="16"
      rx="2"
      strokeWidth="1.5"
      opacity="0.35"
      {...props}
    />
  )
}

const SVG_BASE: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "none",
  // eslint-disable-next-line lingui/no-unlocalized-strings -- SVG attribute keyword
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
}

/** A square with one side emphasized (used in `variant="sides"`). */
function SideEmphasisIcon({
  side,
  className,
}: {
  side: keyof BoxValue
  className?: string
}) {
  return (
    <svg {...SVG_BASE} className={className}>
      <FaintOutline />
      {side === "t" && <line x1="4" y1="4" x2="20" y2="4" strokeWidth="3" />}
      {side === "r" && <line x1="20" y1="4" x2="20" y2="20" strokeWidth="3" />}
      {side === "b" && <line x1="4" y1="20" x2="20" y2="20" strokeWidth="3" />}
      {side === "l" && <line x1="4" y1="4" x2="4" y2="20" strokeWidth="3" />}
    </svg>
  )
}

/** A square with one corner emphasized (used in `variant="corners"`).
 *  The `corner` prop reuses the BoxValue keys (t→TL, r→TR, b→BR, l→BL). */
function CornerEmphasisIcon({
  corner,
  className,
}: {
  corner: keyof BoxValue
  className?: string
}) {
  return (
    <svg {...SVG_BASE} className={className}>
      <FaintOutline />
      {corner === "t" && (
        <path d="M4 10c0-3.3 2.7-6 6-6" strokeWidth="3" />
      )}
      {corner === "r" && (
        <path d="M14 4c3.3 0 6 2.7 6 6" strokeWidth="3" />
      )}
      {corner === "b" && (
        <path d="M20 14c0 3.3-2.7 6-6 6" strokeWidth="3" />
      )}
      {corner === "l" && (
        <path d="M10 20c-3.3 0-6-2.7-6-6" strokeWidth="3" />
      )}
    </svg>
  )
}
