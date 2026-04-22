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

interface Window {
  api: {
    onApiLog: (callback: (entry: ElectronApiLogEntry) => void) => () => void
    isApiDebugMode: () => Promise<boolean>
    apiPort: number
  }
}
