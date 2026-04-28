import { cn } from "@/lib/utils"

interface ColorInputProps {
  value: string
  onChange: (next: string) => void
  className?: string
}

export function ColorInput({ value, onChange, className }: ColorInputProps) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-2 h-8 w-full bg-muted/60 rounded-md pl-1.5 pr-2",
        "focus-within:bg-background focus-within:ring-1 focus-within:ring-inset focus-within:ring-violet-500",
        className
      )}
    >
      <span className="relative inline-block h-5 w-5 shrink-0 overflow-hidden rounded border border-border/60">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer border-0 bg-transparent p-0 [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-moz-color-swatch]:border-0"
        />
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 bg-transparent text-[12px] tabular-nums outline-none"
      />
    </div>
  )
}
