import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useDockContext } from "./dock-context"

export interface DockIconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  ariaLabel: string
  /** Override tooltip text; defaults to `ariaLabel`. */
  tooltip?: string
  pressed?: boolean
  size?: "sm" | "default"
}

/**
 * Icon-only dock control. Every instance gets:
 *
 *   - `aria-label`   — required, for screen readers
 *   - `title`        — native browser tooltip + fallback for any SR that
 *                      prefers it
 *   - shadcn Tooltip — visible, styled tooltip on hover/focus
 *
 * The tooltip side follows the dock position: docks on the bottom open
 * their tooltips upward; docks on the top open them downward.
 */
export function DockIconButton({
  ariaLabel,
  tooltip,
  pressed,
  size = "default",
  className,
  children,
  ...props
}: DockIconButtonProps) {
  const { popoverSide } = useDockContext()
  const label = tooltip ?? ariaLabel
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={ariaLabel}
            title={label}
            aria-pressed={pressed}
            data-dock-trigger=""
            className={cn(
              "rounded-lg flex items-center justify-center shrink-0",
              "text-foreground/80 hover:bg-accent hover:text-accent-foreground",
              "transition-colors duration-150",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:opacity-30 disabled:hover:bg-transparent",
              "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
              "aria-pressed:bg-accent aria-pressed:text-accent-foreground",
              size === "sm" ? "h-7 w-7" : "h-10 w-10",
              className,
            )}
            {...props}
          >
            {children}
          </button>
        }
      />
      <TooltipContent side={popoverSide}>{label}</TooltipContent>
    </Tooltip>
  )
}
