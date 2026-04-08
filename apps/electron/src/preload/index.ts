import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { ApiLogEntry } from '../main/api/types'

type ApiLogCallback = (entry: ApiLogEntry) => void

const api = {
  onApiLog: (callback: ApiLogCallback): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, entry: ApiLogEntry) => callback(entry)
    ipcRenderer.on('api-log', handler)
    return () => ipcRenderer.off('api-log', handler)
  },
  isApiDebugMode: (): Promise<boolean> => ipcRenderer.invoke('api-debug-mode'),
  get apiPort(): number {
    return ipcRenderer.sendSync('api-port')
  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
