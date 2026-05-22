import * as React from "react"
import type { CSSProperties } from "react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

export type BrandedSwitchProps = React.ComponentPropsWithoutRef<typeof Switch> & {
  decorative?: boolean
  color?: string
}

export const BrandedSwitch = React.forwardRef<
  React.ElementRef<typeof Switch>,
  BrandedSwitchProps
>(({ className, disabled, decorative, onCheckedChange, color, style, ...props }, ref) => (
  <Switch
    ref={ref}
    disabled={disabled}
    aria-hidden={decorative ? true : undefined}
    tabIndex={decorative ? -1 : undefined}
    onCheckedChange={decorative ? () => {} : onCheckedChange}
    style={color ? ({ "--switch-color": color, ...style } as CSSProperties) : style}
    className={cn(
      "h-6 w-11 shrink-0 transition-colors duration-300",
      decorative ? "pointer-events-none cursor-default" : "cursor-pointer",
      color
        ? "data-[state=checked]:bg-[var(--switch-color)]"
        : "data-[state=checked]:bg-primary",
      "data-[state=unchecked]:bg-input",
      !decorative && [
        "hover:ring-2 hover:ring-ring/45 hover:ring-offset-2 hover:ring-offset-background",
        "active:scale-[0.98] active:transition-none",
      ],
      "disabled:cursor-not-allowed disabled:hover:ring-0",
      className,
    )}
    {...props}
  />
))
BrandedSwitch.displayName = "BrandedSwitch"
