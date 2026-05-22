import { createContext, useContext, type ReactNode } from "react"
import { useAudioPlayer, type UseAudioPlayer } from "@/features/audio/hooks/useAudioPlayer"

const AudioPlayerContext = createContext<UseAudioPlayer | null>(null)

/**
 * Hosts a single `useAudioPlayer` instance and shares it via context. Mount
 * once at a stable level (the dock) so the underlying `<audio>` element
 * survives popover open/close cycles. Without this, every consumer of
 * `useAudioPlayer` would spin up its own audio ref + effect cleanup, and
 * closing the audio popover would tear the player down mid-playback.
 */
export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer()
  return (
    <AudioPlayerContext.Provider value={player}>
      {children}
    </AudioPlayerContext.Provider>
  )
}

export function useAudioPlayerContext(): UseAudioPlayer {
  const ctx = useContext(AudioPlayerContext)
  if (!ctx) {
    throw new Error(
      "useAudioPlayerContext must be used within an AudioPlayerProvider",
    )
  }
  return ctx
}
