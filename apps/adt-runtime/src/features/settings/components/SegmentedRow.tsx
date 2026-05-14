import { useId } from "react"
import { cn } from "@/shared/lib/utils"

interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedRowProps<T extends string> {
  label: string
  value: T
  options: SegmentedOption<T>[]
  onChange: (next: T) => void
  borderTop?: boolean
  className?: string
}

/**
 * Labelled row with an inline segmented control on the right. Used for
 * binary-ish settings choices (dock width, dock position) where a dropdown
 * would be more friction than the choice merits.
 */
export function SegmentedRow<T extends string>({
  label,
  value,
  options,
  onChange,
  borderTop = false,
  className,
}: SegmentedRowProps<T>) {
  const groupId = useId()
  return (
    <div
      className={cn(
        "flex items-center justify-between py-2 gap-2",
        borderTop && "border-t border-border",
        className,
      )}
      role="group"
      aria-labelledby={groupId}
    >
      <span id={groupId} className="text-base font-medium text-foreground">
        {label}
      </span>
      <div className="inline-flex rounded-lg bg-muted p-0.5 ring-1 ring-border">
        {options.map((opt) => {
          const active = opt.value === value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={cn(
                "px-4 py-2 text-base rounded-md transition-colors duration-150",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
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
