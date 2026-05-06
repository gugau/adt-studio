/**
 * Audio playback for read-aloud — Phase C: chained playback + word-by-word
 * highlighting that follows the spoken text.
 *
 * Replaces the imperative parts of the legacy `audio.js` (queue, play/pause,
 * next/previous, speed) and `tts_highlighter.js` (per-word DOM mutation
 * synced to `audio.timeupdate`).
 *
 * Architecture:
 *   - One `HTMLAudioElement` lives in a ref for the chrome's lifetime.
 *   - Items derive lazily from `#content` — every `[data-id]` whose audio
 *     file exists in `audios.json` for the current language.
 *   - Per item, the player wraps the element's text in `<span data-word-index>`
 *     spans (or applies a block highlight for img/textarea/select), then
 *     advances the highlight on each `timeupdate` using either precise
 *     timestamps from `timecode_output.json` or weight-based estimates from
 *     the tokenizer.
 *   - Atoms (`isPlaying`, `currentAudioIndex`) keep the PlayBar UI in sync.
 *   - On every transition (next/prev, ended, pause, language switch, unmount)
 *     the previous item's wrapped DOM is restored byte-for-byte before the
 *     next one is set up.
 */
import { useAtom, useAtomValue } from "jotai"
import { useCallback, useEffect, useMemo, useRef } from "react"
import {
  audioSpeedAtom,
  autoplayModeAtom,
  currentAudioIndexAtom,
  isPlayingAtom,
  readAloudModeAtom,
  timecodeMapAtom,
  wordHighlightModeAtom,
} from "@/state/audio.atoms"
import { audioFilesAtom, currentLanguageAtom } from "@/state/language.atoms"
import {
  clearBlockHighlight,
  clearWordHighlight,
  elementSupportsWordHighlight,
  findWordIndexAtTime,
  resolveWordTimestamps,
  setBlockHighlight,
  setWordHighlight,
  unwrapWordsForElement,
  wrapWordsForElement,
} from "@/lib/tts/word-highlight"
import type { WordTimestamp } from "@/state/audio.atoms"

interface PlayableItem {
  el: HTMLElement
  id: string
  filename: string
}

function gatherPlayableItems(audioFiles: Record<string, string>): PlayableItem[] {
  if (typeof document === "undefined") return []
  const content = document.getElementById("content")
  if (!content) return []
  const elements = Array.from(content.querySelectorAll<HTMLElement>("[data-id]"))
  const items: PlayableItem[] = []
  for (const el of elements) {
    const id = el.getAttribute("data-id")
    if (!id) continue
    const filename = audioFiles[id]
    if (!filename) continue
    items.push({ el, id, filename })
  }
  return items
}

interface ActiveHighlight {
  el: HTMLElement
  mode: "word" | "block"
  timestamps: WordTimestamp[]
}

export interface UseAudioPlayer {
  isPlaying: boolean
  hasItems: boolean
  togglePlayPause: () => void
  playNext: () => void
  playPrevious: () => void
}

