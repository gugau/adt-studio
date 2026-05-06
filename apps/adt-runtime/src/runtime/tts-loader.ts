/**
 * Loads `./content/i18n/<lang>/timecode/timecode_output.json` and writes
 * the flattened word-timestamp map into `timecodeMapAtom`.
 *
 * The legacy on-disk format wraps each entry as `{ timecodes: [null, { word_timestamps }] }`
 * for compatibility with an earlier multi-track timecode shape. We flatten
 * that here so consumers (the audio player + word highlighter) just deal
 * with `Record<textId, WordTimestamp[]>`.
 */
import { getDefaultStore } from "jotai"
import { timecodeMapAtom, type TimecodeMap, type WordTimestamp } from "@/state/audio.atoms"

interface RawTimecodeEntry {
  timecodes?: [unknown, { word_timestamps?: WordTimestamp[] }]
}

export async function loadTimecodes(
  lang: string,
  bundleVersion?: string,
): Promise<TimecodeMap> {
  const versionParam = bundleVersion ? `?v=${bundleVersion}` : ""
  const url = `./content/i18n/${lang}/timecode/timecode_output.json${versionParam}`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      getDefaultStore().set(timecodeMapAtom, {})
      return {}
    }
    const raw = (await res.json()) as Record<string, RawTimecodeEntry>
    const map: TimecodeMap = {}
    for (const [textId, entry] of Object.entries(raw)) {
      const words = entry.timecodes?.[1]?.word_timestamps
      if (Array.isArray(words) && words.length > 0) map[textId] = words
    }
    getDefaultStore().set(timecodeMapAtom, map)
    return map
  } catch (err) {
    console.warn(`[tts] failed to load ${url}`, err)
    getDefaultStore().set(timecodeMapAtom, {})
    return {}
  }
}
