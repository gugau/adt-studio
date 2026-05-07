import { app, ipcMain } from "electron";

/**
 * Process-level info exposed via sync IPC. Must be registered before any window is created
 * so the splash window's preload can read it during initial render.
 */
export function registerAppInfoIpc(): void {
  ipcMain.on("app:platform", (event) => {
    event.returnValue = process.platform;
  });

  ipcMain.on("app:version", (event) => {
    event.returnValue = app.getVersion();
  });
}
