/**
 * shadcn-style Tooltip primitive backed by Base UI.
 *
 *   https://ui.shadcn.com/docs/components/tooltip
 *   https://base-ui.com/react/components/tooltip
 *
 * Usage:
 *
 *   <TooltipProvider>           // mount once at the root (ChromeRoot)
 *     <Tooltip>
 *       <TooltipTrigger render={<button>...</button>} />
 *       <TooltipContent>Save</TooltipContent>
 *     </Tooltip>
 *   </TooltipProvider>
 *
 * The Portal targets `#interface-container` (same as the rest of the
 * chrome) so dark mode and stacking context match the buttons that
 * trigger them. Triggers can be rendered inline or via Base UI's `render`
 * prop when wrapping a custom element (e.g. `DockIconButton`).
 */
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import type { ComponentProps } from "react"
import { cn } from "@/shared/lib/utils"
import { getChromePortalContainer } from "@/shared/lib/chrome-portal"

export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

interface TooltipContentProps extends ComponentProps<typeof TooltipPrimitive.Popup> {
  side?: "top" | "bottom" | "left" | "right"
  sideOffset?: number
  align?: "start" | "center" | "end"
}

export function TooltipContent({
  className,
  side = "top",
  sideOffset = 6,
  align = "center",
  children,
  ...props
}: TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal container={getChromePortalContainer()}>
      <TooltipPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        className="isolate z-[60]"
      >
        <TooltipPrimitive.Popup
          className={cn(
            "max-w-xs rounded-md bg-popover px-2.5 py-1.5",
            "text-xs font-medium text-popover-foreground",
            "shadow-md ring-1 ring-border",
            "select-none pointer-events-none",
            "duration-100 data-[instant]:duration-0",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            "data-[side=bottom]:slide-in-from-top-1",
            "data-[side=top]:slide-in-from-bottom-1",
            "data-[side=left]:slide-in-from-right-1",
            "data-[side=right]:slide-in-from-left-1",
            "motion-reduce:animate-none motion-reduce:duration-0",
            className,
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}
