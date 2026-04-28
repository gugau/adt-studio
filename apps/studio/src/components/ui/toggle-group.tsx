import * as React from "react"
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group"
import type { VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { toggleVariants } from "@/components/ui/toggle"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface ToggleGroupContextValue
  extends VariantProps<typeof toggleVariants> {
  /** True when the parent group is rendering a sliding indicator. Items
   *  switch their active style to color-only so the indicator owns the bg. */
  sliding?: boolean
  /**
   * In multi-select mode, when adjacent items are both active their touching
   * corners get flattened so the active masks merge into one continuous bar.
   * Map of item value → corner-flatten classes for that item.
   */
  mergeClassMap?: Map<string, string>
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({
  size: "sm",
  variant: "default",
  sliding: false,
})

type ToggleGroupRootProps = React.ComponentPropsWithoutRef<
  typeof ToggleGroupPrimitive.Root
> &
  VariantProps<typeof toggleVariants> & {
    /**
     * When true and `type="single"`, render an Apple-style sliding indicator
     * behind the active item that animates between positions.
     */
    sliding?: boolean
  }

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  ToggleGroupRootProps
>(({ className, variant, size, sliding, children, ...props }, ref) => {
  const isSingle = props.type === "single"
  const rawValue =
    "value" in props
      ? (props as { value?: string | string[] }).value
      : undefined
  const rawDefault =
    "defaultValue" in props
      ? (props as { defaultValue?: string | string[] }).defaultValue
      : undefined
  const currentValue =
    typeof rawValue === "string"
      ? rawValue
      : typeof rawDefault === "string"
        ? rawDefault
        : undefined

  const items = React.Children.toArray(children)
  const itemCount = items.length

  const activeIndex =
    sliding && isSingle && currentValue
      ? items.findIndex(
          (child) =>
            React.isValidElement(child) &&
            (child.props as { value?: string }).value === currentValue
        )
      : -1

  const indicatorVisible =
    !!sliding && isSingle && itemCount > 0 && activeIndex >= 0

  // Multi-select merge: when adjacent items are both active, flatten their
  // touching corners so the active masks read as one continuous block.
  const isMulti = props.type === "multiple"
  const valueArray =
    isMulti && Array.isArray(rawValue) ? (rawValue as string[]) : null

  const mergeClassMap = React.useMemo(() => {
    if (!isMulti || !valueArray || valueArray.length < 2) return undefined
    const map = new Map<string, string>()
    items.forEach((child, i) => {
      if (!React.isValidElement(child)) return
      const v = (child.props as { value?: string }).value
      if (!v || !valueArray.includes(v)) return
      const prev = items[i - 1]
      const next = items[i + 1]
      const prevActive =
        React.isValidElement(prev) &&
        valueArray.includes(
          (prev.props as { value?: string }).value ?? ""
        )
      const nextActive =
        React.isValidElement(next) &&
        valueArray.includes(
          (next.props as { value?: string }).value ?? ""
        )
      const classes: string[] = []
      if (prevActive) classes.push("rounded-l-none")
      if (nextActive) classes.push("rounded-r-none")
      if (classes.length) map.set(v, classes.join(" "))
    })
    return map.size > 0 ? map : undefined
  }, [isMulti, valueArray, items])

  return (
    <ToggleGroupPrimitive.Root
      ref={ref}
      className={cn(
        "relative inline-flex items-center rounded-md bg-muted/60",
        sliding && "w-full",
        className
      )}
      {...props}
    >
      {indicatorVisible ? (
        <div
          aria-hidden
          className={cn(
            "absolute top-0.5 bottom-0.5 bg-background shadow-sm transition-all duration-200 ease-out pointer-events-none rounded-md"
          )}
          style={{
            width: `calc(100% / ${itemCount} - 4px)`,
            left: `calc(${activeIndex} * (100% / ${itemCount}) + 2px)`,
          }}
        />
      ) : null}
      <ToggleGroupContext.Provider
        value={{ variant, size, sliding: indicatorVisible, mergeClassMap }}
      >
        <TooltipProvider delayDuration={500}>{children}</TooltipProvider>
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  )
})
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
    VariantProps<typeof toggleVariants>
>(({ className, children, variant, size, title, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext)
  const mergeClass =
    context.mergeClassMap?.get(props.value as string) ?? ""

  const hasTooltip = typeof title === "string" && title.length > 0

  const item = (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        toggleVariants({
          variant: context.variant ?? variant,
          size: context.size ?? size,
        }),
        // In sliding mode, items sit above the indicator (which provides the
        // white active mask + shadow). Items only contribute the violet text
        // color; their own bg/shadow is suppressed so the indicator owns it.
        context.sliding && "data-[state=on]:bg-transparent data-[state=on]:text-violet-600 data-[state=on]:shadow-none relative z-10",
        // In sliding mode the item must fill its flex cell (either directly as
        // the flex child, or via w-full when a tooltip span wraps it).
        context.sliding && !hasTooltip && "flex-1",
        context.sliding && hasTooltip && "w-full",
        mergeClass,
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )

  if (!hasTooltip) return item

  // Wrap in a <span> so TooltipTrigger asChild's `data-state="closed"`
  // (open/closed) lands on the span rather than the underlying button —
  // otherwise it would clobber the Item's own `data-state="on/off"` and
  // disable the active styling that Tailwind selectors depend on.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn("inline-flex", context.sliding && "flex-1")}
        >
          {item}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} variant="light">
        {title}
      </TooltipContent>
    </Tooltip>
  )
})
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName

export { ToggleGroup, ToggleGroupItem }
