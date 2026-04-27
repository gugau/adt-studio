import { useState, type ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { Trans } from "@lingui/react/macro"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface AddFieldRowOption<T extends string> {
  value: T
  label: ReactNode
}

interface AddFieldRowProps<T extends string> {
  /** Group label shown on the left (e.g. "Min Max") */
  label: ReactNode
  /** Icon shown inside the trigger, before the placeholder */
  icon?: LucideIcon
  /** Trigger placeholder text. Defaults to "Add…" */
  placeholder?: ReactNode
  options: ReadonlyArray<AddFieldRowOption<T>>
  onSelect: (value: T) => void
}

/**
 * Inline "add field" row that follows the same StyleLabel grid as other
 * fields: label on the left, an input-styled trigger on the right that opens
 * a popover with the available optional fields. Hides itself when nothing is
 * left to add.
 */
export function AddFieldRow<T extends string>({
  label,
  icon: Icon,
  placeholder,
  options,
  onSelect,
}: AddFieldRowProps<T>) {
  const [open, setOpen] = useState(false)
  if (options.length === 0) return null

  return (
    <div className="grid grid-cols-5 gap-2">
      <div className="col-span-2 h-8 self-start flex items-center text-[12px] font-medium px-0.5 text-muted-foreground/90 select-none truncate">
        {label}
      </div>
      <div className="col-span-3 min-w-0 min-h-8 flex items-center gap-1.5">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "h-8 w-full inline-flex items-center gap-2 px-2 rounded-md cursor-pointer",
                "bg-background border border-input text-[12px]",
                "hover:border-foreground/30 transition-colors",
                "data-[state=open]:ring-2 data-[state=open]:ring-ring"
              )}
            >
              {Icon ? (
                <span className="inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground shrink-0">
                  <Icon className="h-3.5 w-3.5" />
                </span>
              ) : null}
              <span className="text-muted-foreground/60 flex-1 text-left">
                {placeholder ?? <Trans>Add…</Trans>}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-44 p-1 rounded-md"
            align="start"
            sideOffset={4}
          >
            <div className="flex flex-col">
              {options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onSelect(o.value)
                    setOpen(false)
                  }}
                  className="text-left h-7 px-2 rounded text-[12px] text-foreground hover:bg-accent transition-colors cursor-pointer"
                >
                  {o.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
