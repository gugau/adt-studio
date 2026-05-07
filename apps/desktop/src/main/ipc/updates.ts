import { BrowserWindow, ipcMain } from "electron";
import {
  checkForUpdates,
  deferInstallUntilQuit,
  downloadUpdate,
  getLastUpdateStatus,
  onUpdateStatus,
  quitAndInstall,
  type UpdateStatus,
} from "../services/auto-updater";

const UPDATE_STATUS_CHANNEL = "updates:status";

export function registerUpdatesIpc(): () => void {
  ipcMain.handle("updates:check", () => checkForUpdates());
  ipcMain.handle("updates:download", () => downloadUpdate());
  ipcMain.handle("updates:install", () => {
    quitAndInstall();
  });
  ipcMain.handle("updates:install-on-quit", () => {
    deferInstallUntilQuit();
  });
  ipcMain.handle("updates:get-status", () => getLastUpdateStatus());

  return onUpdateStatus((status: UpdateStatus) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(UPDATE_STATUS_CHANNEL, status);
      }
    }
  });
}
