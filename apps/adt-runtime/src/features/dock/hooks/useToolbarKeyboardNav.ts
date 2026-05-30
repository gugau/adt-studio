/**
 * Toolbar arrow-key navigation — implements the WAI-ARIA toolbar pattern on
 * the bottom dock:
 *   - Tab moves focus into the toolbar (and out again).
 *   - Arrow Left / Right move focus between focusable controls inside the
 *     toolbar, wrapping at the ends.
 *   - Home / End jump to the first / last focusable control.
 *
 * We don't manage a roving tabindex here — every control already has its own
 * native tabindex and the rest of the page expects them to be reachable via
 * Tab. The handler is purely additive: it accelerates same-toolbar focus
 * movement via the arrow keys without taking anything else away.
 */
import { useEffect, type RefObject } from "react"

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",")

function focusableButtons(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("aria-hidden") && el.offsetParent !== null,
  )
}

export function useToolbarKeyboardNav(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const node = ref.current
    if (!node) return

    const onKeyDown = (event: KeyboardEvent) => {
      const isArrow = event.key === "ArrowLeft" || event.key === "ArrowRight"
      const isJump = event.key === "Home" || event.key === "End"
      if (!isArrow && !isJump) return
      if (event.altKey || event.ctrlKey || event.metaKey) return

      const active = document.activeElement as HTMLElement | null
      if (!active || !node.contains(active)) return

      const items = focusableButtons(node)
      if (items.length === 0) return
      const currentIndex = items.indexOf(active)
      if (currentIndex < 0) return

      let nextIndex = currentIndex
      if (event.key === "ArrowRight") {
        nextIndex = (currentIndex + 1) % items.length
      } else if (event.key === "ArrowLeft") {
        nextIndex = (currentIndex - 1 + items.length) % items.length
      } else if (event.key === "Home") {
        nextIndex = 0
      } else if (event.key === "End") {
        nextIndex = items.length - 1
      }

      if (nextIndex === currentIndex) return
      event.preventDefault()
      event.stopPropagation()
      items[nextIndex].focus()
    }

    node.addEventListener("keydown", onKeyDown)
    return () => node.removeEventListener("keydown", onKeyDown)
  }, [ref])
}
