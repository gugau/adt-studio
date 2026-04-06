import { existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { app, utilityProcess, type UtilityProcess } from 'electron'

let apiProcess: UtilityProcess | null = null

export type ApiLogEntry = { stream: 'stdout' | 'stderr'; line: string; timestamp: number }
type LogForwarder = (entry: ApiLogEntry) => void

let logForwarder: LogForwarder | null = null
export const isApiDebugMode = process.env.ADT_DEBUG === 'true'

export function setLogForwarder(fn: LogForwarder | null): void {
  logForwarder = fn
}

/**
 * api-server.mjs, WASM, and node_modules are asar-unpacked (native deps). They live under
 * resources/app.asar.unpacked/out/main/, not inside app.asar next to this file.
 */
function resolvePackagedApiMainDir(): string {
  const unpacked = join(process.resourcesPath, 'app.asar.unpacked', 'out', 'main')
  if (existsSync(join(unpacked, 'api-server.mjs'))) {
    return unpacked
  }
  return __dirname
}

function resolveAppResourcesRoot(): string {
  if (app.isPackaged) {
    return process.resourcesPath
  }
  return join(app.getAppPath(), '..', '..')
}

function resolvePaths() {
  const appDataDir = app.getPath('userData')
  const booksDir = join(appDataDir, 'books')

  if (!existsSync(booksDir)) {
    mkdirSync(booksDir, { recursive: true })
  }

  const root = resolveAppResourcesRoot()

  console.table({
    'App data dir': appDataDir,
    'Books dir': booksDir,
    'Root': root,
  })

  if (app.isPackaged) {
    const apiMainDir = resolvePackagedApiMainDir()
    return {
      serverPath: join(apiMainDir, 'api-server.mjs'),
      root,
      booksDir,
      promptsDir: join(root, 'prompts'),
      configPath: join(root, 'config.yaml'),
      adtResourcesZip: join(root, 'assets', 'adt-resources.zip'),
      webAssetsDir: join(root, 'assets', 'adt'),
    }
  }

  return {
    serverPath: join(root, 'apps', 'electron', 'out', 'main', 'api-server.mjs'),
    root,
    booksDir,
    promptsDir: join(root, 'prompts'),
    configPath: join(root, 'config.yaml'),
    adtResourcesZip: join(root, 'assets', 'adt-resources.zip'),
    webAssetsDir: join(root, 'assets', 'adt'),
  }
}


const API_HEALTH_URL = 'http://localhost:3001/api/health'

async function waitForApi(timeoutMs = 15_000, intervalMs = 200): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(API_HEALTH_URL)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`API server did not start within ${timeoutMs}ms`)
}

export async function startApiServer(): Promise<UtilityProcess> {
  if (apiProcess) return apiProcess

  const paths = resolvePaths()
  
  console.table({
    'Starting API server': paths.serverPath,
    'Books dir': paths.booksDir,
    'Prompts dir': paths.promptsDir,
    'Config path': paths.configPath,
    'Debug mode': isApiDebugMode ? 'true' : 'false',
  });

  apiProcess = utilityProcess.fork(paths.serverPath, [], {
    cwd: paths.root,
    stdio: 'pipe',
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV ?? 'production',
      // External bundle deps are installed next to api-server.mjs (dist/ or out/main/).
      NODE_PATH: join(dirname(paths.serverPath), 'node_modules'),
      PORT: '3001',
      BOOKS_DIR: paths.booksDir,
      PROMPTS_DIR: paths.promptsDir,
      CONFIG_PATH: paths.configPath,
      ADT_RESOURCES_ZIP: paths.adtResourcesZip,
      WEB_ASSETS_DIR: paths.webAssetsDir,
      ADT_ENVIRONMENT: 'electron',
    },
  })

  apiProcess.stdout?.on('data', (data: Buffer) => {
    const line = data.toString().trimEnd()
    console.log('[api-server]', line)
    if (isApiDebugMode) logForwarder?.({ stream: 'stdout', line, timestamp: Date.now() })
  })

  apiProcess.stderr?.on('data', (data: Buffer) => {
    const line = data.toString().trimEnd()
    console.error('[api-server]', line)
    if (isApiDebugMode) logForwarder?.({ stream: 'stderr', line, timestamp: Date.now() })
  })

  const exitBeforeReady = new Promise<never>((_, reject) => {
    apiProcess!.once('exit', (code) => reject(new Error(`API server exited early (code=${code})`)))
  })

  apiProcess.on('exit', (code) => {
    console.log(`[api-process] API server exited (code=${code})`)
    apiProcess = null
  })

  await Promise.race([waitForApi(), exitBeforeReady])

  return apiProcess
}

export function stopApiServer(): void {
  if (!apiProcess) return

  console.log('[api-process] Stopping API server')
  apiProcess.kill()
  apiProcess = null
}

export {
  apiProcess
}