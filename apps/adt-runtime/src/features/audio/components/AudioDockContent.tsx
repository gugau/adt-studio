import { useSetAtom } from "jotai"
import { Pause, Play, SkipBack, SkipForward, Square } from "lucide-react"
import { playBarVisibleAtom, readAloudModeAtom } from "@/features/audio/state/audio.atoms"
import { dockMenuValueAtom } from "@/shared/state/ui.atoms"
import { useAudioPlayerContext } from "@/features/audio/hooks/AudioPlayerContext"
import { useTranslation } from "@/features/language/hooks/useTranslation"
import { SpeedMenu } from "@/features/audio/components/SpeedMenu"
import { VolumeMenu } from "@/features/audio/components/VolumeMenu"
import { cn } from "@/shared/lib/utils"
import { DockContent } from "@/features/dock/components/DockLayout"

/**
 * Audio controls panel — prev / play-pause / next / stop / speed / volume.
 * Lives inside a NavigationMenu Content slot so it animates with the rest
 * of the dock's surfaces. "Stop" fully tears down playback and deactivates
 * read-aloud (the volume icon flips back to off).
 */
export function AudioContent() {
  const { t } = useTranslation()
  const { isPlaying, hasItems, togglePlayPause, playNext, playPrevious, stop } =
    useAudioPlayerContext()
  const setReadAloud = useSetAtom(readAloudModeAtom)
  const setPlayBarVisible = useSetAtom(playBarVisibleAtom)
  const setDockMenuValue = useSetAtom(dockMenuValueAtom)

  const handleStop = () => {
    stop()
    setReadAloud(false)
    setPlayBarVisible(false)
    setDockMenuValue("")
  }

  return (
    <DockContent
      role="group"
      aria-label={t("read-aloud-toolbar-label") || "Read aloud controls"}
      className="h-auto flex-row items-center justify-center gap-1 p-1.5 w-fit"
    >
      <RoundButton
        label={t("previous-audio") || "Previous audio"}
        onClick={playPrevious}
        disabled={!hasItems}
      >
        <SkipBack className="w-4 h-4" />
      </RoundButton>

      <button
        type="button"
        aria-label={
          isPlaying
            ? t("pause-audio-label") || "Pause"
            : t("play-audio-label") || "Play"
        }
        aria-pressed={isPlaying}
        onClick={togglePlayPause}
        disabled={!hasItems}
        className={cn(
          "w-11 h-11 rounded-full flex items-center justify-center",
          "shadow-md ring-1 ring-primary/20",
          "transition-all duration-150 hover:scale-105 active:scale-95",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:opacity-40 disabled:hover:scale-100",
          "bg-primary text-primary-foreground hover:bg-primary/90",
        )}
      >
        {isPlaying ? (
          <Pause className="w-5 h-5" fill="currentColor" />
        ) : (
          <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
        )}
      </button>

      <RoundButton
        label={t("next-audio") || "Next audio"}
        onClick={playNext}
        disabled={!hasItems}
      >
        <SkipForward className="w-4 h-4" />
      </RoundButton>

      <RoundButton
        label={t("stop-audio-label") || "Stop"}
        onClick={handleStop}
        disabled={!hasItems}
      >
        <Square className="w-3.5 h-3.5" fill="currentColor" />
      </RoundButton>

      <SpeedMenu />
      <VolumeMenu />
    </DockContent>
  )
}

interface RoundButtonProps {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}

function RoundButton({ label, onClick, disabled, children }: RoundButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-11 h-11 rounded-lg flex items-center justify-center",
        "text-foreground hover:bg-accent hover:text-accent-foreground",
        "transition-colors duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:opacity-30 disabled:hover:bg-transparent",
      )}
    >
      {children}
    </button>
  )
}
