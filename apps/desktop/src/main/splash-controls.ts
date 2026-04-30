import { app, ipcMain } from "electron";
import { stopApiServer } from "./api";
import { getLastUpdateStatus } from "./auto-updater";

/**
 * IPC handlers exposed to the splashscreen so users can recover when
 * startup hangs (e.g. API server stuck) by relaunching or quitting,
 * and so the splash UI can read the latest auto-update status on demand.
 */
export function setupSplashControls(): void {
  ipcMain.handle("splash:relaunch", () => {
    stopApiServer();
    app.relaunch();
    app.exit(0);
  });

  ipcMain.handle("splash:quit", () => {
    stopApiServer();
    app.exit(0);
  });

  ipcMain.handle("splash:get-update-status", () => getLastUpdateStatus());
}
