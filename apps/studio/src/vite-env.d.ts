/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WORKSPACE_NAME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "*.po" {
  import type { Messages } from "@lingui/core"
  const messages: Messages
  export { messages }
}

interface ElectronApiLogEntry {
  stream: "stdout" | "stderr"
  line: string
  timestamp: number
}

/**
 * The same values Node.js exposes via `process.platform`. Mirrors
 * `NodeJS.Platform` without requiring a node types dependency in the studio.
 */
type ElectronPlatform =
  | "aix"
  | "android"
  | "darwin"
  | "freebsd"
  | "haiku"
  | "linux"
  | "openbsd"
  | "sunos"
  | "win32"
  | "cygwin"
  | "netbsd"

interface ElectronWindowControls {
  minimize: () => Promise<void>
  toggleMaximize: () => Promise<boolean>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  isFullscreen: () => Promise<boolean>
  onMaximizeChange: (cb: (isMaximized: boolean) => void) => () => void
  onFullscreenChange: (cb: (isFullscreen: boolean) => void) => () => void
}

interface Window {
  api: {
    onApiLog: (callback: (entry: ElectronApiLogEntry) => void) => () => void
    isApiDebugMode: () => Promise<boolean>
    apiPort: number
    /** `process.platform` of the Electron main process. Undefined in the web build. */
    platform?: ElectronPlatform
    /** IPC bridge for custom title bar controls. Undefined in the web build. */
    windowControls?: ElectronWindowControls
  }
}
