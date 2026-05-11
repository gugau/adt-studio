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

/**
 * Visual dock configurator — replaces the three separate segmented rows
 * (width / position / alignment) with a single interactive viewport
 * preview. Clicking inside the preview directly sets the matching atoms:
 *   - top half / bottom half  → dockPosition
 *   - the dock bar inside the half → width + alignment
 *
 * Below the preview, two segmented controls expose width and alignment
 * for keyboard users and screen readers, mirroring the visual state.
 */
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

  const isTop = dockPosition === "top"
  const isFull = dockWidth === "full"
  const isSpread = dockAlign === "spread"

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative aspect-[16/9] w-full rounded-lg border border-border bg-muted/40 overflow-hidden"
        role="group"
        aria-label={t("dock-layout-preview") || "Dock layout preview"}
      >
        {/* Top half / bottom half clickable zones to pick position */}
        <button
          type="button"
          aria-label={t("dock-position-top") || "Top"}
          aria-pressed={isTop}
          onClick={() => setPos("top")}
          className={cn(
            "absolute inset-x-0 top-0 h-1/2",
            "transition-colors",
            isTop ? "bg-primary/5" : "hover:bg-primary/5",
          )}
        />
        <button
          type="button"
          aria-label={t("dock-position-bottom") || "Bottom"}
          aria-pressed={!isTop}
          onClick={() => setPos("bottom")}
          className={cn(
            "absolute inset-x-0 bottom-0 h-1/2",
            "transition-colors",
            !isTop ? "bg-primary/5" : "hover:bg-primary/5",
          )}
        />

        {/* Page content mock — non-interactive */}
        <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 pointer-events-none">
          <div className="h-1 rounded bg-foreground/15 w-3/4" />
          <div className="h-1 rounded bg-foreground/10 w-2/3" />
          <div className="h-1 rounded bg-foreground/10 w-5/6" />
        </div>

        {/* The dock itself — positioned based on current selection */}
        <div
          className={cn(
            "absolute h-3 rounded bg-primary/80 ring-1 ring-primary/40 shadow-sm",
            "transition-all duration-200",
            isTop ? "top-1.5" : "bottom-1.5",
            isFull
              ? "left-0 right-0 rounded-none"
              : isSpread
                ? "left-2 right-2"
                : "left-1/2 -translate-x-1/2 w-1/2",
          )}
          aria-hidden
        />
      </div>

      {/* Width + alignment as compact segmented controls underneath */}
      <div className="flex flex-col gap-2">
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
          disabled={!isFull}
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
