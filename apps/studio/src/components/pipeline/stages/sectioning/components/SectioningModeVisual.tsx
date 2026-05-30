import { Trans } from "@lingui/react/macro"
import { DiagramWithLabel } from "@/components/pipeline/components/DiagramWithLabel"
import { ACCENT_VAR, ACCENT_VAR_LIGHT } from "@/components/pipeline/lib/accent-var"

export function SectioningModeVisual() {
  return (
    <div className="flex flex-col items-center gap-3 py-1">
      <DiagramWithLabel label={<Trans>Dynamic</Trans>}>
        <DynamicModeDiagram />
      </DiagramWithLabel>
      <div
        className="h-px w-16"
        style={{ background: ACCENT_VAR, opacity: 0.18 }}
        aria-hidden
      />
      <DiagramWithLabel label={<Trans>Page</Trans>}>
        <PageModeDiagram />
      </DiagramWithLabel>
    </div>
  )
}

function PageModeDiagram() {
  const accent = (op: number) => ({ background: ACCENT_VAR, opacity: op })
  return (
    <div className="flex items-center justify-center gap-2.5">
      <div
        className="relative flex h-[64px] w-[44px] flex-col overflow-hidden rounded border p-1.5"
        style={{ borderColor: ACCENT_VAR }}
      >
        <div className="absolute inset-0" style={accent(0.05)} aria-hidden />
        <div className="relative flex flex-1 flex-col gap-1">
          <div className="h-1 w-full rounded-full" style={accent(0.4)} />
          <div className="h-1 w-3/4 rounded-full" style={accent(0.4)} />
          <div className="mt-1 h-3 w-full rounded" style={accent(0.18)} />
          <div className="h-1 w-full rounded-full" style={accent(0.4)} />
          <div className="h-1 w-2/3 rounded-full" style={accent(0.4)} />
        </div>
      </div>
      <span
        className="text-[10px] font-medium"
        style={{ color: ACCENT_VAR_LIGHT, opacity: 0.7 }}
        aria-hidden
      >
        =
      </span>
      <div
        className="relative flex h-[64px] w-[44px] flex-col overflow-hidden rounded border-2 p-1.5"
        style={{ borderColor: ACCENT_VAR }}
      >
        <div className="absolute inset-0" style={accent(0.1)} aria-hidden />
        <div className="relative flex flex-1 flex-col gap-1">
          <div className="h-1 w-full rounded-full" style={accent(0.75)} />
          <div className="h-1 w-3/4 rounded-full" style={accent(0.75)} />
          <div className="mt-1 h-3 w-full rounded" style={accent(0.3)} />
          <div className="h-1 w-full rounded-full" style={accent(0.75)} />
          <div className="h-1 w-2/3 rounded-full" style={accent(0.75)} />
        </div>
      </div>
    </div>
  )
}

function DynamicModeDiagram() {
  const accent = (op: number) => ({ background: ACCENT_VAR, opacity: op })
  return (
    <div className="flex items-center justify-center gap-2.5">
      <div
        className="relative flex h-[64px] w-[44px] flex-col overflow-hidden rounded border p-1.5"
        style={{ borderColor: ACCENT_VAR }}
      >
        <div className="absolute inset-0" style={accent(0.05)} aria-hidden />
        <div className="relative flex flex-1 flex-col gap-0.5">
          <div className="h-0.5 w-full rounded-full" style={accent(0.45)} />
          <div className="h-0.5 w-3/4 rounded-full" style={accent(0.45)} />
          <div className="mt-0.5 h-px w-full border-t border-dashed border-amber-400/70" />
          <div className="mt-0.5 h-0.5 w-full rounded-full bg-amber-500/65" />
          <div className="h-0.5 w-2/3 rounded-full bg-amber-500/65" />
        </div>
      </div>
      <svg
        className="h-2.5 w-3 shrink-0"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden
        style={{ color: ACCENT_VAR_LIGHT, opacity: 0.8 }}
      >
        <path
          d="M2 6h8M7 3l3 3-3 3"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex flex-col gap-1">
        <div
          className="relative flex h-[28px] w-[44px] flex-col justify-center gap-0.5 overflow-hidden rounded border-2 px-1.5"
          style={{ borderColor: ACCENT_VAR }}
        >
          <div className="absolute inset-0" style={accent(0.1)} aria-hidden />
          <div className="relative h-0.5 w-full rounded-full" style={accent(0.8)} />
          <div className="relative h-0.5 w-3/4 rounded-full" style={accent(0.8)} />
        </div>
        <div className="flex h-[28px] w-[44px] flex-col justify-center gap-0.5 rounded border-2 border-amber-400/80 bg-amber-100/80 px-1.5">
          <div className="h-0.5 w-full rounded-full bg-amber-500/80" />
          <div className="h-0.5 w-2/3 rounded-full bg-amber-500/80" />
        </div>
      </div>
    </div>
  )
}
