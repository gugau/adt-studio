import { useAtom } from "jotai"
import { ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { audioSpeedAtom } from "@/state/audio.atoms"
import { useTranslation } from "@/hooks/useTranslation"

const SPEEDS = [
  { value: 0.5, labelKey: "read-aloud-speed-slow", fallback: "Slow" },
  { value: 1, labelKey: "read-aloud-speed-normal", fallback: "Normal" },
  { value: 1.5, labelKey: "read-aloud-speed-fast", fallback: "Fast" },
  { value: 2, labelKey: "read-aloud-speed-very-fast", fallback: "Very fast" },
] as const

/**
 * Speed picker for the play bar. Replaces the legacy `#read-aloud-settings`
 * menu. Renders as a pill trigger inside the play bar capsule.
 */
export function SpeedMenu() {
  const [speed, setSpeed] = useAtom(audioSpeedAtom)
  const { t } = useTranslation()

  const active = SPEEDS.find((s) => s.value === speed) ?? SPEEDS[1]
  const activeLabel = t(active.labelKey) || active.fallback

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={[
          "h-8 px-3 rounded-full",
          "flex items-center gap-1",
          "text-xs font-medium text-gray-700",
          "hover:bg-gray-100 hover:text-gray-900",
          "transition-colors duration-150",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
          "data-[state=open]:bg-gray-100 data-[state=open]:text-gray-900",
        ].join(" ")}
        aria-label={`${t("read-aloud-speed-label") || "Playback speed"}: ${activeLabel}`}
      >
        <span>{activeLabel}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-[8rem]">
        <DropdownMenuRadioGroup
          value={String(speed)}
          onValueChange={(v) => setSpeed(parseFloat(v))}
        >
          {SPEEDS.map((s) => (
            <DropdownMenuRadioItem key={s.value} value={String(s.value)}>
              {t(s.labelKey) || s.fallback}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
