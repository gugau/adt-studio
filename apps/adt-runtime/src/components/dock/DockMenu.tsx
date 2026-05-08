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
import { TocContent } from "./content/TocContent"
import { GlossaryContent } from "./content/GlossaryContent"
import { AudioContent } from "./content/AudioContent"
import { LanguageContent } from "./content/LanguageContent"
import { SettingsContent } from "./content/SettingsContent"

interface DockMenuProps {
  /** Element each popover positions itself against (the dock as a whole). */
  anchor?: React.RefObject<HTMLElement | null>
}

export function DockMenu({ anchor }: DockMenuProps) {
  const features = useAtomValue(appConfigAtom).features
  const [value, setValue] = useAtom(dockMenuValueAtom)
  const readAloud = useAtomValue(readAloudModeAtom)
  const [, setPlayBarVisible] = useAtom(playBarVisibleAtom)
  const [signLanguage, setSignLanguage] = useAtom(signLanguageModeAtom)
  const { isPlaying } = useAudioPlayerContext()
  const { t } = useTranslation()

  const toggle = (next: DockMenuValue) =>
    setValue((prev) => (prev === next ? null : next))

  return (
    <>
      <div className="flex items-center gap-0.5 pl-1 border-l border-border">
        {features.showNavigationControls ? (
          <DockIconButton
            ariaLabel={t("nav-label") || "Contents"}
            pressed={value === "toc"}
            onClick={() => toggle("toc")}
          >
            <List className="w-5 h-5" />
          </DockIconButton>
        ) : null}

        {features.glossary ? (
          <DockIconButton
            ariaLabel={t("glossary-label") || "Glossary"}
            pressed={value === "glossary"}
            onClick={() => toggle("glossary")}
          >
            <BookOpen className="w-5 h-5" />
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
                className={cn("w-5 h-5", isPlaying && "animate-pulse")}
              />
            ) : (
              <VolumeX className="w-5 h-5" />
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
            <Hand className="w-5 h-5" />
          </DockIconButton>
        ) : null}

        <DockIconButton
          ariaLabel={t("language-label") || "Language"}
          pressed={value === "language"}
          onClick={() => toggle("language")}
        >
          <Languages className="w-5 h-5" />
        </DockIconButton>

        <DockIconButton
          ariaLabel={t("sidebar-title") || "Settings"}
          pressed={value === "settings"}
          onClick={() => toggle("settings")}
        >
          <Settings className="w-5 h-5" />
        </DockIconButton>
      </div>

      <DockPanel
        open={value === "toc"}
        onClose={() => setValue(null)}
        anchor={anchor}
      >
        <TocContent />
      </DockPanel>

      <DockPanel
        open={value === "glossary"}
        onClose={() => setValue(null)}
        anchor={anchor}
      >
        <GlossaryContent />
      </DockPanel>

      <DockPanel
        open={value === "audio"}
        onClose={() => setValue(null)}
        anchor={anchor}
        staysOpen
      >
        <AudioContent />
      </DockPanel>

      <DockPanel
        open={value === "language"}
        onClose={() => setValue(null)}
        anchor={anchor}
      >
        <LanguageContent onSelect={() => setValue(null)} />
      </DockPanel>

      <DockPanel
        open={value === "settings"}
        onClose={() => setValue(null)}
        anchor={anchor}
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
          // Click landed on a dock icon button. Let the button's onClick
          // handle the open/close toggle — otherwise the outside-press
          // closes here, the click reopens, and the popover never closes.
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
        side="top"
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
