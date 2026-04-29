/// <reference types="vite/client" />

declare module "*.po" {
  import type { Messages } from "@lingui/core"
  const messages: Messages
  export { messages }
}

interface SplashControlsApi {
  /** Relaunch the application: schedules a relaunch and quits. */
  relaunch: () => Promise<void>
  /** Quit the application immediately. */
  quit: () => Promise<void>
}

interface Window {
  splashControls?: SplashControlsApi
}
