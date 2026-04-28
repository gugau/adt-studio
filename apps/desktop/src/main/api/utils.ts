import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { app } from "electron";

/**
 * api-server.mjs, WASM, and node_modules are asar-unpacked (native deps). They live under
 * resources/app.asar.unpacked/out/main/, not inside app.asar next to this file.
 */
function resolvePackagedApiMainDir(): string {
  const unpacked = join(
    process.resourcesPath,
    "app.asar.unpacked",
    "out",
    "main",
  );
  if (existsSync(join(unpacked, "api-server.mjs"))) {
    return unpacked;
  }
  return __dirname;
}

function resolveAppResourcesRoot(): string {
  if (app.isPackaged) {
    return process.resourcesPath;
  }
  return join(app.getAppPath(), "..", "..");
}

function resolvePaths() {
  const appDataDir = app.getPath("userData");
  const booksDir = join(appDataDir, "books");

  if (!existsSync(booksDir)) {
    mkdirSync(booksDir, { recursive: true });
  }

  const root = resolveAppResourcesRoot();

  console.table({
    "App data dir": appDataDir,
    "Books dir": booksDir,
    Root: root,
  });

  if (app.isPackaged) {
    const apiMainDir = resolvePackagedApiMainDir();
    return {
      serverPath: join(apiMainDir, "api-server.mjs"),
      root,
      booksDir,
      promptsDir: join(root, "prompts"),
      configPath: join(root, "config.yaml"),
      adtResourcesZip: join(root, "assets", "adt-resources.zip"),
      webAssetsDir: join(root, "assets", "adt"),
    };
  }

  return {
    serverPath: join(root, "apps", "desktop", "out", "main", "api-server.mjs"),
    root,
    booksDir,
    promptsDir: join(root, "prompts"),
    configPath: join(root, "config.yaml"),
    adtResourcesZip: join(root, "assets", "adt-resources.zip"),
    webAssetsDir: join(root, "assets", "adt"),
  };
}

async function waitForApi(apiUrl: string, timeoutMs = 30_000, intervalMs = 200): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(apiUrl);
        if (res.ok) return;
      } catch {
        // not up yet
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`API server did not start within ${timeoutMs}ms`);
  }


export { resolvePaths, waitForApi };
