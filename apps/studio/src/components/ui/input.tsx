import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps extends React.ComponentProps<"input"> {
  /** Icon or node rendered inside the input on the left, decorative by default. */
  prependIcon?: React.ReactNode
  /** Icon or node rendered inside the input on the right (e.g. clear button). */
  appendIcon?: React.ReactNode
  /** Class applied to the outer wrapper when prepend/append slots are used. */
  wrapperClassName?: string
}

const baseClasses =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      prependIcon,
      appendIcon,
      wrapperClassName,
      ...props
    },
    ref
  ) => {
    if (!prependIcon && !appendIcon) {
      return (
        <input
          type={type}
          className={cn(baseClasses, className)}
          ref={ref}
          {...props}
        />
      )
    }

    return (
      <div className={cn("relative w-full", wrapperClassName)}>
        {prependIcon ? (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center text-muted-foreground/60 pointer-events-none">
            {prependIcon}
          </span>
        ) : null}
        <input
          type={type}
          className={cn(
            baseClasses,
            prependIcon && "pl-7",
            appendIcon && "pr-7",
            className
          )}
          ref={ref}
          {...props}
        />
        {appendIcon ? (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center text-muted-foreground/60">
            {appendIcon}
          </span>
        ) : null}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
