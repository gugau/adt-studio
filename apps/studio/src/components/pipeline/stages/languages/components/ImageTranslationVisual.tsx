import { ArrowRight } from "lucide-react"
import { Trans } from "@lingui/react/macro"
import { cn } from "@/lib/utils"

export function ImageTranslationVisual() {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
        <SchoolPhoto label="School" variant="source" />
        <ArrowRight
          className="h-3.5 w-3.5 text-pink-500"
          strokeWidth={2.25}
          aria-hidden
        />
        <SchoolPhoto label="Escuela" variant="target" />
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2.5 text-center text-[9.5px] font-semibold uppercase tracking-[0.14em]">
        <span className="text-[#a3a3a3]">
          <Trans>English</Trans>
        </span>
        <span aria-hidden />
        <span className="text-pink-600">
          <Trans>Spanish</Trans>
        </span>
      </div>
    </div>
  )
}

function SchoolPhoto({
  label,
  variant,
}: {
  label: string
  variant: "source" | "target"
}) {
  const isTarget = variant === "target"
  return (
    <div className="relative h-[90px] overflow-hidden rounded-md border border-black/10 bg-gradient-to-b from-sky-300/80 via-sky-200/60 to-emerald-100/80 shadow-sm">
      <div className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-amber-300/90 shadow-[0_0_6px_rgba(252,211,77,0.6)]" />
      <div
        className="absolute inset-x-0 bottom-7 h-3 bg-emerald-300/40"
        style={{
          clipPath:
            "polygon(0 100%, 15% 30%, 35% 65%, 55% 20%, 80% 55%, 100% 35%, 100% 100%)",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-b from-emerald-400/70 to-emerald-500/80"
        aria-hidden
      />
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center">
        <div
          className="h-0 w-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-b-[12px] border-b-rose-900"
          aria-hidden
        />
        <div className="flex h-7 w-10 flex-col items-center justify-end gap-0.5 bg-orange-200/95 pt-1 ring-1 ring-black/10">
          <div className="grid grid-cols-3 gap-[2px]">
            <span className="h-1 w-1.5 rounded-[1px] bg-sky-700/50" />
            <span className="h-1 w-1.5 rounded-[1px] bg-sky-700/50" />
            <span className="h-1 w-1.5 rounded-[1px] bg-sky-700/50" />
          </div>
          <div className="h-1.5 w-1.5 rounded-t-[1px] bg-[#3b2417]" />
        </div>
      </div>
      <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2">
        <div
          className={cn(
            "relative whitespace-nowrap rounded-[8px] border px-2 py-[3px] text-[9px] font-semibold uppercase tracking-wider shadow-sm transition-colors",
            isTarget
              ? "border-pink-300 bg-pink-500 text-white ring-1 ring-pink-200/70"
              : "border-black/15 bg-white/95 text-[#1a1a1a]",
          )}
        >
          {label}
          <span
            className={cn(
              "absolute left-1/2 top-full -translate-x-1/2 -translate-y-[0.5px] h-0 w-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent",
              isTarget ? "border-t-pink-300" : "border-t-black/15",
            )}
            aria-hidden
          />
          <span
            className={cn(
              "absolute left-1/2 top-full -translate-x-1/2 -translate-y-[1.5px] h-0 w-0 border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent",
              isTarget ? "border-t-pink-500" : "border-t-white/95",
            )}
            aria-hidden
          />
        </div>
      </div>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.18),transparent_55%)]"
        aria-hidden
      />
    </div>
  )
}
