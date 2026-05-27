/**
 * Push a message to a singleton `#sr-announcement` live region. The legacy
 * runtime did the same thing in `ui_utils.js:announceToScreenReader`. Used by
 * activity validators to narrate the overall result ("3 blanks remaining…").
 */

let region: HTMLElement | null = null

function ensureRegion(): HTMLElement {
  if (region) return region
  const existing = document.getElementById("sr-announcement")
  if (existing) {
    region = existing
    return region
  }
  const el = document.createElement("div")
  el.id = "sr-announcement"
  el.setAttribute("role", "status")
  el.setAttribute("aria-live", "polite")
  el.classList.add("sr-only")
  document.body.appendChild(el)
  region = el
  return el
}

export function announceToScreenReader(
  message: string,
  options: { assertive?: boolean } = {},
): void {
  if (typeof document === "undefined") return
  const el = ensureRegion()
  el.setAttribute("aria-live", options.assertive ? "assertive" : "polite")
  // Clearing first guarantees screen readers register the change even when the
  // message is identical to the previous announcement.
  el.textContent = ""
  setTimeout(() => {
    el.textContent = message
  }, 50)
}
