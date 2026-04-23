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
