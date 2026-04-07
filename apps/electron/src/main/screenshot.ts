import { BrowserWindow } from "electron";
import { randomUUID } from "node:crypto";
import { htmlStore } from "./html-render-protocol";

const windows = new Set<InstanceType<typeof BrowserWindow>>();
async function screenshot(
  html: string,
  viewport: { width: number; height: number },
): Promise<string> {
  const id = randomUUID();
  htmlStore.set(id, html);

  const win = new BrowserWindow({
    width: viewport.width,
    height: viewport.height,
    show: false,
    webPreferences: { offscreen: true },
  });

  const loadPromise = new Promise<void>((resolve, reject) => {
    win.webContents.once("did-finish-load", resolve);
    win.webContents.once("did-fail-load", (_, _code, desc) =>
      reject(new Error(desc)),
    );
  });

  await win.loadURL(`html-render://${id}`);
  await loadPromise;

  const image = await win.webContents.capturePage();
  win.destroy();
  htmlStore.delete(id);

  return image.toPNG().toString("base64");
}

async function close(): Promise<void> {
  try {
    for (const win of windows) {
      win.destroy();
    }
    windows.clear();
  } catch {}
}

export { screenshot, close };
