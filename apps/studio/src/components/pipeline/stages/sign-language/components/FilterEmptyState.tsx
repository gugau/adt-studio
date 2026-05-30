import { CheckCircle2, Layers, VideoOff } from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import { cn } from "@/lib/utils"
import type { FilterValue } from "./types"

export function FilterEmptyState({ filter }: { filter: FilterValue }) {
  const { t } = useLingui()
  const config =
    filter === "missing"
      ? {
          tag: t`All set`,
          tagClass: "bg-emerald-100 text-emerald-700",
          glowClass: "bg-emerald-200/40",
          Icon: CheckCircle2,
          iconBgClass: "bg-emerald-50 border-emerald-200",
          iconColorClass: "text-emerald-700",
          title: t`All sections are covered`,
          body: (
            <Trans>
              Every Storyboard section has a sign-language video assigned. You
              can switch to Covered or All to review or replace them.
            </Trans>
          ),
        }
      : filter === "covered"
        ? {
            tag: t`Empty`,
            tagClass: "bg-cyan-100 text-cyan-700",
            glowClass: "bg-cyan-200/40",
            Icon: VideoOff,
            iconBgClass: "bg-cyan-50 border-cyan-200",
            iconColorClass: "text-cyan-700",
            title: t`No videos assigned yet`,
            body: (
              <Trans>
                Upload a sign-language video for any section and it'll appear
                here. Switch to Missing to see what still needs one.
              </Trans>
            ),
          }
        : {
            tag: t`No sections`,
            tagClass: "bg-violet-100 text-violet-700",
            glowClass: "bg-violet-200/40",
            Icon: Layers,
            iconBgClass: "bg-violet-50 border-violet-200",
            iconColorClass: "text-violet-700",
            title: t`No sections to show`,
            body: (
              <Trans>
                Run Storyboard to generate sections you can match
                sign-language videos to.
              </Trans>
            ),
          }
  const { Icon } = config
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="relative flex max-w-md flex-col items-center gap-5 overflow-hidden rounded-2xl border border-[#ececec] bg-white px-8 py-9 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] motion-safe:animate-in motion-safe:fade-in-50 motion-safe:zoom-in-95 motion-safe:duration-500 motion-safe:ease-out">
        <div
          className={cn(
            "pointer-events-none absolute -top-16 left-1/2 h-32 w-48 -translate-x-1/2 rounded-full blur-3xl",
            config.glowClass,
          )}
          aria-hidden
        />
        <div
          className={cn(
            "relative flex h-12 w-12 items-center justify-center rounded-full border",
            config.iconBgClass,
          )}
        >
          <Icon
            className={cn("h-5 w-5", config.iconColorClass)}
            strokeWidth={2}
            aria-hidden
          />
        </div>
        <div className="relative flex flex-col items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
              config.tagClass,
            )}
          >
            {config.tag}
          </span>
          <h2 className="text-[17px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
            {config.title}
          </h2>
          <p className="w-[34ch] text-balance text-[13.5px] leading-relaxed text-[#525252]">
            {config.body}
          </p>
        </div>
      </div>
    </div>
  )
}