export function useAudioPlayer(): UseAudioPlayer {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const activeRef = useRef<ActiveHighlight | null>(null)

  const [isPlaying, setIsPlaying] = useAtom(isPlayingAtom)
  const [currentIndex, setCurrentIndex] = useAtom(currentAudioIndexAtom)
  const audioFiles = useAtomValue(audioFilesAtom)
  const language = useAtomValue(currentLanguageAtom) as string
  const speed = useAtomValue(audioSpeedAtom) as number
  const autoplayMode = useAtomValue(autoplayModeAtom) as boolean
  const readAloudMode = useAtomValue(readAloudModeAtom) as boolean
  const wordHighlightMode = useAtomValue(wordHighlightModeAtom) as boolean
  const timecodeMap = useAtomValue(timecodeMapAtom)

  // Mirror the user's word-highlight preference into a ref so the audio
  // element's `ontimeupdate` callback (which is captured at play time) can
  // read the current value without re-binding.
  const wordHighlightModeRef = useRef(wordHighlightMode)
  wordHighlightModeRef.current = wordHighlightMode

  // Snapshot the persisted resume state at mount time. Subsequent toggles
  // of read-aloud / autoplay mid-page must not re-trigger auto-start.
  const initialResumeRef = useRef<boolean>(isPlaying || autoplayMode)
  const hasAutoStartedRef = useRef<boolean>(false)

  // Re-derive the play list whenever the audio map changes (typically on
  // language switch). Using DOM data ensures we don't drift from the static
  // `#content` markup the page ships with.
  const items = useMemo(() => gatherPlayableItems(audioFiles), [audioFiles])

  /** Restore the previously-active item's DOM and drop the active marker. */
  const teardownActive = useCallback(() => {
    const active = activeRef.current
    if (!active) return
    if (active.mode === "word") {
      clearWordHighlight(active.el)
      unwrapWordsForElement(active.el)
    } else {
      clearBlockHighlight(active.el)
    }
    activeRef.current = null
  }, [])

  /** Set up word/block highlight scaffolding for the item at `index`. */
  const setupHighlight = useCallback(
    (item: PlayableItem, audio: HTMLAudioElement) => {
      teardownActive()
      const text = item.el.textContent ?? ""
      const useWord =
        wordHighlightModeRef.current && elementSupportsWordHighlight(item.el)
      if (useWord) {
        wrapWordsForElement(item.el, text)
        const timestamps = resolveWordTimestamps(
          item.id,
          text,
          audio.duration,
          timecodeMap[item.id],
        )
        activeRef.current = { el: item.el, mode: "word", timestamps }
      } else {
        setBlockHighlight(item.el)
        activeRef.current = { el: item.el, mode: "block", timestamps: [] }
      }
    },
    [teardownActive, timecodeMap],
  )

  const stopAndClear = useCallback(() => {
    teardownActive()
    const audio = audioRef.current
    if (!audio) return
    audio.onended = null
    audio.onerror = null
    audio.ontimeupdate = null
    audio.onloadedmetadata = null
    audio.pause()
    audio.removeAttribute("src")
    audio.load()
  }, [teardownActive])

  const playAtIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= items.length) {
        stopAndClear()
        setIsPlaying(false)
        return
      }
      const item = items[index]
      const url = `./content/i18n/${language}/audio/${item.filename}`

      if (!audioRef.current) audioRef.current = new Audio()
      const audio = audioRef.current

      // Tear down handlers from the previous item before we re-bind.
      audio.onended = null
      audio.onerror = null
      audio.ontimeupdate = null
      audio.onloadedmetadata = null
      teardownActive()

      audio.src = url
      audio.playbackRate = speed

      audio.onloadedmetadata = () => {
        // Once we know the real duration, swap the approximate timestamps
        // for ones scaled to the actual track length. (Skipped if the API
        // already gave us precise timings.)
        if (
          activeRef.current &&
          activeRef.current.mode === "word" &&
          !timecodeMap[item.id]
        ) {
          const text = item.el.textContent ?? ""
          activeRef.current.timestamps = resolveWordTimestamps(
            item.id,
            text,
            audio.duration,
            undefined,
          )
        }
      }

      audio.ontimeupdate = () => {
        const active = activeRef.current
        if (!active || active.mode !== "word") return
        const idx = findWordIndexAtTime(active.timestamps, audio.currentTime)
        setWordHighlight(active.el, idx)
      }

      audio.onended = () => {
        teardownActive()
        const next = index + 1
        if (next < items.length) {
          playAtIndex(next)
        } else {
          setIsPlaying(false)
          setCurrentIndex(0)
        }
      }

      audio.onerror = () => {
        console.warn("[adt-runtime] audio playback failed for", url)
        teardownActive()
        setIsPlaying(false)
      }

      // Prepare the highlight scaffolding *before* play() so the first
      // `timeupdate` already has spans to mark.
      setupHighlight(item, audio)

      setCurrentIndex(index)
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          // Browser autoplay policy may reject until the user interacts with
          // the page; log and revert to the paused state.
          console.warn("[adt-runtime] audio.play() rejected", err)
          teardownActive()
          setIsPlaying(false)
        })
    },
    [
      items,
      language,
      speed,
      setIsPlaying,
      setCurrentIndex,
      stopAndClear,
      setupHighlight,
      teardownActive,
      timecodeMap,
    ],
  )

  const togglePlayPause = useCallback(() => {
    if (items.length === 0) return
    const audio = audioRef.current
    if (audio && !audio.paused) {
      audio.pause()
      setIsPlaying(false)
      // Leave the current word highlighted while paused — it's the visual
      // analogue of "you're paused mid-word".
      return
    }
    if (
      audio &&
      audio.src &&
      audio.currentTime > 0 &&
      audio.currentTime < audio.duration
    ) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false))
      return
    }
    playAtIndex(currentIndex || 0)
  }, [items.length, currentIndex, playAtIndex, setIsPlaying])

  const playNext = useCallback(() => {
    if (items.length === 0) return
    const next = Math.min(currentIndex + 1, items.length - 1)
    playAtIndex(next)
  }, [currentIndex, items.length, playAtIndex])

  const playPrevious = useCallback(() => {
    if (items.length === 0) return
    const prev = Math.max(currentIndex - 1, 0)
    playAtIndex(prev)
  }, [currentIndex, items.length, playAtIndex])

  // Auto-resume on page boot.
  useEffect(() => {
    if (hasAutoStartedRef.current) return
    if (items.length === 0) return
    if (!readAloudMode) return
    if (!initialResumeRef.current) return
    hasAutoStartedRef.current = true
    playAtIndex(0)
  }, [items.length, readAloudMode, playAtIndex])

  // Keep the live `<audio>` rate in sync with the speed atom.
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed
  }, [speed])

  // Restart from the same index when the language changes mid-playback so
  // the user hears the new locale and the new timecode/text are picked up.
  useEffect(() => {
    if (isPlaying && audioRef.current) playAtIndex(currentIndex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  // Switching word ↔ block mode while a track is loaded: rebuild the
  // highlight scaffolding so the change is visible immediately. Runs even
  // while paused — the user otherwise sees the old mode persist until the
  // next track starts.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audio.src) return
    const item = items[currentIndex]
    if (!item) return
    setupHighlight(item, audio)
  }, [wordHighlightMode, currentIndex, items, setupHighlight])

  // Tear down on unmount (page navigation / runtime teardown).
  useEffect(() => {
    return () => {
      stopAndClear()
      audioRef.current = null
    }
  }, [stopAndClear])

  return {
    isPlaying,
    hasItems: items.length > 0,
    togglePlayPause,
    playNext,
    playPrevious,
  }
}
