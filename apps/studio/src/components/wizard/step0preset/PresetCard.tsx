import { useId, useState } from "react"
import { Info, Settings, Search } from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { type PresetConfig, type PresetId } from "./constants"

function FeaturesHoverCard({ preset }: { preset: PresetConfig }) {
  const { t } = useLingui()
  const [search, setSearch] = useState("")

  const filtered = preset.features.filter(
    (f) =>
      search === "" ||
      f.label.toLowerCase().includes(search.toLowerCase()) ||
      f.description.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <HoverCardContent side="bottom" align="end" className="w-[320px] p-0">
      <div className="border-b border-[#e5e5e5] p-2">
        <div className="relative flex items-center">
          <Search className="absolute left-3 h-4 w-4 text-[#737373] pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t`Search settings`}
            className="pl-9 h-9 border-[#e5e5e5] text-sm placeholder:text-[#737373]"
          />
        </div>
      </div>
      <div className="flex flex-col max-h-[260px] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-4 py-5 text-sm text-center text-[#737373]">
            <Trans>No settings match your search.</Trans>
          </p>
        ) : (
          filtered.map((feature, idx) => (
            <div
              key={feature.id}
              className={`flex flex-col gap-0.5 px-4 py-2.5 ${idx > 0 ? "border-t border-[#e5e5e5]" : ""}`}
            >
              <span className="text-sm font-medium text-black">
                {feature.label}
              </span>
              <span className="text-xs text-[#737373] leading-[18px]">
                {feature.description}
              </span>
            </div>
          ))
        )}
      </div>
    </HoverCardContent>
  )
}

interface PresetCardProps {
  preset: PresetConfig
  selected: boolean
  radioName: string
  onSelect: (id: PresetId) => void
  onShowExamples: (id: PresetId) => void
}

export function PresetCard({
  preset,
  selected,
  radioName,
  onSelect,
  onShowExamples,
}: PresetCardProps) {
  const { Icon } = preset
  const radioId = useId()

  return (
    <label
      className={cn(
        "block w-full rounded-lg p-1 text-left transition-all cursor-pointer",
        "border border-[#e5e5e5] outline-none",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#2b7fff] has-[:focus-visible]:ring-offset-0",
        selected
          ? "ring-2 ring-[#2b7fff] ring-offset-0"
          : "hover:border-[#2b7fff]/50",
      )}
    >
      <input
        id={radioId}
        type="radio"
        name={radioName}
        value={preset.id}
        checked={selected}
        onChange={() => onSelect(preset.id)}
        className="sr-only"
        aria-label={preset.title}
      />
      <span className="block">
      <div
        className={`h-[200px] w-full rounded flex items-center justify-center ${preset.bgColor}`}
      >
        {preset.imageSrc ? (
          <img
            src={preset.imageSrc}
            alt={preset.title}
            className="w-[163px] h-[168px] object-contain"
          />
        ) : (
          <Icon
            className={`w-16 h-16 ${preset.iconColor} opacity-60`}
            strokeWidth={1.5}
          />
        )}
      </div>

      <div className="px-4 pt-4 pb-3 flex flex-col gap-2">
        <span className="text-sm font-bold text-black leading-5">
          {preset.title}
        </span>
        <span className="text-[10px] text-[#737373] leading-[14px] line-clamp-3">
          {preset.description}
        </span>

        <div
          className="flex items-center justify-between mt-1"
          style={{ visibility: preset.id === "custom" ? "hidden" : "visible" }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onShowExamples(preset.id)
            }}
            className="flex items-center gap-1.5 text-xs font-medium text-[#2b7fff] hover:underline w-fit"
          >
            <Info className="h-3.5 w-3.5 shrink-0" />
            <Trans>See examples</Trans>
          </button>

          <HoverCard openDelay={150} closeDelay={100}>
            <HoverCardTrigger asChild>
              <div
                className="flex items-center gap-1 rounded-full border border-[#e5e5e5] px-2 py-0.5 cursor-pointer hover:border-[#2b7fff]/50 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Settings className="h-3.5 w-3.5 text-[#0a0a0a]" />
                <span className="text-xs font-semibold text-[#0a0a0a] leading-4">
                  +{preset.features.length}
                </span>
              </div>
            </HoverCardTrigger>
            <FeaturesHoverCard preset={preset} />
          </HoverCard>
        </div>
      </div>
      </span>
    </label>
  )
}
