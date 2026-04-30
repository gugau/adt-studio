/// <reference types="vite/client" />

declare module "*.po" {
  import type { Messages } from "@lingui/core"
  const messages: Messages
  export { messages }
}

type UpdateStatus =
  | { phase: "checking" }
  | { phase: "available"; version: string }
  | { phase: "not-available" }
  | { phase: "downloading"; percent: number; bytesPerSecond: number; transferred: number; total: number }
  | { phase: "downloaded"; version: string }
  | { phase: "error"; message: string }

interface SplashControlsApi {
  relaunch: () => Promise<void>
  quit: () => Promise<void>
  getUpdateStatus: () => Promise<UpdateStatus | null>
  onUpdateStatus: (cb: (status: UpdateStatus) => void) => () => void
  readonly version: string
}

interface Window {
  splashControls?: SplashControlsApi
}
