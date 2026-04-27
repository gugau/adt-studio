import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface StyleLabelProps {
  /** Label text shown on the left column */
  label: ReactNode
  /** Optional id of the input on the right column (for label/htmlFor association) */
  htmlFor?: string
  /** The control(s) rendered on the right column */
  children: ReactNode
  /**
   * True when the value rendered by `children` comes from an override at the
   * current breakpoint. The label gets an "active" treatment so the user can
   * tell it's not just inheriting from a wider breakpoint.
   *
   * (Step 7 will wire this up + an Alt+Click reset popover — see lowcode's
   * StyleLabel for the reference behavior.)
   */
  overridden?: boolean
  /** Optional class on the row wrapper */
  className?: string
}

/**
 * Field row primitive for the style editor. Owns the label/control grid so
 * every section's fields line up identically. The label area is also the hook
 * for breakpoint-override indication and reset (added in a later step).
 */
export function StyleLabel({
  label,
  htmlFor,
  children,
  overridden,
  className,
}: StyleLabelProps) {
  return (
    <div className={cn("grid grid-cols-5 gap-2", className)}>
      {/*
        `self-start h-8` pins the label to a fixed first-row slot at the top of
        its grid column, so multi-row controls (e.g. BoxInput in split mode)
        keep the label aligned with the FIRST input row instead of letting it
        drift to the vertical center of the whole control.
      */}
      <label
        htmlFor={htmlFor}
        className={cn(
          "col-span-2 h-8 self-start flex items-center text-[12px] font-medium px-0.5 select-none truncate",
          overridden ? "text-blue-600" : "text-muted-foreground/90"
        )}
      >
        {label}
      </label>
      <div className="col-span-3 min-w-0 min-h-8 flex items-center gap-1.5">
        {children}
      </div>
    </div>
  )
}
