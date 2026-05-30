import { useMemo } from "react"

export type DesktopOS = "windows" | "macos" | "linux"

function resolveDesktopOS(): DesktopOS {
  if (typeof window !== "undefined" && window.api?.platform) {
    switch (window.api.platform) {
      case "darwin":
        return "macos"
      case "win32":
        return "windows"
      default:
        return "linux"
    }
  }

  if (typeof navigator === "undefined") return "linux"
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes("mac")) return "macos"
  if (ua.includes("win")) return "windows"
  return "linux"
}

/**
 * Detected desktop OS. Stable across renders — platform can't change at runtime.
 */
export function usePlatform(): DesktopOS {
  return useMemo(() => resolveDesktopOS(), [])
}
