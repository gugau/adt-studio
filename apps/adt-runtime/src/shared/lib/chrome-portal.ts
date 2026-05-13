/**
 * Returns the container that portaled chrome UI (popovers, dialogs, etc.)
 * should render into. We use `#interface-container` — the React mount
 * point for `ChromeRoot` — so portaled elements inherit the `.dark` class
 * that `useThemeSync` toggles there. Defaulting to `document.body` (Base
 * UI's default) would put popovers outside the themed subtree and they'd
 * render in the wrong theme.
 *
 * If the container can't be found (very early in boot, or SSR), `null`
 * tells Base UI to fall back to its default (`document.body`).
 */
export function getChromePortalContainer(): HTMLElement | null {
  if (typeof document === "undefined") return null
  return document.getElementById("interface-container")
}
