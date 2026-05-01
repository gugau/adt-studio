import type { DeviceView } from "./device-breakpoint"

// Device chrome dimensions, ported from lowcode-studio's iphone.tsx /
// ipad.tsx. Each device frame has a fixed aspect ratio; the iframe inside
// renders at the screen's logical width and scrolls vertically when the
// content exceeds the screen's logical height.

export type DeviceFrameSpec = {
  /** Outer chrome width (logical pixels). */
  chromeWidth: number
  /** Outer chrome height (logical pixels). */
  chromeHeight: number
  /** Inner screen width — matches the iframe's render width. */
  screenWidth: number
  /** Inner screen height (the visible viewport before scrolling). */
  screenHeight: number
}

const IPHONE_RATIO = 868 / 428 // iPhone 14 Pro: chromeHeight = chromeWidth × ratio
const IPHONE_SCREEN_W_RATIO = 0.911 // screenWidth / chromeWidth
const IPHONE_SCREEN_H_RATIO = 0.956 // screenHeight / chromeHeight

const IPAD_SCREEN_RATIO = 1366 / 1024 // iPad Pro: screenHeight = screenWidth × ratio
const IPAD_FRAME_W_RATIO = 0.904 // screenWidth / chromeWidth
const IPAD_FRAME_H_RATIO = 0.931 // screenHeight / chromeHeight

const DESKTOP_SCREEN_HEIGHT = 800

export function getDeviceFrame(
  view: DeviceView | undefined,
  renderWidth: number
): DeviceFrameSpec {
  if (view === "mobile") {
    const chromeWidth = Math.round(renderWidth / IPHONE_SCREEN_W_RATIO)
    const chromeHeight = Math.round(chromeWidth * IPHONE_RATIO)
    return {
      chromeWidth,
      chromeHeight,
      screenWidth: renderWidth,
      screenHeight: Math.round(chromeHeight * IPHONE_SCREEN_H_RATIO),
    }
  }
  if (view === "tablet") {
    const screenHeight = Math.round(renderWidth * IPAD_SCREEN_RATIO)
    const chromeWidth = Math.round(renderWidth / IPAD_FRAME_W_RATIO)
    const chromeHeight = Math.round(screenHeight / IPAD_FRAME_H_RATIO)
    return {
      chromeWidth,
      chromeHeight,
      screenWidth: renderWidth,
      screenHeight,
    }
  }

  return {
    chromeWidth: renderWidth,
    chromeHeight: DESKTOP_SCREEN_HEIGHT,
    screenWidth: renderWidth,
    screenHeight: DESKTOP_SCREEN_HEIGHT,
  }
}

export function getTargetVisibleWidth(view: DeviceView | undefined): number {
  if (view === "mobile") return 480
  if (view === "tablet") return 820
  return Number.POSITIVE_INFINITY
}
