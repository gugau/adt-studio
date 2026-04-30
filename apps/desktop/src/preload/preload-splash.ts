import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

export type UpdateStatus =
  | { phase: 'checking' }
  | { phase: 'available'; version: string }
  | { phase: 'not-available' }
  | { phase: 'downloading'; percent: number; bytesPerSecond: number; transferred: number; total: number }
  | { phase: 'downloaded'; version: string }
  | { phase: 'error'; message: string }

const splashControls = {
  relaunch: (): Promise<void> => ipcRenderer.invoke('splash:relaunch'),
  quit: (): Promise<void> => ipcRenderer.invoke('splash:quit'),
  getUpdateStatus: (): Promise<UpdateStatus | null> => ipcRenderer.invoke('splash:get-update-status'),
  onUpdateStatus: (cb: (status: UpdateStatus) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, status: UpdateStatus): void => cb(status)
    ipcRenderer.on('splash:update-status', listener)
    return () => ipcRenderer.removeListener('splash:update-status', listener)
  },
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
