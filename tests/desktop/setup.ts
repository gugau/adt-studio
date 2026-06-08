import { test as base, chromium, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { spawn } from 'node:child_process'
import readline from 'node:readline'
import type { ChildProcess } from 'node:child_process'

const _require = createRequire(import.meta.url)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')

// Built by `pnpm build:desktop` (electron-vite output)
const ELECTRON_MAIN = path.join(REPO_ROOT, 'apps/desktop/out/main/index.js')

export type DesktopFixtures = {
  /** Isolated Electron user-data directory — removed after each test. */
  userDataDir: string
  /** The books sub-directory that the API server uses inside userDataDir. */
  booksDir: string
  /** The main renderer Page (Studio SPA loaded via app:// protocol). */
  page: Page
  /** Base URL of the in-process API server, e.g. "http://127.0.0.1:51234". */
  apiUrl: string
}

export const test = base.extend<DesktopFixtures>({
  // ── Isolated data dir ────────────────────────────────────────────
  userDataDir: async ({}, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adt-e2e-'))
    await use(dir)
    // On Windows, Electron child processes (GPU, renderer) may briefly hold
    // file locks after the main process exits. Retry a few times before giving up.
    for (let i = 0; i < 5; i++) {
      try {
        fs.rmSync(dir, { recursive: true, force: true })
        break
      } catch (e: any) {
        if (e?.code === 'EPERM' && i < 4) {
          await new Promise((r) => setTimeout(r, 500))
        }
      }
    }
  },

  booksDir: async ({ userDataDir }, use) => {
    // paths.ts computes: booksDir = join(app.getPath('userData'), 'books')
    // Passing --user-data-dir makes app.getPath('userData') == userDataDir.
    const dir = path.join(userDataDir, 'books')
    fs.mkdirSync(dir, { recursive: true })
    await use(dir)
  },

  // ── Main window ──────────────────────────────────────────────────
  page: async ({ userDataDir }, use) => {
    if (!fs.existsSync(ELECTRON_MAIN)) {
      throw new Error(
        `Electron main not found at:\n  ${ELECTRON_MAIN}\nRun "pnpm build:desktop" before running e2e tests.`
      )
    }

    // Resolve the Electron executable path
    const electronExe: string = _require('electron/index.js')

    // Build the child env, explicitly removing ELECTRON_RUN_AS_NODE.
    // Claude Code (and some CI environments) set ELECTRON_RUN_AS_NODE=1 which
    // forces Electron to use node_init instead of browser_init, making
    // require('electron') return the npm path string rather than the real API.
    const childEnv: NodeJS.ProcessEnv = { ...process.env }
    delete childEnv.ELECTRON_RUN_AS_NODE

    // Spawn Electron as "electron ." from apps/desktop so that
    // app.getAppPath() returns apps/desktop (not out/main), which is what
    // resolvePaths() expects when computing the repo root via "../../".
    const DESKTOP_DIR = path.join(REPO_ROOT, 'apps/desktop')
    const proc: ChildProcess = spawn(electronExe, [
      '.',
      `--user-data-dir=${userDataDir}`,
    ], {
      cwd: DESKTOP_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...childEnv,
        NODE_ENV: 'test',
        ADT_ENVIRONMENT: 'electron',
        PLAYWRIGHT_TEST: '1',
        DISABLE_AUTO_UPDATE: 'true',
        // Prevents sandbox errors in headless Linux CI environments
        ELECTRON_DISABLE_SANDBOX: '1',
      },
    })

    // Chromium prints "DevTools listening on ws://IP:PORT/..." to stderr
    // once --remote-debugging-port is active.
    const stderrLines: string[] = []
    const wsUrl = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Timed out waiting for Electron DevTools URL (30 s)')),
        30_000
      )
      const rl = readline.createInterface({ input: proc.stderr! })
      rl.on('line', (line) => {
        stderrLines.push(line)
        const m = line.match(/DevTools listening on (ws:\/\/.*)/)
        if (m) {
          clearTimeout(timeout)
          resolve(m[1])
        }
      })
      proc.once('exit', (code) => {
        clearTimeout(timeout)
        reject(new Error(
          `Electron exited (code ${code ?? '?'}) before DevTools URL appeared.\nstderr:\n${stderrLines.join('\n')}`
        ))
      })
    })

    // Extract the HTTP port from the WebSocket URL so we can use connectOverCDP
    const portMatch = wsUrl.match(/:(\d+)\//)
    if (!portMatch) throw new Error(`Unexpected DevTools URL format: ${wsUrl}`)
    const cdpPort = parseInt(portMatch[1], 10)

    // Connect Playwright to the running Electron Chromium instance
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`)

    // Poll for the main renderer window (app://localhost/).
    // The splash window loads from a local file — we skip it by waiting
    // for a page whose URL starts with "app://" (the Studio SPA protocol).
    let page: Page | null = null
    const deadline = Date.now() + 90_000
    while (!page && Date.now() < deadline) {
      const pages = browser.contexts().flatMap((c) => c.pages())
      for (const p of pages) {
        if (p.url().startsWith('app://')) {
          page = p
          break
        }
      }
      if (!page) {
        await new Promise((r) => setTimeout(r, 150))
      }
    }
    if (!page) throw new Error('Timed out waiting for the main Electron window (app:// URL) (90 s)')

    await page.waitForLoadState('domcontentloaded')
    await use(page)

    // Close the browser CDP connection, then kill Electron and wait for it to
    // fully exit so that it releases file locks before the userDataDir cleanup.
    await browser.close()
    const exitPromise = new Promise<void>((resolve) => proc.once('exit', () => resolve()))
    proc.kill()
    await exitPromise
  },

  // ── API base URL ─────────────────────────────────────────────────
  apiUrl: async ({ page }, use) => {
    // The API port is communicated to the renderer via IPC (ipcRenderer.sendSync)
    // and exposed on window.api.apiPort by the preload script.
    const port = await page.evaluate<number>(() => (window as any).api.apiPort)
    await use(`http://127.0.0.1:${port}`)
  },
})

export { expect }

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Upload a PDF and create a book via the REST API.
 * Returns the book label assigned by the server.
 *
 * The `label` param must be a valid book slug (alphanumeric + hyphens).
 */
export async function createTestBook(
  apiUrl: string,
  pdfPath: string,
  label = 'e2e-test-book'
): Promise<string> {
  const body = new FormData()
  body.append('label', label)
  body.append('pdf', new Blob([fs.readFileSync(pdfPath)], { type: 'application/pdf' }), path.basename(pdfPath))

  const resp = await fetch(`${apiUrl}/api/books`, { method: 'POST', body })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`createTestBook failed (${resp.status}): ${text}`)
  }
  const data = await resp.json() as { label: string }
  return data.label
}

/** Absolute path to the raven.pdf fixture shipped with the repo. */
export const RAVEN_PDF = path.join(REPO_ROOT, 'tests/fixtures/raven.pdf')
