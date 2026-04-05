import { cn } from "@/lib/utils"

export interface SegmentedControlOption<T extends string = string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[]
  value: T | ""
  onValueChange: (value: T) => void
  className?: string
  color?: string
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onValueChange,
  className,
  color,
}: SegmentedControlProps<T>) {
  const activeIndex = options.findIndex((o) => o.value === value)
  const showIndicator = activeIndex >= 0 && options.length > 0

  return (
    <div
      className={cn(
        "relative flex h-11 items-center rounded-lg bg-[#f5f5f5] p-1",
        className,
      )}
      role="radiogroup"
    >
      {showIndicator ? (
        <div
          className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm transition-all duration-200"
          style={{
            width: `calc((100% - 8px) / ${options.length})`,
            left: `calc(4px + ${activeIndex} * (100% - 8px) / ${options.length})`,
          }}
        />
      ) : null}
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onValueChange(option.value)}
          className={cn(
            "relative z-10 flex h-7 flex-1 cursor-pointer items-center justify-center rounded-md text-sm",
            value === option.value
              ? "font-bold"
              : "font-normal text-[#737373] hover:text-[#525252]",
          )}
          style={
            value === option.value
              ? { color: color ?? "#2b7fff", transition: "color 0.4s ease" }
              : { transition: "color 0.4s ease" }
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
