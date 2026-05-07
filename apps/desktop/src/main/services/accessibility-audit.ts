import { BrowserWindow } from "electron";
import { pathToFileURL } from "node:url";

interface AuditOptions {
  filePath: string;
  ruleIds: string[];
  axeSource: string;
  viewport?: { width: number; height: number };
}

interface AuditResult {
  title: string | null;
  violations: unknown[];
  incomplete: unknown[];
  passCount: number;
  inapplicableCount: number;
}

const windows = new Set<InstanceType<typeof BrowserWindow>>();

async function audit({
  filePath,
  ruleIds,
  axeSource,
  viewport = { width: 1280, height: 900 },
}: AuditOptions): Promise<AuditResult> {
  const win = new BrowserWindow({
    width: viewport.width,
    height: viewport.height,
    show: false,
    webPreferences: {
      offscreen: true,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  windows.add(win);

  try {
    const loadPromise = new Promise<void>((resolve, reject) => {
      win.webContents.once("did-finish-load", () => resolve());
      win.webContents.once("did-fail-load", (_, _code, desc) =>
        reject(new Error(desc)),
      );
    });

    await win.loadURL(pathToFileURL(filePath).href);
    await loadPromise;

    await win.webContents.executeJavaScript(
      `(async () => {
        const fonts = document.fonts;
        if (fonts && fonts.ready) await fonts.ready;
      })()`,
    );

    // Force #content to full opacity before axe-core runs.  The page ships
    // with opacity-0 and its own JS adds transition-opacity + removes the
    // class on load — if that transition is in-flight when axe reads
    // computed styles, intermediate opacity values cause spurious
    // color-contrast violations.
    await win.webContents.executeJavaScript(
      `(() => {
        const el = document.getElementById("content");
        if (el) {
          el.classList.remove("opacity-0");
          el.style.opacity = "1";
          el.style.transition = "none";
          void el.offsetHeight;
        }
      })()`,
    );

    await win.webContents.executeJavaScript(axeSource);

    const ruleIdsJson = JSON.stringify(ruleIds);
    const raw = (await win.webContents.executeJavaScript(
      `(async () => {
        if (!window.axe) {
          throw new Error("axe was not initialized in the page context");
        }
        return await window.axe.run(document, {
          runOnly: { type: "rule", values: ${ruleIdsJson} },
        });
      })()`,
    )) as {
      violations?: unknown[];
      incomplete?: unknown[];
      passes?: unknown[];
      inapplicable?: unknown[];
    };

    const title = win.webContents.getTitle() || null;

    return {
      title,
      violations: Array.isArray(raw.violations) ? raw.violations : [],
      incomplete: Array.isArray(raw.incomplete) ? raw.incomplete : [],
      passCount: Array.isArray(raw.passes) ? raw.passes.length : 0,
      inapplicableCount: Array.isArray(raw.inapplicable)
        ? raw.inapplicable.length
        : 0,
    };
  } finally {
    windows.delete(win);
    if (!win.isDestroyed()) {
      win.destroy();
    }
  }
}

async function close(): Promise<void> {
  try {
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.destroy();
      }
    }
    windows.clear();
  } catch {}
}

export { audit, close };
