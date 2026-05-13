import type { ReactNode } from "react"
import { Trans } from "@lingui/react/macro"
import { ACCENT_VAR } from "@/components/pipeline/lib/accent-var"
import { DiagramWithLabel } from "@/components/pipeline/components/DiagramWithLabel"

// eslint-disable-next-line lingui/no-unlocalized-strings -- pagination labels, identical across locales
const PAGE_LABELS = ["P1", "P2", "P3", "P4", "P5"] as const

export function PageGroupingVisual() {
  return (
    <div className="flex flex-col gap-3 py-1">
      <DiagramWithLabel label={<Trans>Spread</Trans>}>
        <SpreadPagesDiagram />
      </DiagramWithLabel>
      <div
        className="mx-auto h-px w-16"
        style={{ background: ACCENT_VAR, opacity: 0.18 }}
        aria-hidden
      />
      <DiagramWithLabel label={<Trans>Single</Trans>}>
        <SinglePagesDiagram />
      </DiagramWithLabel>
    </div>
  )
}

function NeutralPage({ label }: { label: ReactNode }) {
  return (
    <div className="flex h-[60px] w-7 items-center justify-center rounded border border-[#e5e5e5] bg-white text-[8px] font-medium text-[#a3a3a3]">
      {label}
    </div>
  )
}

function SpreadPair({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div
      className="relative flex h-[60px] w-[56px] overflow-hidden rounded border-2"
      style={{ borderColor: ACCENT_VAR }}
    >
      <div
        className="absolute inset-0"
        style={{ background: ACCENT_VAR, opacity: 0.1 }}
        aria-hidden
      />
      <div
        className="relative flex flex-1 items-center justify-center border-r border-dashed text-[8px] font-semibold"
        style={{ color: ACCENT_VAR, borderColor: ACCENT_VAR }}
      >
        {left}
      </div>
      <div
        className="relative flex flex-1 items-center justify-center text-[8px] font-semibold"
        style={{ color: ACCENT_VAR }}
      >
        {right}
      </div>
    </div>
  )
}

function SpreadPagesDiagram() {
  return (
    <div className="flex items-end justify-center gap-1.5">
      <NeutralPage label={<Trans>Cover</Trans>} />
      <SpreadPair left={PAGE_LABELS[1]} right={PAGE_LABELS[2]} />
      <SpreadPair left={PAGE_LABELS[3]} right={PAGE_LABELS[4]} />
    </div>
  )
}

function SinglePagesDiagram() {
  return (
    <div className="flex items-end justify-center gap-1.5">
      {PAGE_LABELS.map((label, i) => (
        <NeutralPage key={i} label={label} />
      ))}
    </div>
  )
}

