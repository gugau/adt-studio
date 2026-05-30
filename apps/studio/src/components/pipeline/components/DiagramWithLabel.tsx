import type { ReactNode } from "react"
import { ACCENT_VAR } from "@/components/pipeline/lib/accent-var"

/**
 * Centered diagram + accent-coloured uppercase caption. Used inside
 * `SettingExplainer` popovers to label small illustrative diagrams.
 */
export function DiagramWithLabel({
  label,
  children,
}: {
  label: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      {children}
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: ACCENT_VAR }}
      >
        {label}
      </span>
    </div>
  )
}
