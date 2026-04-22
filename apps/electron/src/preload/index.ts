import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { ApiLogEntry } from '../main/api/types'

type ApiLogCallback = (entry: ApiLogEntry) => void
type MaximizeChangeCallback = (isMaximized: boolean) => void
type FullscreenChangeCallback = (isFullscreen: boolean) => void

export type ElectronPlatform = NodeJS.Platform

const windowControls = {
  minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: (): Promise<boolean> =>
    ipcRenderer.invoke('window:toggle-maximize'),
  close: (): Promise<void> => ipcRenderer.invoke('window:close'),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:is-maximized'),
  isFullscreen: (): Promise<boolean> =>
    ipcRenderer.invoke('window:is-fullscreen'),
  onMaximizeChange: (cb: MaximizeChangeCallback): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, isMaximized: boolean) =>
      cb(isMaximized)
    ipcRenderer.on('window:maximize-change', handler)
    return () => ipcRenderer.off('window:maximize-change', handler)
  },
  onFullscreenChange: (cb: FullscreenChangeCallback): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, isFullscreen: boolean) =>
      cb(isFullscreen)
    ipcRenderer.on('window:fullscreen-change', handler)
    return () => ipcRenderer.off('window:fullscreen-change', handler)
  },
}

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
  get platform(): ElectronPlatform {
    return ipcRenderer.sendSync('app:platform') as ElectronPlatform
  },
  windowControls,
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
