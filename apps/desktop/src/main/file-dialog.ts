import { BrowserWindow, dialog, ipcMain } from "electron";
import { writeFile } from "node:fs/promises";

export interface SaveFileDialogOptions {
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export function setupFileDialog(): void {
  ipcMain.handle(
    "file:save",
    async (
      event,
      options: SaveFileDialogOptions,
      data: Uint8Array,
    ): Promise<string | null> => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const result = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options);
      if (result.canceled || !result.filePath) return null;
      await writeFile(result.filePath, Buffer.from(data));
      return result.filePath;
    },
  );
}
