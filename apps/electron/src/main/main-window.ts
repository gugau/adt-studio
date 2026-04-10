import { shell, BrowserWindow, dialog } from "electron";
import { join } from "path";
import { is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";
import { STUDIO_APP_ORIGIN } from "./protocols/studio-app.protocol";

export function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      devTools: true,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.on("will-prevent-unload", async (event) => {
    // TODO: ADD TRANSLATIONS
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "warning",
      buttons: ["Stay", "Quit"],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      message: "Leave the app?",
      detail: "Your current progress will be lost.",
    });

    if (response === 1) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  const STUDIO_DEV_URL = "http://localhost:5173";

  if (is.dev && process.env.NODE_ENV === "development") {
    mainWindow.loadURL(STUDIO_DEV_URL);
  } else {
    mainWindow.loadURL(`${STUDIO_APP_ORIGIN}/`);
  }
}
