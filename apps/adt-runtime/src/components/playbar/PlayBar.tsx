import { useAtom, useAtomValue } from "jotai"
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react"
import { appConfigAtom } from "@/state/config.atoms"
import { playBarVisibleAtom, readAloudModeAtom } from "@/state/audio.atoms"
import { SpeedMenu } from "./SpeedMenu"
import { useTranslation } from "@/hooks/useTranslation"
import { useAudioPlayer } from "@/hooks/useAudioPlayer"
import { cn } from "@/lib/utils"

/**
 * Read-aloud chrome — replaces `#play-bar` + `#tts-quick-toggle-button`.
 *
 * Two surfaces:
 *   1. **Quick toggle** (Volume2 button, fixed bottom-right). Mounts whenever
 *      `features.readAloud` is on. Filled blue when read-aloud is enabled,
 *      neutral white when off. Doubles as a play indicator (subtle pulse
 *      while audio is playing).
 *   2. **Play bar** (capsule, sits to the left of the toggle). Only shown
 *      when read-aloud is enabled. Houses prev / play-pause / next / speed.
 *
 * Playback + word highlighting is delegated to `useAudioPlayer`, which
 * owns the `HTMLAudioElement` and chains items inside `#content`.
 */
export function PlayBar() {
  const features = useAtomValue(appConfigAtom).features
  const [readAloud, setReadAloud] = useAtom(readAloudModeAtom)
  const [, setPlayBarVisible] = useAtom(playBarVisibleAtom)
  const { t } = useTranslation()
  const { isPlaying, hasItems, togglePlayPause, playNext, playPrevious } =
    useAudioPlayer()

  if (!features.readAloud) return null

  return (
    <>
      {/* Quick-toggle: enable / disable read-aloud entirely. */}
      <button
        type="button"
        aria-label={
          readAloud
            ? t("deactivate-tts-label") || "Deactivate text to speech"
            : t("activate-tts-label") || "Activate text to speech"
        }
        aria-pressed={readAloud}
        onClick={() => {
          const next = !readAloud
          setReadAloud(next)
          setPlayBarVisible(next)
          if (!next && isPlaying) togglePlayPause()
        }}
        className={cn(
          "fixed bottom-4 right-4 w-12 h-12 z-[60]",
          "flex items-center justify-center rounded-full",
          "shadow-lg ring-1 ring-black/5",
          "transition-all duration-200",
          "hover:scale-105 active:scale-95",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
          readAloud
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-white text-gray-700 hover:bg-gray-50",
        )}
      >
        {readAloud ? (
          <Volume2
            className={cn(
              "w-5 h-5",
              isPlaying && "animate-pulse",
            )}
          />
        ) : (
          <VolumeX className="w-5 h-5" />
        )}
      </button>

      {/* Play bar: prev | play | next | speed. Only when read-aloud is on. */}
      {readAloud ? (
        <div
          className={cn(
            "fixed bottom-4 right-20 z-[55]",
            "flex items-center gap-1 px-2 py-1.5",
            "rounded-full",
            "bg-white/95 backdrop-blur-md",
            "shadow-lg ring-1 ring-black/5",
            "animate-in fade-in slide-in-from-right-4 duration-200",
          )}
          role="toolbar"
          aria-label={t("read-aloud-toolbar-label") || "Read aloud controls"}
        >
          <PlayBarButton
            label={t("previous-audio") || "Previous audio"}
            onClick={playPrevious}
            disabled={!hasItems}
          >
            <SkipBack className="w-4 h-4" />
          </PlayBarButton>

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
              "w-11 h-11 rounded-full",
              "flex items-center justify-center",
              "shadow-md ring-1 ring-blue-700/20",
              "transition-all duration-150",
              "hover:scale-105 active:scale-95",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
              "disabled:opacity-40 disabled:hover:scale-100",
              "bg-blue-600 text-white hover:bg-blue-700",
            )}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" fill="currentColor" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
            )}
          </button>

          <PlayBarButton
            label={t("next-audio") || "Next audio"}
            onClick={playNext}
            disabled={!hasItems}
          >
            <SkipForward className="w-4 h-4" />
          </PlayBarButton>

          {/* Subtle divider before the speed pill. */}
          <span className="w-px h-6 bg-gray-200 mx-1" aria-hidden />

          <SpeedMenu />
        </div>
      ) : null}
    </>
  )
}

interface PlayBarButtonProps {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}

/** Small helper for the prev / next ghost-style icon buttons. */
function PlayBarButton({ label, onClick, disabled, children }: PlayBarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-9 h-9 rounded-full",
        "flex items-center justify-center",
        "text-gray-700 hover:text-gray-900 hover:bg-gray-100",
        "transition-colors duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
        "disabled:opacity-30 disabled:hover:bg-transparent",
      )}
    >
      {children}
    </button>
  )
}
