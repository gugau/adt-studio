import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { useId } from "react"

interface ToggleRowProps {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  description?: string
  className?: string
  borderTop?: boolean
}

/**
 * Replaces the legacy "labelled button + manual toggle dot" pattern from
 * interface.html (one of those for every sidebar option). Same a11y shape:
 * a row that's part of the Settings/Assistant tab content, with a label
 * association so screen readers announce the row label as the switch's name.
 */
export function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
  description,
  className,
  borderTop = false,
}: ToggleRowProps) {
  const id = useId()
  return (
    <div
      className={cn(
        "flex items-center justify-between py-3 gap-2",
        borderTop && "border-t border-gray-200",
        className,
      )}
    >
      <label htmlFor={id} className="flex flex-col gap-1 cursor-pointer">
        <span className="text-base font-medium text-foreground">{label}</span>
        {description ? (
          <span className="text-xs text-muted-foreground">{description}</span>
        ) : null}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  )
}
