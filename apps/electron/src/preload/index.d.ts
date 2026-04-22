import { ElectronAPI } from '@electron-toolkit/preload'
import type { ApiLogEntry } from '../main/api'

export type ElectronPlatform = NodeJS.Platform

export interface WindowControlsApi {
  minimize: () => Promise<void>
  toggleMaximize: () => Promise<boolean>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  isFullscreen: () => Promise<boolean>
  onMaximizeChange: (cb: (isMaximized: boolean) => void) => () => void
  onFullscreenChange: (cb: (isFullscreen: boolean) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      onApiLog: (callback: (entry: ApiLogEntry) => void) => () => void
      isApiDebugMode: () => Promise<boolean>
      apiPort: number
      platform: ElectronPlatform
      windowControls: WindowControlsApi
    }
  }
}
