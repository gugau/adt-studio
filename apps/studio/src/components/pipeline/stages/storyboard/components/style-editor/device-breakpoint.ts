import { useEffect, useState } from "react"

export type DeviceView = "desktop" | "tablet" | "mobile"

export const DEVICE_WIDTHS: Record<DeviceView, number> = {
  desktop: 1280,
  tablet: 768,
  mobile: 375,
}

// Tailwind variant prefix used when writing classes for the active device.
// Desktop writes base classes; tablet/mobile write `max-*:` variants per the
// desktop-first cascade. Tablet uses `max-lg:` (fires below 1024px) so it
// applies at the 768px iframe — `max-md:` would not.
export function deviceToPrefix(view: DeviceView): string {
  switch (view) {
    case "desktop":
      return ""
    case "tablet":
      return "max-lg:"
    case "mobile":
      return "max-sm:"
  }
}

export function getCascadePrefixes(view: DeviceView): readonly string[] {
  switch (view) {
    case "desktop":
      return [""]
    case "tablet":
      return ["max-lg:", ""]
    case "mobile":
      return ["max-sm:", "max-lg:", ""]
  }
}

export function getWiderPrefixes(view: DeviceView): readonly string[] {
  return getCascadePrefixes(view).slice(1)
}

export function prefixToBreakpointLabel(prefix: string): DeviceView {
  if (prefix === "max-lg:") return "tablet"
  if (prefix === "max-sm:") return "mobile"
  return "desktop"
}

const STORAGE_KEY = "adt-storyboard-device-view"

function isDeviceView(v: unknown): v is DeviceView {
  return v === "desktop" || v === "tablet" || v === "mobile"
}

export function useDeviceView(
  initial: DeviceView = "desktop"
): [DeviceView, (next: DeviceView) => void] {
  const [view, setView] = useState<DeviceView>(() => {
    if (typeof window === "undefined") return initial
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY)
      return isDeviceView(stored) ? stored : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, view)
    } catch {
      // sessionStorage unavailable (private mode, etc.) — ignore
    }
  }, [view])
  return [view, setView]
}
