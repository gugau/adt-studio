import * as React from "react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

export type ImageProcessingSwitchProps = React.ComponentPropsWithoutRef<typeof Switch> & {
  decorative?: boolean
}

export const ImageProcessingSwitch = React.forwardRef<
  React.ElementRef<typeof Switch>,
  ImageProcessingSwitchProps
>(({ className, disabled, decorative, onCheckedChange, ...props }, ref) => (
  <Switch
    ref={ref}
    disabled={disabled}
    aria-hidden={decorative ? true : undefined}
    tabIndex={decorative ? -1 : undefined}
    onCheckedChange={decorative ? () => {} : onCheckedChange}
    className={cn(
      "h-6 w-11 shrink-0",
      decorative ? "pointer-events-none cursor-default" : "cursor-pointer",
      "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
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
ImageProcessingSwitch.displayName = "ImageProcessingSwitch"
