import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { useCallback, useEffect, useMemo, useRef } from "react"
import {
  audioSpeedAtom,
  audioVolumeAtom,
  autoplayModeAtom,
  currentAudioIndexAtom,
  describeImagesModeAtom,
  isPlayingAtom,
  readAloudModeAtom,
  timecodeMapAtom,
  wordHighlightModeAtom,
} from "@/features/audio/state/audio.atoms"
import { audioFilesAtom, currentLanguageAtom } from "@/features/language/state/language.atoms"
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
} from "@/features/audio/lib/word-highlight"
import type { WordTimestamp } from "@/features/audio/state/audio.atoms"

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
  stop: () => void
}

export function useAudioPlayer(): UseAudioPlayer {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const activeRef = useRef<ActiveHighlight | null>(null)
  const hasAutoStartedRef = useRef<boolean>(false)
  const [isPlaying, setIsPlaying] = useAtom(isPlayingAtom)
  const [currentIndex, setCurrentIndex] = useAtom(currentAudioIndexAtom)
  const audioFiles = useAtomValue(audioFilesAtom)
  const language = useAtomValue(currentLanguageAtom) as string
  const speed = useAtomValue(audioSpeedAtom) as number
  const volume = useAtomValue(audioVolumeAtom) as number
  const autoplayMode = useAtomValue(autoplayModeAtom) as boolean
  const readAloudMode = useAtomValue(readAloudModeAtom) as boolean
  const setReadAloudMode = useSetAtom(readAloudModeAtom)
  const wordHighlightMode = useAtomValue(wordHighlightModeAtom) as boolean
  const describeImagesMode = useAtomValue(describeImagesModeAtom) as boolean
  const timecodeMap = useAtomValue(timecodeMapAtom)
  const wordHighlightModeRef = useRef(wordHighlightMode)
  const speedRef = useRef(speed)
  const volumeRef = useRef(volume)
  const initialResumeRef = useRef<boolean>(isPlaying || autoplayMode)

  wordHighlightModeRef.current = wordHighlightMode
  speedRef.current = speed
  volumeRef.current = volume

  const items = useMemo(() => {
    const all = gatherPlayableItems(audioFiles)
    if (describeImagesMode) return all
    return all.filter((item) => item.el.tagName.toLowerCase() !== "img")
  }, [audioFiles, describeImagesMode])

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
      audio.playbackRate = speedRef.current
      audio.volume = Math.max(0, Math.min(1, volumeRef.current))

      audio.onloadedmetadata = () => {
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

      setupHighlight(item, audio)

      setCurrentIndex(index)
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn("[adt-runtime] audio.play() rejected", err)
          teardownActive()
          setIsPlaying(false)
        })
    },
    [
      items,
      language,
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
      return
    }
    setReadAloudMode(true)
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
  }, [items.length, currentIndex, playAtIndex, setIsPlaying, setReadAloudMode])

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

  const stop = useCallback(() => {
    stopAndClear()
    setIsPlaying(false)
    setCurrentIndex(0)
  }, [stopAndClear, setIsPlaying, setCurrentIndex])

  useEffect(() => {
    if (hasAutoStartedRef.current) return
    if (items.length === 0) return
    if (!readAloudMode) return
    if (!initialResumeRef.current) return
    hasAutoStartedRef.current = true
    playAtIndex(0)
  }, [items.length, readAloudMode, playAtIndex])

  useEffect(() => {
    if (readAloudMode) return
    stopAndClear()
    setIsPlaying(false)
    setCurrentIndex(0)
  }, [readAloudMode, stopAndClear, setIsPlaying, setCurrentIndex])

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed
  }, [speed])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = Math.max(0, Math.min(1, volume))
  }, [volume])

  useEffect(() => {
    if (isPlaying && audioRef.current) playAtIndex(currentIndex)
  }, [language])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audio.src) return
    const item = items[currentIndex]
    if (!item) return
    setupHighlight(item, audio)
  }, [wordHighlightMode, currentIndex, items, setupHighlight])

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
    stop,
  }
}
