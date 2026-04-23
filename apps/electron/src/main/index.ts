import "dotenv/config";
import { app, BrowserWindow, ipcMain, protocol } from "electron";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import { createWindow } from "./main-window";
import {
  startApiServer,
  stopApiServer,
  setLogForwarder,
  apiPort,
  isApiDebugMode,
} from "./api";
import { setupTitleBar } from "./title-bar";
import { setupFileDialog } from "./file-dialog";
import {
  HTML_RENDER_SCHEME_PRIVILEGES,
  registerHtmlRenderProtocol,
} from "./protocols/html-render.protocol";
import { handleScreenshotMessages } from "./screenshot.handler";
import { join } from "node:path";
import {
  registerStudioAppProtocol,
  STUDIO_APP_SCHEME_PRIVILEGES,
} from "./protocols/studio-app.protocol";
import { createSplashWindow } from "./splash-window";

protocol.registerSchemesAsPrivileged([
  STUDIO_APP_SCHEME_PRIVILEGES,
  HTML_RENDER_SCHEME_PRIVILEGES,
]);

app.whenReady().then(async () => {
  const splashWindow = createSplashWindow();
  const { apiProcess } = await startApiServer();

  electronApp.setAppUserModelId("com.electron");

  registerStudioAppProtocol(join(__dirname, "../renderer"));
  registerHtmlRenderProtocol();
  setupTitleBar();
  setupFileDialog();

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  apiProcess.on("message", handleScreenshotMessages(apiProcess));

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  ipcMain.handle("api-debug-mode", () => isApiDebugMode);
  ipcMain.on("api-port", (event) => {
    event.returnValue = apiPort;
  });

  if (isApiDebugMode) {
    setLogForwarder((entry) => {
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send("api-log", entry);
      });
    });
  }

  const mainWindow = createWindow();

  mainWindow.once("ready-to-show", () => {
    if (!splashWindow.isDestroyed()) {
      splashWindow.destroy();
    }
  });
});

app.on("before-quit", () => {
  stopApiServer();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
