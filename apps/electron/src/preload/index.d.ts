import { ElectronAPI } from '@electron-toolkit/preload'
import type { ApiLogEntry } from '../main/api-process'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      onApiLog: (callback: (entry: ApiLogEntry) => void) => () => void
      isApiDebugMode: () => Promise<boolean>
    }
  }
}
