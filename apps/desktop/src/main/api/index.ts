import { dirname, join } from "path";
import { utilityProcess, type UtilityProcess } from "electron";
import { findFreePort } from "./port";
import { resolvePaths, waitForApi } from "./utils";
import { Empty, LogForwarder } from "./types";

let apiProcess: UtilityProcess | null = null;
let apiPort: number | Empty = null;
let logForwarder: LogForwarder | null = null;
const isApiDebugMode = process.env.ADT_DEBUG === "true";

function setLogForwarder(fn: LogForwarder | null): void {
  logForwarder = fn;
}

async function startApiServer(): Promise<{
  apiProcess: UtilityProcess;
  apiPort: number;
}> {
  if (apiProcess) return { apiProcess, apiPort: apiPort! };

  apiPort = await findFreePort({ random: true });

  if (!apiPort) throw new Error("Failed to find free port");

  const apiUrl = `http://localhost:${apiPort}/api/health`;

  const paths = resolvePaths();

  console.table({
    "Starting API server": paths.serverPath,
    "Books dir": paths.booksDir,
    "Prompts dir": paths.promptsDir,
    "Config path": paths.configPath,
    "Debug mode": isApiDebugMode ? "true" : "false",
  });

  apiProcess = utilityProcess.fork(paths.serverPath, [], {
    cwd: paths.root,
    stdio: "pipe",
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV ?? "production",
      NODE_PATH: join(dirname(paths.serverPath), "node_modules"),
      PORT: apiPort.toString(),
      BOOKS_DIR: paths.booksDir,
      PROMPTS_DIR: paths.promptsDir,
      CONFIG_PATH: paths.configPath,
      ADT_RESOURCES_ZIP: paths.adtResourcesZip,
      WEB_ASSETS_DIR: paths.webAssetsDir,
      ADT_ENVIRONMENT: "electron",
    },
  });

  apiProcess.stdout?.on("data", (data: Buffer) => {
    const line = data.toString().trimEnd();
    console.log("[api-server]", line);

    if (isApiDebugMode) {
      logForwarder?.({ stream: "stdout", line, timestamp: Date.now() });
    }
  });

  apiProcess.stderr?.on("data", (data: Buffer) => {
    const line = data.toString().trimEnd();
    console.error("[api-server]", line);

    if (isApiDebugMode) {
      logForwarder?.({ stream: "stderr", line, timestamp: Date.now() });
    }
  });

  const exitBeforeReady = new Promise<never>((_, reject) => {
    apiProcess!.once("exit", (code) =>
      reject(new Error(`API server exited early (code=${code})`)),
    );
  });

  apiProcess.on("exit", (code) => {
    console.log(`[api-process] API server exited (code=${code})`);
    apiProcess = null;
  });

  await Promise.race([waitForApi(apiUrl), exitBeforeReady]);

  return {
    apiProcess,
    apiPort,
  };
}

function stopApiServer(): void {
  if (!apiProcess) return;

  console.log("[api-process] Stopping API server");
  apiProcess.kill();
  apiProcess = null;
}

export {
  apiProcess,
  apiPort,
  startApiServer,
  stopApiServer,
  setLogForwarder,
  isApiDebugMode,
};
