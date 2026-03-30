import { cn } from "@/lib/utils"

export interface SegmentedControlOption<T extends string = string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[]
  value: T
  onValueChange: (value: T) => void
  className?: string
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onValueChange,
  className,
}: SegmentedControlProps<T>) {
  const activeIndex = options.findIndex((o) => o.value === value)

  return (
    <div
      className={cn(
        "relative flex h-11 items-center rounded-lg bg-[#f5f5f5] p-1",
        className,
      )}
      role="radiogroup"
    >
      <div
        className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm transition-all duration-200"
        style={{
          width: `calc((100% - 8px) / ${options.length})`,
          left: `calc(4px + ${activeIndex} * (100% - 8px) / ${options.length})`,
        }}
      />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onValueChange(option.value)}
          className={cn(
            "relative z-10 flex h-7 flex-1 cursor-pointer items-center justify-center rounded-md text-sm transition-colors",
            value === option.value
              ? "font-bold text-[#2b7fff]"
              : "font-normal text-[#737373] hover:text-[#525252]",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
