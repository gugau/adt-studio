import { shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'


export function createWindow(): void {
    const mainWindow = new BrowserWindow({
      width: 900,
      height: 670,
      show: false,
      autoHideMenuBar: true,
      ...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false, devTools: true,
      }
    })
  
    mainWindow.on('ready-to-show', () => {
      mainWindow.show()
    })
  
    mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })
  
    const STUDIO_DEV_URL = 'http://localhost:5173'
  
    if (is.dev && process.env.NODE_ENV === 'development') {
      mainWindow.loadURL(STUDIO_DEV_URL)
    } else {
      const STUDIO_PROD_URL = join(__dirname, '../renderer/index.html') 
      mainWindow.loadFile(STUDIO_PROD_URL)
    }
  }
  