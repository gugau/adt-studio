// TODO: Add translations
import { CircleHelp, Minus, Plus } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

interface RangeSliderProps {
  label: string
  tooltip: string
  min: number
  max: number
  value: [number, number]
  onChange: (value: [number, number]) => void
  disabled?: boolean
  startLabel?: string
  endLabel?: string
}

function MinMaxInput({
  label,
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  function clamp(v: number) {
    return Math.min(max, Math.max(min, v))
  }

  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <span className="text-xs font-light text-black">{label}</span>
      <div className="flex items-center border border-[#e5e5e5] rounded-[6.4px] overflow-hidden h-8">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || value <= min}
          onClick={() => onChange(clamp(value - 1))}
          className="h-8 w-8 rounded-none border-r border-[#e5e5e5] shrink-0 transition-colors duration-150"
        >
          <Minus className="h-3 w-3" />
        </Button>
        <input
          type="number"
          disabled={disabled}
          value={disabled ? "" : value}
          min={min}
          max={max}
          onChange={(e) => {
            const parsed = parseInt(e.target.value)
            if (!isNaN(parsed)) onChange(clamp(parsed))
          }}
          className="w-14 text-center text-[11.2px] text-[#737373] bg-white outline-none disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || value >= max}
          onClick={() => onChange(clamp(value + 1))}
          className="h-8 w-8 rounded-none border-l border-[#e5e5e5] shrink-0 transition-colors duration-150"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

export function RangeSlider({
  label,
  tooltip,
  min,
  max,
  value,
  onChange,
  disabled,
  startLabel = "Initial Page",
  endLabel = "Final Page",
}: RangeSliderProps) {
  const [start, end] = value

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-black">{label}</span>
          <TooltipRoot>
            <TooltipTrigger asChild>
              <button type="button" className="text-[#a3a3a3] hover:text-[#737373] transition-colors duration-150">
                <CircleHelp className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </TooltipRoot>
        </div>

        <Slider
          min={min}
          max={max || 1}
          step={1}
          value={[start, end]}
          onValueChange={([s, e]) => onChange([s, e])}
          disabled={disabled}
        />

        <div className="flex items-center justify-between">
          <MinMaxInput
            label={startLabel}
            value={start}
            min={min}
            max={end}
            onChange={(v) => onChange([v, end])}
            disabled={disabled}
          />
          <MinMaxInput
            label={endLabel}
            value={end}
            min={start}
            max={max}
            onChange={(v) => onChange([start, v])}
            disabled={disabled}
          />
        </div>
      </div>
    </TooltipProvider>
  )
}
