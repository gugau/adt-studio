import {
  Select as RadixSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface SelectOption<T extends string> {
  value: T
  label: string
}

interface SelectProps<T extends string> {
  value: T
  onChange: (next: T) => void
  options: ReadonlyArray<SelectOption<T>>
  placeholder?: string
  disabled?: boolean
  className?: string
}

/**
 * Style-editor-tuned wrapper around the shadcn Select. Standardizes height
 * (h-8), typography (text-[12px]), and removes the focus-ring offset so it
 * sits flush in the StyleLabel control column.
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
}: SelectProps<T>) {
  return (
    <RadixSelect
      value={value}
      onValueChange={(v) => onChange(v as T)}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          "h-8 w-full text-[12px] px-2 py-0 focus:ring-offset-0",
          className
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-[12px]">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </RadixSelect>
  )
}
