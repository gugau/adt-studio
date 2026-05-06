import { useCallback, useEffect, useState } from "react"
import { isElectron } from "@/lib/utils"

export interface WindowControls {
  /** True when running in an Electron renderer with the preload bridge. */
  available: boolean
  isMaximized: boolean
  isFullscreen: boolean
  minimize: () => void
  toggleMaximize: () => void
  close: () => void
}

/**
 * Thin React wrapper around `window.api.windowControls`.
 *
 * Tracks the maximize/fullscreen state from the main process so UI can swap
 * the restore ⇄ maximize glyph. In a non-Electron context the hook returns
 * `available: false` and no-op actions — callers should branch on `available`.
 */
export function useWindowControls(): WindowControls {
  const controls =
    typeof window !== "undefined" ? window.api?.windowControls : undefined
  const available = isElectron() && !!controls

  const [isMaximized, setIsMaximized] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (!available || !controls) return
    let disposed = false

    controls.isMaximized().then((v) => {
      if (!disposed) setIsMaximized(v)
    })
    controls.isFullscreen().then((v) => {
      if (!disposed) setIsFullscreen(v)
    })

    const offMax = controls.onMaximizeChange(setIsMaximized)
    const offFs = controls.onFullscreenChange(setIsFullscreen)

    return () => {
      disposed = true
      offMax()
      offFs()
    }
  }, [available, controls])

  const minimize = useCallback(() => {
    controls?.minimize()
  }, [controls])

  const toggleMaximize = useCallback(() => {
    controls?.toggleMaximize()
  }, [controls])

  const close = useCallback(() => {
    controls?.close()
  }, [controls])

  return { available, isMaximized, isFullscreen, minimize, toggleMaximize, close }
}
