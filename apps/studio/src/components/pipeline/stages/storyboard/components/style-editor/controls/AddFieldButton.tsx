import { useState, type ReactNode } from "react"
import { Plus } from "lucide-react"
import { Trans } from "@lingui/react/macro"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface AddFieldButtonOption<T extends string> {
  value: T
  label: ReactNode
}

interface AddFieldButtonProps<T extends string> {
  options: ReadonlyArray<AddFieldButtonOption<T>>
  onSelect: (value: T) => void
  /** Tooltip / aria-label for the trigger. Falls back to "Add field". */
  ariaLabel?: string
}

/**
 * Compact `+` icon button for the Section header's trailing-action slot.
 * Opens a popover with a list of optional fields the user can enable.
 * Hides itself when there's nothing left to add.
 */
export function AddFieldButton<T extends string>({
  options,
  onSelect,
  ariaLabel,
}: AddFieldButtonProps<T>) {
  const [open, setOpen] = useState(false)
  if (options.length === 0) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          title={ariaLabel}
          className={cn(
            "h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground/70 cursor-pointer outline-none transition-colors",
            "hover:text-foreground hover:bg-accent/40",
            "data-[state=open]:text-violet-600 data-[state=open]:bg-violet-50"
          )}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1 rounded-md" align="end" sideOffset={4}>
        <div className="flex flex-col">
          {options.length === 0 ? (
            <span className="px-2 py-1.5 text-[12px] text-muted-foreground">
              <Trans>No fields to add</Trans>
            </span>
          ) : null}
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
  )
}
