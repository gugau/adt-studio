import {
  useEffect,
  useRef,
  useState,
  type FocusEventHandler,
  type ReactNode,
} from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const COMMIT_DEBOUNCE_MS = 200

export interface NumericInputProps {
  value: number
  onCommit: (n: number) => void
  /** Right-side suffix (unit token, glyph, or any node). */
  suffix?: ReactNode
  disabled?: boolean
  placeholder?: string
  /** Hint to mobile keyboards. Defaults to "decimal" so `.` is reachable. */
  inputMode?: "numeric" | "decimal"
  className?: string
  onFocus?: FocusEventHandler<HTMLInputElement>
  onBlur?: FocusEventHandler<HTMLInputElement>
}

export function NumericInput({
  value,
  onCommit,
  suffix,
  disabled,
  placeholder = "0",
  inputMode = "decimal",
  className,
  onFocus,
  onBlur,
}: NumericInputProps) {
  const [draft, setDraft] = useState(String(value))
  const [focused, setFocused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!focused) setDraft(String(value))
  }, [value, focused])

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    []
  )

  const flush = (raw: string) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const trimmed = raw.trim()
    if (trimmed === "") {
      if (value !== 0) onCommit(0)
      return
    }
    const n = parseFloat(trimmed)
    if (!Number.isFinite(n)) {
      setDraft(String(value))
      return
    }
    if (n !== value) onCommit(n)
  }

  const append =
    typeof suffix === "string" || typeof suffix === "number" ? (
      <span className="text-[10px]">{suffix}</span>
    ) : (
      suffix
    )

  return (
    <Input
      type="text"
      inputMode={inputMode}
      value={draft}
      placeholder={placeholder}
      disabled={disabled}
      appendIcon={append}
      className={cn(
        "h-8 px-2 py-0 border-0 bg-muted/60 ring-offset-0 text-[12px] tabular-nums",
        "focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-violet-500 focus-visible:ring-offset-0",
        className
      )}
      onFocus={(e) => {
        setFocused(true)
        onFocus?.(e)
      }}
      onBlur={(e) => {
        setFocused(false)
        flush(draft)
        onBlur?.(e)
      }}
      onChange={(e) => {
        const next = e.target.value
        setDraft(next)
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          timerRef.current = null
          flush(next)
        }, COMMIT_DEBOUNCE_MS)
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          ;(e.currentTarget as HTMLInputElement).blur()
        } else if (e.key === "Escape") {
          setDraft(String(value))
          ;(e.currentTarget as HTMLInputElement).blur()
        }
      }}
    />
  )
}
