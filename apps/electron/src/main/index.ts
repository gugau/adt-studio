import "dotenv/config";
import {
  screenshotIpcReplyErrorSchema,
  screenshotIpcReplySuccessSchema,
  screenshotIpcUtilityToMainSchema,
} from '@adt/types'
import { app, BrowserWindow, ipcMain, protocol } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createWindow } from './main-window'
import { startApiServer, stopApiServer, setLogForwarder, isApiDebugMode } from './api-process'
import { screenshot, close as closeScreenshotWindows } from './screenshot'
import { registerHtmlRenderProtocol } from './html-render-protocol'

protocol.registerSchemesAsPrivileged([
  { scheme: 'html-render', privileges: { standard: true, secure: true } }
]);

app.whenReady().then(async () => {
  const apiProcess = await startApiServer()

  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  
  /*
    The child (API) process cannot access Electron APIs directly, 
    so the main process handles screenshot operations on its behalf via IPC messaging.
    */
  apiProcess.on('message', async (msg: unknown) => {
    const parsed = screenshotIpcUtilityToMainSchema.safeParse(msg)
    if (!parsed.success) {
      console.warn('[screenshot-ipc] invalid utility message:', parsed.error.flatten())
      return
    }

    const m = parsed.data

    if (m.type === 'screenshot-base64') {
      try {
        const base64 = await screenshot(m.html, m.viewport ?? { width: 1024, height: 768 })
        apiProcess.postMessage(
          screenshotIpcReplySuccessSchema.parse({
            type: 'screenshot-base64-reply',
            id: m.id,
            base64,
          })
        )
      } catch (error) {
        apiProcess.postMessage(
          screenshotIpcReplyErrorSchema.parse({
            type: 'screenshot-base64-reply',
            id: m.id,
            error: error instanceof Error ? error.message : String(error),
          })
        )
      }
      return
    }

    if (m.type === 'screenshot-close') {
      await closeScreenshotWindows()
    }
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  ipcMain.handle('api-debug-mode', () => isApiDebugMode)

  if (isApiDebugMode) {
    setLogForwarder((entry) => {
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('api-log', entry)
      })
    })
  }

  createWindow()
  registerHtmlRenderProtocol()
})

app.on('before-quit', () => {
  stopApiServer()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
