import { BrowserWindow } from "electron";
import { existsSync } from "fs";
import { join } from "path";
import { is } from "@electron-toolkit/utils";

function createSplashWindow(): BrowserWindow {
  const splashWindow = new BrowserWindow({
    width: 420,
    height: 420,
    frame: false,
    transparent: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    closable: false,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      sandbox: false,
    },
  });

  splashWindow.on("ready-to-show", () => {
    splashWindow.show();
  });

  if (is.dev && process.env.NODE_ENV === "development") {
    const SPLASH_DEV_URL = "http://localhost:5174/splashscreen.html";
    splashWindow.loadURL(SPLASH_DEV_URL);
  } else {
    const splashAlive = join(__dirname, "../renderer/alive/splashscreen.html");
    const splashRoot = join(__dirname, "../renderer/splashscreen.html");
    splashWindow.loadFile(existsSync(splashAlive) ? splashAlive : splashRoot);
  }

  return splashWindow;
}

export { createSplashWindow };
