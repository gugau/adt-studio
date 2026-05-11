import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { ArrowRight, Scissors } from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import { cn } from "@/lib/utils"

type Reason = "storyboard-missing" | "all-pruned"

interface StageBlockedStateProps {
  bookLabel: string
  reason: Reason
  stageLabel: ReactNode
}

export function StageBlockedState({ bookLabel, reason, stageLabel }: StageBlockedStateProps) {
  const { t } = useLingui()

  const config =
    reason === "storyboard-missing"
      ? {
          tag: t`Blocked`,
          tagClass: "bg-violet-100 text-violet-700",
          illustration: <StoryboardMissingIllustration />,
          title: t`Build the storyboard first`,
          body: (
            <Trans>
              {stageLabel} isn't ready yet — Storyboard hasn't finished, so
              there's nothing to work with. Finish that stage first.
            </Trans>
          ),
          ctaLabel: t`Go to Storyboard`,
        }
      : {
          tag: t`Nothing to show`,
          tagClass: "bg-violet-100 text-violet-700",
          illustration: <AllPrunedIllustration />,
          title: t`Every page is pruned`,
          body: (
            <Trans>
              {stageLabel} isn't ready yet — every section in the Storyboard is
              currently pruned, so there's nothing to run on. Restore at least
              one section in Storyboard to continue.
            </Trans>
          ),
          ctaLabel: t`Review pruned sections`,
        }

  return (
    <div className="flex h-full min-h-[360px] w-full items-center justify-center p-6">
      <div
        className={cn(
          "relative flex max-w-md flex-col items-center gap-6 overflow-hidden rounded-2xl border border-[#ececec] bg-white px-8 py-9 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]",
          "motion-safe:animate-in motion-safe:fade-in-50 motion-safe:zoom-in-95 motion-safe:duration-500 motion-safe:ease-out",
        )}
      >
        <div className="relative">{config.illustration}</div>

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
          <p className="w-[34ch] text-[13.5px] leading-relaxed text-balance text-[#525252]">
            {config.body}
          </p>
        </div>

        <Link
          to="/books/$label/$step"
          params={{ label: bookLabel, step: "storyboard" }}
          className="group relative inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3.5 py-2 text-[12.5px] font-medium text-white shadow-sm transition-colors hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          {config.ctaLabel}
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
            strokeWidth={2.5}
            aria-hidden
          />
        </Link>
      </div>
    </div>
  )
}

function StoryboardMissingIllustration() {
  return (
    <div className="relative h-[148px] w-[180px]">
      <svg
        viewBox="0 0 180 148"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        {/* Background blob */}
        <ellipse cx="90" cy="84" rx="78" ry="60" fill="#ede9fe" />

        {/* Back card (lightest) */}
        <g transform="rotate(-8 56 80)">
          <rect
            x="32"
            y="44"
            width="58"
            height="76"
            rx="6"
            fill="#c4b5fd"
            opacity="0.75"
          />
        </g>

        {/* Middle card */}
        <g transform="rotate(6 110 78)">
          <rect
            x="84"
            y="40"
            width="58"
            height="76"
            rx="6"
            fill="#a78bfa"
            opacity="0.95"
          />
        </g>

        {/* Front card with layout grid */}
        <g>
          <rect
            x="56"
            y="32"
            width="68"
            height="84"
            rx="7"
            fill="white"
            stroke="#7c3aed"
            strokeWidth="1.5"
          />
          {/* Header bar */}
          <rect x="64" y="40" width="28" height="3" rx="1.5" fill="#c4b5fd" />
          <rect x="64" y="46" width="18" height="2.5" rx="1.25" fill="#ddd6fe" />
          {/* Grid cells: 2 filled, 2 outline */}
          <rect x="64" y="56" width="22" height="20" rx="3" fill="#7c3aed" />
          <rect
            x="92"
            y="56"
            width="24"
            height="20"
            rx="3"
            fill="white"
            stroke="#c4b5fd"
            strokeWidth="1.25"
            strokeDasharray="3 2"
          />
          <rect
            x="64"
            y="82"
            width="22"
            height="20"
            rx="3"
            fill="white"
            stroke="#c4b5fd"
            strokeWidth="1.25"
            strokeDasharray="3 2"
          />
          <rect x="92" y="82" width="24" height="20" rx="3" fill="#7c3aed" />
        </g>

        {/* Pulse marker — indicates the missing piece */}
        <g>
          <circle cx="138" cy="46" r="9" fill="#7c3aed" opacity="0.12">
            <animate
              attributeName="r"
              values="6;11;6"
              dur="2.4s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.18;0.04;0.18"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="138" cy="46" r="4.5" fill="#7c3aed" />
          <path
            d="M138 43.5 L138 48.5 M135.5 46 L140.5 46"
            stroke="white"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </g>

        {/* Small decorative dots */}
        <circle cx="36" cy="36" r="2" fill="#a78bfa" opacity="0.7" />
        <circle cx="148" cy="108" r="2.5" fill="#7c3aed" opacity="0.5" />
        <circle cx="28" cy="108" r="1.5" fill="#c4b5fd" />
      </svg>
    </div>
  )
}

