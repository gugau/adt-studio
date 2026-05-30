/// <reference types="vite/client" />

declare module "*.po" {
  import type { Messages } from "@lingui/core"
  const messages: Messages
  export { messages }
}

// Use inline `import("…")` so this file stays a script (no top-level
// imports) and its global declarations remain ambient.
type DebugSnapshot = import("../../main/services/debug-info").DebugSnapshot

interface SplashControlsApi {
  relaunch: () => Promise<void>
  quit: () => Promise<void>
  getDebugInfo: () => Promise<DebugSnapshot>
  copyDebugInfo: () => Promise<string>
  saveDebugInfo: () => Promise<string | null>
  readonly version: string
}

interface Window {
  splashControls?: SplashControlsApi
}
