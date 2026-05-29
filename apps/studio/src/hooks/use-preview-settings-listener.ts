/**
 * Captures reader-customization settings posted by the ADT runtime when it
 * runs inside a Studio preview iframe. Mounted once at the app root so
 * navigation between Studio tabs doesn't drop earlier captures.
 *
 * Wire protocol (from apps/adt-runtime/src/app/lifecycle.ts):
 *   { type: "adt-runtime/preview-settings", bookLabel, settings: { ... } }
 *
 * ExportView reads the captured snapshot for the current book and includes
 * it in the export request as `defaultSettings`.
 */
import { useEffect, useSyncExternalStore } from "react"

export interface CapturedSettings {
  dockLayout?: {
    width?: "compact" | "full"
    position?: "top" | "bottom"
    align?: "center" | "spread"
  }
  theme?: "light" | "dark" | "system"
  iconSize?: "sm" | "md" | "lg"
  reduceMotion?: boolean
}

const MESSAGE_TYPE = "adt-runtime/preview-settings"

// Module-level store — singleton, survives component unmount/remount.
let store: Record<string, CapturedSettings> = {}
const subscribers = new Set<() => void>()

function subscribe(fn: () => void): () => void {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

function getSnapshot(): Record<string, CapturedSettings> {
  return store
}

function setBookSettings(bookLabel: string, settings: CapturedSettings): void {
  store = { ...store, [bookLabel]: settings }
  for (const fn of subscribers) fn()
}

function isValidPayload(
  data: unknown,
): data is { type: string; bookLabel: string; settings: CapturedSettings } {
  if (!data || typeof data !== "object") return false
  const d = data as Record<string, unknown>
  return (
    d.type === MESSAGE_TYPE &&
    typeof d.bookLabel === "string" &&
    d.bookLabel.length > 0 &&
    typeof d.settings === "object" &&
    d.settings !== null
  )
}

/** Mount once at the app root to start capturing preview settings. */
export function usePreviewSettingsListener(): void {
  useEffect(() => {
    const handler = (event: MessageEvent): void => {
      if (!isValidPayload(event.data)) return
      setBookSettings(event.data.bookLabel, event.data.settings)
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [])
}

/** Read the latest captured settings for a given book (or undefined). */
export function useCapturedPreviewSettings(bookLabel: string): CapturedSettings | undefined {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return snapshot[bookLabel]
}
