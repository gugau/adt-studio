/**
 * Syncs the persisted `themeAtom` to a `.dark` class on the chrome
 * containers only — `#interface-container` and `#nav-container`. The
 * book content (`#content`), `<body>`, and `<html>` are never touched,
 * so the book renders identically regardless of theme.
 *
 * Popovers and dialogs portal into `#interface-container` (see
 * `components/ui/popover.tsx` + `dialog.tsx`), so they inherit the
 * `.dark` class and adapt with the rest of the chrome.
 *
 * - `"light"` / `"dark"`: explicit override.
 * - `"system"`: follows the OS `prefers-color-scheme` media query and
 *   re-applies when the user changes their OS preference live.
 *
 * Mounted once from `ChromeRoot` (always present on every page).
 */
import { useAtomValue } from "jotai"
import { useLayoutEffect } from "react"
import { themeAtom, type Theme } from "@/state/ui.atoms"

/** IDs of the elements that own the React chrome subtrees. */
const CHROME_CONTAINER_IDS = ["interface-container", "nav-container"] as const

function prefersDark(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function applyClass(isDark: boolean): void {
  if (typeof document === "undefined") return
  for (const id of CHROME_CONTAINER_IDS) {
    const el = document.getElementById(id)
    if (!el) continue
    el.classList.toggle("dark", isDark)
    el.dataset.theme = isDark ? "dark" : "light"
  }
}

export function useThemeSync(): void {
  const theme = useAtomValue(themeAtom) as Theme

  useLayoutEffect(() => {
    if (typeof document === "undefined") return

    const apply = () => {
      const isDark =
        theme === "system" ? prefersDark() : theme === "dark"
      applyClass(isDark)
    }

    apply()

    if (theme !== "system" || typeof window === "undefined") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [theme])
}
