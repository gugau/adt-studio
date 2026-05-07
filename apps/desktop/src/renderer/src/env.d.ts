/// <reference types="vite/client" />

declare module "*.po" {
  import type { Messages } from "@lingui/core"
  const messages: Messages
  export { messages }
}

interface SplashControlsApi {
  relaunch: () => Promise<void>
  quit: () => Promise<void>
  readonly version: string
}

interface Window {
  splashControls?: SplashControlsApi
}
