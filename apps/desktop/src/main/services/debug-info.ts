import { app, clipboard, dialog } from "electron";
import { writeFileSync } from "fs";
import os from "os";

export interface DebugLogEntry {
  stream: "stdout" | "stderr" | "main";
  line: string;
  timestamp: number;
}

export interface StartupError {
  message: string;
  stack?: string;
  at: number;
}

export interface DebugSnapshot {
  appVersion: string;
  electronVersion: string;
  chromeVersion: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  startedAt: number;
  uptimeMs: number;
  startupError: StartupError | null;
  logs: DebugLogEntry[];
}

const BUFFER_SIZE = 500;
const buffer: DebugLogEntry[] = [];
let startupError: StartupError | null = null;
const startedAt = Date.now();

export function pushDebugLog(entry: DebugLogEntry): void {
  buffer.push(entry);
  if (buffer.length > BUFFER_SIZE) buffer.shift();
}

export function setStartupError(err: unknown): void {
  if (err instanceof Error) {
    startupError = { message: err.message, stack: err.stack, at: Date.now() };
  } else {
    startupError = { message: String(err), at: Date.now() };
  }
  pushDebugLog({
    stream: "main",
    line: `Startup error: ${startupError.message}`,
    timestamp: startupError.at,
  });
}

export function getDebugSnapshot(): DebugSnapshot {
  return {
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron ?? "unknown",
    chromeVersion: process.versions.chrome ?? "unknown",
    nodeVersion: process.versions.node ?? "unknown",
    platform: process.platform,
    arch: process.arch,
    startedAt,
    uptimeMs: Date.now() - startedAt,
    startupError,
    logs: buffer.slice(),
  };
}

export function formatDebugSnapshot(s: DebugSnapshot): string {
  const lines: string[] = [];
  lines.push(`ADT Studio v${s.appVersion}`);
  lines.push(`Platform: ${s.platform} (${s.arch})`);
  lines.push(
    `Electron: ${s.electronVersion} | Chrome: ${s.chromeVersion} | Node: ${s.nodeVersion}`,
  );
  lines.push(`Uptime: ${(s.uptimeMs / 1000).toFixed(1)}s`);
  lines.push("");

  if (s.startupError) {
    lines.push("--- Startup Error ---");
    lines.push(s.startupError.message);
    if (s.startupError.stack) lines.push(s.startupError.stack);
    lines.push("");
  }

  lines.push("--- Recent Logs ---");
  for (const e of s.logs) {
    const t = new Date(e.timestamp).toISOString();
    lines.push(`[${t}] [${e.stream}] ${e.line}`);
  }

  return lines.join(os.EOL);
}

export function copyDebugSnapshot(): string {
  const text = formatDebugSnapshot(getDebugSnapshot());
  clipboard.writeText(text);
  return text;
}

export async function saveDebugSnapshot(): Promise<string | null> {
  const text = formatDebugSnapshot(getDebugSnapshot());
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `adt-studio-debug-${stamp}.txt`;
  const result = await dialog.showSaveDialog({
    defaultPath: filename,
    filters: [{ name: "Text", extensions: ["txt"] }],
  });
  if (result.canceled || !result.filePath) return null;
  writeFileSync(result.filePath, text, "utf8");
  return result.filePath;
}
