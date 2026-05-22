/**
 * useAutoHideDock — when "auto-hide menus" is enabled, hides the dock after
 * 2 seconds of inactivity. Reveal behavior:
 *   - Mouse movement: cumulative distance must exceed REVEAL_PX_THRESHOLD
 *     since the last reveal so a tiny jitter doesn't pop the dock open.
 *
 * Scrolling and wheel events are deliberately *not* triggers — the user is
 * reading, not asking for the dock — so they neither reveal nor restart the
 * hide timer.
 *
 * The dock also stays visible while one of its menu popovers is open OR
 * while focus is inside the dock — hiding mid-interaction would steal focus
 * and break keyboard / screen-reader flow.
 */
import { useAtomValue, useSetAtom } from "jotai"
import { useEffect, type RefObject } from "react"
import {
  dockHiddenAtom,
  dockMenuValueAtom,
  stateModeAtom,
} from "@/shared/state/ui.atoms"

const HIDE_DELAY_MS = 2000
const REVEAL_PX_THRESHOLD = 100

export function useAutoHideDock(dockRef?: RefObject<HTMLElement | null>) {
  const autoHide = useAtomValue(stateModeAtom)
  const menuValue = useAtomValue(dockMenuValueAtom)
  const setHidden = useSetAtom(dockHiddenAtom)
  const menuOpen = menuValue !== ""

  useEffect(() => {
    if (!autoHide) {
      setHidden(false)
      return
    }
    if (menuOpen) {
      setHidden(false)
      return
    }

    let timer: number | undefined
    let movedSinceLastReveal = 0
    let lastX: number | null = null
    let lastY: number | null = null

    const dockHasFocus = (): boolean => {
      const node = dockRef?.current
      const active = document.activeElement
      if (!node || !active || active === document.body) return false
      return node.contains(active)
    }

    const hide = () => {
      if (dockHasFocus()) {
        schedule()
        return
      }
      setHidden(true)
    }

    const schedule = () => {
      if (timer !== undefined) window.clearTimeout(timer)
      timer = window.setTimeout(hide, HIDE_DELAY_MS)
    }

    const reveal = () => {
      movedSinceLastReveal = 0
      setHidden(false)
      schedule()
    }

    const onMouseMove = (event: MouseEvent) => {
      if (lastX !== null && lastY !== null) {
        const dx = event.clientX - lastX
        const dy = event.clientY - lastY
        movedSinceLastReveal += Math.hypot(dx, dy)
      }
      lastX = event.clientX
      lastY = event.clientY
      if (movedSinceLastReveal >= REVEAL_PX_THRESHOLD) reveal()
    }

    schedule()
    window.addEventListener("mousemove", onMouseMove, { passive: true })
    window.addEventListener("focusin", reveal)

    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("focusin", reveal)
    }
  }, [autoHide, menuOpen, setHidden, dockRef])
}
