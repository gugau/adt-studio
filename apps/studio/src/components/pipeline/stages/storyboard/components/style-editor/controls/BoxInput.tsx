import { useState } from "react"
import { LayoutGrid, Square } from "lucide-react"
import { useLingui } from "@lingui/react/macro"
import { cn } from "@/lib/utils"

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

  const setAll = (raw: string) => {
    const v = clamp(parseNumber(raw), min, max)
    onChange({ t: v, r: v, b: v, l: v })
  }
  const setSide = (k: keyof BoxValue, raw: string) => {
    const v = clamp(parseNumber(raw), min, max)
    onChange({ ...value, [k]: v })
  }

  const goSingle = () => {
    if (!allEqual) {
      onChange({ t: value.t, r: value.t, b: value.t, l: value.t })
    }
    setMode("single")
  }
  const goSplit = () => setMode("split")

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
              "h-8 w-full bg-background border border-input rounded-md px-2 pr-8 text-[12px] tabular-nums outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring",
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
        <div className="inline-flex items-center border border-input rounded-md overflow-hidden shrink-0">
          <ModeButton
            active={mode === "single"}
            onClick={goSingle}
            title={t`Single value`}
            icon={Square}
          />
          <ModeButton
            active={mode === "split"}
            onClick={goSplit}
            title={t`Individual sides`}
            icon={LayoutGrid}
          />
        </div>
      </div>

      <div
        className={cn(
          "grid grid-cols-4 gap-1 overflow-hidden transition-all duration-300 ease-in-out",
          mode === "split"
            ? "opacity-100 max-h-24 mt-2 mb-1"
            : "opacity-0 max-h-0 mt-0 mb-0 pointer-events-none"
        )}
      >
        <SideField label={SIDE_LABELS[variant][0]} value={value.t} onChange={(v) => setSide("t", v)} min={min} max={max} />
        <SideField label={SIDE_LABELS[variant][1]} value={value.r} onChange={(v) => setSide("r", v)} min={min} max={max} />
        <SideField label={SIDE_LABELS[variant][2]} value={value.b} onChange={(v) => setSide("b", v)} min={min} max={max} />
        <SideField label={SIDE_LABELS[variant][3]} value={value.l} onChange={(v) => setSide("l", v)} min={min} max={max} />
      </div>
    </div>
  )
}

function SideField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  value: number
  onChange: (raw: string) => void
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
        min={min}
        max={max}
        className={cn(
          "h-7 w-full bg-background border border-input rounded-md px-1.5 text-[11px] tabular-nums text-center outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring",
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        )}
      />
      <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 text-center select-none">
        {label}
      </span>
    </div>
  )
}

function ModeButton({
  active,
  onClick,
  title,
  icon: Icon,
}: {
  active: boolean
  onClick: () => void
  title: string
  icon: typeof Square
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        "h-8 w-8 flex items-center justify-center transition-colors cursor-pointer",
        active
          ? "bg-violet-50 text-violet-600"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

function parseNumber(raw: string): number {
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : 0
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
