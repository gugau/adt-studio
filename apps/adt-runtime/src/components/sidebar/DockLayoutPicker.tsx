import { useAtom } from "jotai"
import {
  dockAlignAtom,
  dockPositionAtom,
  dockWidthAtom,
  type DockAlign,
  type DockPosition,
  type DockWidth,
} from "@/state/ui.atoms"
import { useTranslation } from "@/hooks/useTranslation"
import { trackToggleEvent } from "@/lib/analytics"
import { cn } from "@/lib/utils"


export function DockLayoutPicker() {
  const { t } = useTranslation()
  const [position, setPosition] = useAtom(dockPositionAtom)
  const [width, setWidth] = useAtom(dockWidthAtom)
  const [align, setAlign] = useAtom(dockAlignAtom)

  const dockPosition = position as DockPosition
  const dockWidth = width as DockWidth
  const dockAlign = align as DockAlign

  const setPos = (next: DockPosition) => {
    trackToggleEvent(`DockPosition:${next}`, true)
    setPosition(next)
  }
  const setW = (next: DockWidth) => {
    trackToggleEvent(`DockWidth:${next}`, true)
    setWidth(next)
  }
  const setA = (next: DockAlign) => {
    trackToggleEvent(`DockAlign:${next}`, true)
    setAlign(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <SegmentedField
          label={t("dock-layout-preview") || "Dock layout preview"}
          value={dockPosition}
          options={[
            { value: "top", label: t("dock-position-top") || "Top" },
            { value: "bottom", label: t("dock-position-bottom") || "Bottom" },
          ]}
          onChange={setPos}
        />
        <SegmentedField
          label={t("dock-width-label") || "Width"}
          value={dockWidth}
          options={[
            { value: "compact", label: t("dock-width-compact") || "Compact" },
            { value: "full", label: t("dock-width-full") || "Full" },
          ]}
          onChange={setW}
        />
        <SegmentedField
          label={t("dock-align-label") || "Alignment"}
          value={dockAlign}
          options={[
            { value: "center", label: t("dock-align-center") || "Center" },
            { value: "spread", label: t("dock-align-spread") || "Spread" },
          ]}
          onChange={setA}
        />
      </div>
    </div>
  )
}

interface SegmentedFieldProps<T extends string> {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
  disabled?: boolean
}

function SegmentedField<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: SegmentedFieldProps<T>) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span
        className={cn(
          "font-medium",
          disabled ? "text-muted-foreground/60" : "text-foreground",
        )}
      >
        {label}
      </span>
      <div
        className={cn(
          "inline-flex rounded-md bg-muted p-0.5 ring-1 ring-border",
          disabled && "opacity-50",
        )}
        role="radiogroup"
        aria-label={label}
      >
        {options.map((opt) => {
          const active = opt.value === value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={cn(
                "px-2.5 py-1 text-xs rounded transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
                disabled && "cursor-not-allowed",
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
