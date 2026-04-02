import { useMemo } from "react"
import { msg } from "@lingui/core/macro"
import { useLingui } from "@lingui/react/macro"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SectioningModeId } from "@/components/wizard/constants"

function PageIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect x="3" y="2" width="18" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <line x1="7" y1="7" x2="17" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="7" y1="10.5" x2="14" y2="10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="7" y="13" width="10" height="5" rx="1" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    </svg>
  )
}

function DynamicIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect x="3" y="2" width="18" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <line x1="7" y1="5.5" x2="17" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="3" y="11" width="18" height="5" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      <rect x="3" y="18" width="18" height="4" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
    </svg>
  )
}

function SectionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect x="3" y="2" width="18" height="5" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="9" width="18" height="5" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="16" width="18" height="6" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <line x1="7" y1="4.5" x2="13" y2="4.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <line x1="7" y1="11.5" x2="15" y2="11.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <line x1="7" y1="19" x2="11" y2="19" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

const SECTIONING_SELECT_PLACEHOLDER = msg`Select section mode`

const SECTIONING_OPTIONS_META = [
  { value: "page" as const, labelMsg: msg`Page`, Icon: PageIcon },
  { value: "dynamic" as const, labelMsg: msg`Dynamic`, Icon: DynamicIcon },
  { value: "section" as const, labelMsg: msg`Section`, Icon: SectionIcon },
] as const

export type SectioningModeSelectProps = {
  id: string
  value: SectioningModeId | ""
  onValueChange: (value: SectioningModeId) => void
}

export function SectioningModeSelect({ id, value, onValueChange }: SectioningModeSelectProps) {
  const { i18n } = useLingui()

  const options = useMemo(
    () =>
      SECTIONING_OPTIONS_META.map(({ value: v, labelMsg, Icon }) => ({
        value: v,
        label: i18n._(labelMsg),
        Icon,
      })),
    [i18n],
  )

  const selected = options.find((o) => o.value === value)

  return (
    <Select
      value={value === "" ? undefined : value}
      onValueChange={(v) => onValueChange(v as SectioningModeId)}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={i18n._(SECTIONING_SELECT_PLACEHOLDER)}>
          {selected && (
            <span className="flex items-center gap-2">
              <selected.Icon className="size-4 shrink-0 text-muted-foreground" />
              {selected.label}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            <span className="flex items-center gap-2">
              <o.Icon className="size-4 shrink-0 text-muted-foreground" />
              {o.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
