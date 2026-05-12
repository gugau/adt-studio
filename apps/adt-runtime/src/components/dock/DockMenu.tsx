import { useAtom, useAtomValue } from "jotai"
import {
  BookOpen,
  Hand,
  Languages,
  List,
  Settings,
  Volume2,
  VolumeX,
} from "lucide-react"
import { Popover, PopoverContent } from "@/components/ui/popover"
import { appConfigAtom } from "@/state/config.atoms"
import { playBarVisibleAtom, readAloudModeAtom } from "@/state/audio.atoms"
import {
  dockMenuValueAtom,
  signLanguageModeAtom,
  type DockMenuValue,
} from "@/state/ui.atoms"
import { useAudioPlayerContext } from "@/hooks/AudioPlayerContext"
import { useTranslation } from "@/hooks/useTranslation"
import { trackToggleEvent } from "@/lib/analytics"
import { cn } from "@/lib/utils"
import { DockIconButton } from "./DockIconButton"
import { useDockContext } from "./dock-context"
import { TocContent } from "./content/TocContent"
import { GlossaryContent } from "./content/GlossaryContent"
import { AudioContent } from "./content/AudioContent"
import { LanguageContent } from "./content/LanguageContent"
import { SettingsContent } from "./content/SettingsContent"

export function DockMenu() {
  const features = useAtomValue(appConfigAtom).features
  const [value, setValue] = useAtom(dockMenuValueAtom)
  const readAloud = useAtomValue(readAloudModeAtom)
  const [, setPlayBarVisible] = useAtom(playBarVisibleAtom)
  const [signLanguage, setSignLanguage] = useAtom(signLanguageModeAtom)
  const { isPlaying } = useAudioPlayerContext()
  const { t } = useTranslation()
  const { ref: anchor, popoverSide: side } = useDockContext()

  const toggle = (next: DockMenuValue) =>
    setValue((prev) => (prev === next ? "" : next))

  return (
    <>
      <div className="flex items-center gap-0.5 pl-1">
        {features.showNavigationControls ? (
          <DockIconButton
            ariaLabel={t("nav-label") || "Contents"}
            pressed={value === "toc"}
            onClick={() => toggle("toc")}
          >
            <List className="size-6" />
          </DockIconButton>
        ) : null}

        {features.glossary ? (
          <DockIconButton
            ariaLabel={t("glossary-label") || "Glossary"}
            pressed={value === "glossary"}
            onClick={() => toggle("glossary")}
          >
            <BookOpen className="size-6" />
          </DockIconButton>
        ) : null}

        {features.readAloud ? (
          <DockIconButton
            ariaLabel={
              readAloud
                ? t("deactivate-tts-label") || "Deactivate text to speech"
                : t("activate-tts-label") || "Activate text to speech"
            }
            onClick={() => {
              setPlayBarVisible(true)
              toggle("audio")
            }}
          >
            {readAloud ? (
              <Volume2
                className={cn("size-6", isPlaying && "animate-pulse")}
              />
            ) : (
              <VolumeX className="size-6" />
            )}
          </DockIconButton>
        ) : null}

        {features.signLanguage ? (
          <DockIconButton
            ariaLabel={t("sign-language-label") || "Sign language"}
            pressed={signLanguage}
            onClick={() => {
              const next = !signLanguage
              trackToggleEvent("SignLanguage", next)
              setSignLanguage(next)
            }}
          >
            <Hand className="size-6" />
          </DockIconButton>
        ) : null}

        <DockIconButton
          ariaLabel={t("language-label") || "Language"}
          pressed={value === "language"}
          onClick={() => toggle("language")}
        >
          <Languages className="size-6" />
        </DockIconButton>

        <DockIconButton
          ariaLabel={t("sidebar-title") || "Settings"}
          pressed={value === "settings"}
          onClick={() => toggle("settings")}
        >
          <Settings className="size-6" />
        </DockIconButton>
      </div>

      <DockPanel
        open={value === "toc"}
        onClose={() => setValue("")}
        anchor={anchor}
        side={side}
      >
        <TocContent />
      </DockPanel>

      <DockPanel
        open={value === "glossary"}
        onClose={() => setValue("")}
        anchor={anchor}
        side={side}
      >
        <GlossaryContent />
      </DockPanel>

      <DockPanel
        open={value === "audio"}
        onClose={() => setValue("")}
        anchor={anchor}
        side={side}
        staysOpen
      >
        <AudioContent />
      </DockPanel>

      <DockPanel
        open={value === "language"}
        onClose={() => setValue("")}
        anchor={anchor}
        side={side}
      >
        <LanguageContent onSelect={() => setValue("")} />
      </DockPanel>

      <DockPanel
        open={value === "settings"}
        onClose={() => setValue("")}
        anchor={anchor}
        side={side}
      >
        <SettingsContent />
      </DockPanel>
    </>
  )
}

interface DockPanelProps {
  open: boolean
  onClose: () => void
  anchor?: React.RefObject<HTMLElement | null>
  side?: "top" | "bottom"
  /**
   * When true, the popover ignores outside-click and escape dismissal. The
   * only ways to close it are programmatic (e.g. clicking Stop in the
   * panel) or re-clicking the dock trigger button.
   */
  staysOpen?: boolean
  children: React.ReactNode
}

function DockPanel({
  open,
  onClose,
  anchor,
  side = "top",
  staysOpen,
  children,
}: DockPanelProps) {
  return (
    <Popover
      open={open}
      onOpenChange={(next, eventDetails) => {
        if (next) return
        if (
          eventDetails.reason === "outside-press" &&
          eventDetails.event &&
          (eventDetails.event.target as HTMLElement | null)?.closest(
            "[data-dock-trigger]",
          )
        ) {
          return
        }
        if (
          staysOpen &&
          (eventDetails.reason === "outside-press" ||
            eventDetails.reason === "escape-key")
        ) {
          return
        }
        onClose()
      }}
    >
      <PopoverContent
        side={side}
        align="center"
        sideOffset={12}
        anchor={anchor}
        className="w-auto p-0 overflow-hidden rounded-2xl"
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}
