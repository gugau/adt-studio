import { contextBridge, ipcRenderer } from 'electron'

const splashControls = {
  relaunch: (): Promise<void> => ipcRenderer.invoke('splash:relaunch'),
  quit: (): Promise<void> => ipcRenderer.invoke('splash:quit'),
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
