import { useEffect, useState } from "react"

export type DeviceView = "desktop" | "tablet" | "mobile"

export const DEVICE_WIDTHS: Record<DeviceView, number> = {
  desktop: 1280,
  tablet: 768,
  mobile: 375,
}

// Step 7 will read from this. Desktop edits the base classes; tablet/mobile
// emit `max-md:` / `max-sm:` variants per the desktop-first cascade plan.
export function deviceToPrefix(view: DeviceView): string {
  switch (view) {
    case "desktop":
      return ""
    case "tablet":
      return "max-md:"
    case "mobile":
      return "max-sm:"
  }
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
