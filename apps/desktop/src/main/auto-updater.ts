import { app, BrowserWindow } from "electron";
import { autoUpdater, type ProgressInfo, type UpdateInfo } from "electron-updater";

export type UpdateStatus =
  | { phase: "checking" }
  | { phase: "available"; version: string }
  | { phase: "not-available" }
  | { phase: "downloading"; percent: number; bytesPerSecond: number; transferred: number; total: number }
  | { phase: "downloaded"; version: string }
  | { phase: "error"; message: string };

type StatusListener = (status: UpdateStatus) => void;

const listeners = new Set<StatusListener>();
let lastStatus: UpdateStatus | null = null;

function emit(status: UpdateStatus): void {
  lastStatus = status;
  for (const fn of listeners) fn(status);
}

export function onUpdateStatus(fn: StatusListener): () => void {
  listeners.add(fn);
  if (lastStatus) fn(lastStatus);
  return () => listeners.delete(fn);
}

export function getLastUpdateStatus(): UpdateStatus | null {
  return lastStatus;
}

export function broadcastToAllWindows(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
}

let configured = false;

function configure(): void {
  if (configured) return;
  configured = true;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = true;
  autoUpdater.logger = console;

  autoUpdater.on("checking-for-update", () => {
    emit({ phase: "checking" });
  });

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    emit({ phase: "available", version: info.version });
  });

  autoUpdater.on("update-not-available", () => {
    emit({ phase: "not-available" });
  });

  autoUpdater.on("download-progress", (progress: ProgressInfo) => {
    emit({
      phase: "downloading",
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    emit({ phase: "downloaded", version: info.version });
  });

  autoUpdater.on("error", (err: Error) => {
    emit({ phase: "error", message: err?.message ?? String(err) });
  });
}

/**
 * Check for updates and, if found, download and install them before the app finishes launching.
 *
 * Returns:
 *   - "updating": an update was downloaded and the app is about to relaunch — caller MUST stop bootstrapping
 *   - "no-update": no update available, or running unpacked / dev — caller should continue normal startup
 *   - "error": update flow failed; caller should continue normal startup
 */
export async function runStartupUpdateCheck(): Promise<"updating" | "no-update" | "error"> {
  if (!app.isPackaged) {
    emit({ phase: "not-available" });
    return "no-update";
  }

  configure();

  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result?.updateInfo || result.updateInfo.version === app.getVersion()) {
      emit({ phase: "not-available" });
      return "no-update";
    }

    await result.downloadPromise;

    autoUpdater.quitAndInstall(false, true);
    return "updating";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit({ phase: "error", message });
    return "error";
  }
}