function AllPrunedIllustration() {
  return (
    <div className="relative h-[148px] w-[180px]">
      <svg
        viewBox="0 0 180 148"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        {/* Background blob */}
        <ellipse cx="90" cy="84" rx="78" ry="60" fill="#ede9fe" />

        {/* Back document */}
        <g transform="rotate(-6 62 78)">
          <rect
            x="38"
            y="42"
            width="58"
            height="76"
            rx="6"
            fill="#c4b5fd"
            opacity="0.6"
          />
        </g>

        {/* Front document with struck-through content */}
        <g>
          <rect
            x="56"
            y="30"
            width="72"
            height="88"
            rx="7"
            fill="white"
            stroke="#7c3aed"
            strokeWidth="1.5"
          />
          {/* Header */}
          <rect x="64" y="40" width="32" height="3.5" rx="1.75" fill="#c4b5fd" />
          {/* Content lines, all with strikethrough */}
          <g>
            <rect x="64" y="54" width="44" height="3" rx="1.5" fill="#ddd6fe" />
            <line
              x1="62"
              y1="55.5"
              x2="110"
              y2="55.5"
              stroke="#7c3aed"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </g>
          <g>
            <rect x="64" y="64" width="52" height="3" rx="1.5" fill="#ddd6fe" />
            <line
              x1="62"
              y1="65.5"
              x2="118"
              y2="65.5"
              stroke="#7c3aed"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </g>
          <g>
            <rect x="64" y="74" width="38" height="3" rx="1.5" fill="#ddd6fe" />
            <line
              x1="62"
              y1="75.5"
              x2="104"
              y2="75.5"
              stroke="#7c3aed"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </g>
          <g>
            <rect x="64" y="84" width="48" height="3" rx="1.5" fill="#ddd6fe" />
            <line
              x1="62"
              y1="85.5"
              x2="114"
              y2="85.5"
              stroke="#7c3aed"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </g>
          <g>
            <rect x="64" y="94" width="40" height="3" rx="1.5" fill="#ddd6fe" />
            <line
              x1="62"
              y1="95.5"
              x2="106"
              y2="95.5"
              stroke="#7c3aed"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </g>
        </g>

        {/* Small decorative dots */}
        <circle cx="34" cy="40" r="2.5" fill="#a78bfa" opacity="0.7" />
        <circle cx="150" cy="116" r="2" fill="#7c3aed" opacity="0.5" />
        <circle cx="30" cy="112" r="1.5" fill="#c4b5fd" />
      </svg>

      {/* Scissors badge floats above the SVG with proper depth */}
      <span className="absolute right-2 top-4 flex h-9 w-9 rotate-[20deg] items-center justify-center rounded-full bg-violet-600 text-white shadow-[0_4px_12px_rgba(124,58,237,0.4)] ring-4 ring-white">
        <Scissors className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      </span>
    </div>
  )
}
