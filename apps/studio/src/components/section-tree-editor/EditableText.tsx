import { useCallback, useEffect, useRef, useState } from "react"
import { useLingui } from "@lingui/react/macro"
import { cn } from "@/lib/utils"

export interface EditableTextProps {
  value: string
  onCommit: (next: string) => void
  disabled?: boolean
  placeholder?: string
}

export function EditableText({
  value,
  onCommit,
  disabled,
  placeholder,
}: EditableTextProps) {
  const { t } = useLingui()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  // Guard against double-commit (Enter triggers blur when textarea is removed)
  // and against committing on Escape (blur fires when editing is cancelled).
  const cancelRef = useRef(false)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  const commit = useCallback(() => {
    if (cancelRef.current) {
      cancelRef.current = false
      return
    }
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) {
      onCommit(trimmed)
    } else {
      setDraft(value)
    }
  }, [draft, value, onCommit])

  if (!editing) {
    return (
      <span
        className={cn(
          "leading-relaxed flex-1 min-w-0 text-xs rounded px-0.5 -mx-0.5 transition-colors",
          disabled
            ? "cursor-default opacity-60"
            : "cursor-text hover:bg-accent/50",
          !value && "italic text-muted-foreground/60"
        )}
        onClick={() => {
          if (!disabled) setEditing(true)
        }}
        title={disabled ? undefined : t`Click to edit`}
      >
        {value || placeholder || t`(empty)`}
      </span>
    )
  }

  return (
    <textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          cancelRef.current = false
          e.currentTarget.blur()
        }
        if (e.key === "Escape") {
          cancelRef.current = true
          setDraft(value)
          setEditing(false)
        }
      }}
      className="leading-relaxed flex-1 min-w-0 text-xs rounded border border-ring bg-background px-1 py-0.5 -mx-0.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
      rows={Math.max(2, Math.ceil(draft.length / 50))}
      autoFocus
    />
  )
}
