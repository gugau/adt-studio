import { ipcMain, BrowserWindow } from "electron";

export function registerTitleBarIpc(): void {
  const senderWindow = (event: Electron.IpcMainInvokeEvent) =>
    BrowserWindow.fromWebContents(event.sender);

  ipcMain.handle("window:minimize", (event) => {
    senderWindow(event)?.minimize();
  });

  ipcMain.handle("window:toggle-maximize", (event) => {
    const win = senderWindow(event);
    if (!win) return false;
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
    return win.isMaximized();
  });

  ipcMain.handle("window:close", (event) => {
    senderWindow(event)?.close();
  });

  ipcMain.handle("window:is-maximized", (event) => {
    return senderWindow(event)?.isMaximized() ?? false;
  });

  ipcMain.handle("window:is-fullscreen", (event) => {
    return senderWindow(event)?.isFullScreen() ?? false;
  });
}
