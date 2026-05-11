/**
 * useAutoHideDock — when "auto-hide menus" is enabled, hides the dock after
 * 4 seconds of mouse inactivity. Any pointer move, key press, touch, or
 * scroll re-reveals the dock and restarts the timer. If a dock panel is
 * currently open, the dock stays visible regardless of inactivity.
 */
import { useAtomValue, useSetAtom } from "jotai"
import { useEffect } from "react"
import {
  dockHiddenAtom,
  dockMenuValueAtom,
  stateModeAtom,
} from "@/state/ui.atoms"

const HIDE_DELAY_MS = 2000

export function useAutoHideDock() {
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
    const schedule = () => {
      if (timer !== undefined) window.clearTimeout(timer)
      timer = window.setTimeout(() => setHidden(true), HIDE_DELAY_MS)
    }
    const reveal = () => {
      setHidden(false)
      schedule()
    }

    schedule()
    window.addEventListener("mousemove", reveal, { passive: true })
    window.addEventListener("keydown", reveal)
    window.addEventListener("touchstart", reveal, { passive: true })
    window.addEventListener("wheel", reveal, { passive: true })
    window.addEventListener("scroll", reveal, { passive: true, capture: true })

    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
      window.removeEventListener("mousemove", reveal)
      window.removeEventListener("keydown", reveal)
      window.removeEventListener("touchstart", reveal)
      window.removeEventListener("wheel", reveal)
      window.removeEventListener("scroll", reveal, { capture: true })
    }
  }, [autoHide, menuOpen, setHidden])
}
