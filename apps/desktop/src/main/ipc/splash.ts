import { app, ipcMain } from "electron";
import { stopApiServer } from "../api-server";
import {
  copyDebugSnapshot,
  getDebugSnapshot,
  saveDebugSnapshot,
} from "../services/debug-info";

/**
 * IPC handlers exposed to the splashscreen so users can recover when
 * startup hangs (e.g. API server stuck) by relaunching, quitting, or
 * inspecting/copying the captured debug output.
 */
export function registerSplashIpc(): void {
  ipcMain.handle("splash:relaunch", () => {
    stopApiServer();
    app.relaunch();
    app.exit(0);
  });

  ipcMain.handle("splash:quit", () => {
    stopApiServer();
    app.exit(0);
  });

  ipcMain.handle("splash:get-debug-info", () => getDebugSnapshot());

  ipcMain.handle("splash:copy-debug-info", () => copyDebugSnapshot());

  ipcMain.handle("splash:save-debug-info", () => saveDebugSnapshot());
}
