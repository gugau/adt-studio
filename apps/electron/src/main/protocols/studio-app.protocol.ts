import { stat } from "node:fs/promises";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { net, protocol } from "electron";

export const STUDIO_APP_HOST = "adt.studio";
export const STUDIO_APP_ORIGIN = `app://${STUDIO_APP_HOST}`;
export const STUDIO_APP_SCHEME_PRIVILEGES = {
  scheme: "app",
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true,
  },
} as Electron.CustomScheme;

function isPathInsideRoot(filePath: string, rootDir: string): boolean {
  const resolvedFile = path.resolve(filePath);
  const resolvedRoot = path.resolve(rootDir);
  if (process.platform === "win32") {
    const f = resolvedFile.toLowerCase();
    const r = resolvedRoot.toLowerCase();
    return f === r || f.startsWith(r + path.sep);
  }
  return (
    resolvedFile === resolvedRoot ||
    resolvedFile.startsWith(resolvedRoot + path.sep)
  );
}

export function registerStudioAppProtocol(rendererDistDir: string): void {
  const root = rendererDistDir;

  protocol.handle("app", async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== STUDIO_APP_HOST) {
      return new Response("Not Found", { status: 404 });
    }

    let pathname = decodeURI(url.pathname);
    if (!pathname || pathname === "/") {
      pathname = "/index.html";
    }

    const relative = pathname.replace(/^\/+/, "");
    const candidate = path.join(root, relative);

    if (!isPathInsideRoot(candidate, root)) {
      return new Response("Forbidden", { status: 403 });
    }

    try {
      const st = await stat(candidate);
      if (st.isFile()) {
        return net.fetch(pathToFileURL(candidate).href);
      }
      if (st.isDirectory()) {
        const indexInDir = path.join(candidate, "index.html");
        if (isPathInsideRoot(indexInDir, root)) {
          return net.fetch(pathToFileURL(indexInDir).href);
        }
      }
    } catch {}

    const indexHtml = path.join(root, "index.html");

    if (!isPathInsideRoot(indexHtml, root)) {
      return new Response("Forbidden", { status: 403 });
    }

    return net.fetch(pathToFileURL(indexHtml).href);
  });
}
