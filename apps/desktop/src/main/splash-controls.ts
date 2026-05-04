import { app, ipcMain } from "electron";
import { stopApiServer } from "./api";

/**
 * IPC handlers exposed to the splashscreen so users can recover when
 * startup hangs (e.g. API server stuck) by relaunching or quitting.
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
}
