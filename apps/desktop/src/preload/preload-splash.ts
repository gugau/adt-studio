import { contextBridge, ipcRenderer } from 'electron'
import type { DebugSnapshot } from '../main/services/debug-info'

const splashControls = {
  relaunch: (): Promise<void> => ipcRenderer.invoke('splash:relaunch'),
  quit: (): Promise<void> => ipcRenderer.invoke('splash:quit'),
  getDebugInfo: (): Promise<DebugSnapshot> =>
    ipcRenderer.invoke('splash:get-debug-info'),
  copyDebugInfo: (): Promise<string> =>
    ipcRenderer.invoke('splash:copy-debug-info'),
  saveDebugInfo: (): Promise<string | null> =>
    ipcRenderer.invoke('splash:save-debug-info'),
  get version(): string {
    return ipcRenderer.sendSync('app:version') as string
  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('splashControls', splashControls)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.splashControls = splashControls
}
