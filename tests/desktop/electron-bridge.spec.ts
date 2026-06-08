/**
 * Tests for the Electron IPC context bridge (window.api).
 *
 * These tests verify that the preload script correctly exposes all expected
 * channels to the renderer and that each channel returns the right type.
 * No LLM calls or pipeline execution required.
 */

import { test, expect } from './setup'

test.describe('Electron IPC bridge — window.api', () => {
  // ── Platform / version ─────────────────────────────────────────────────────

  test('api.platform is a valid NodeJS.Platform string', async ({ page }) => {
    const platform = await page.evaluate<string>(() => (window as any).api.platform)
    const valid: string[] = ['win32', 'darwin', 'linux', 'aix', 'freebsd', 'openbsd', 'sunos']
    expect(valid).toContain(platform)
  })

  test('api.version is a non-empty semver-like string', async ({ page }) => {
    const version = await page.evaluate<string>(() => (window as any).api.version)
    expect(typeof version).toBe('string')
    expect(version.length).toBeGreaterThan(0)
    // e.g. "0.7.0-rc.7" — major.minor is enough to satisfy the contract
    expect(version).toMatch(/^\d+\.\d+/)
  })

  test('api.apiPort is a valid TCP port number', async ({ page }) => {
    const port = await page.evaluate<number>(() => (window as any).api.apiPort)
    expect(typeof port).toBe('number')
    expect(Number.isInteger(port)).toBe(true)
    expect(port).toBeGreaterThan(0)
    expect(port).toBeLessThanOrEqual(65535)
  })

  // ── Debug mode ─────────────────────────────────────────────────────────────

  test('api.isApiDebugMode() resolves to a boolean', async ({ page }) => {
    const result = await page.evaluate<boolean>(() => (window as any).api.isApiDebugMode())
    expect(typeof result).toBe('boolean')
  })

  // ── Window controls ────────────────────────────────────────────────────────

  test('windowControls.isMaximized() resolves to a boolean', async ({ page }) => {
    const value = await page.evaluate<boolean>(
      () => (window as any).api.windowControls.isMaximized()
    )
    expect(typeof value).toBe('boolean')
  })

  test('windowControls.isFullscreen() resolves to a boolean', async ({ page }) => {
    const value = await page.evaluate<boolean>(
      () => (window as any).api.windowControls.isFullscreen()
    )
    expect(typeof value).toBe('boolean')
  })

  test('windowControls.minimize() resolves without throwing', async ({ page }) => {
    await expect(
      page.evaluate(() => (window as any).api.windowControls.minimize())
    ).resolves.not.toThrow()
  })

  test('windowControls.toggleMaximize() returns a boolean', async ({ page }) => {
    const isMax = await page.evaluate<boolean>(
      () => (window as any).api.windowControls.toggleMaximize()
    )
    expect(typeof isMax).toBe('boolean')
    // Restore original state
    await page.evaluate(() => (window as any).api.windowControls.toggleMaximize())
  })

  // ── Updates ────────────────────────────────────────────────────────────────

  test('updates.getStatus() resolves to an object', async ({ page }) => {
    const status = await page.evaluate<unknown>(
      () => (window as any).api.updates.getStatus()
    )
    expect(status !== null && typeof status === 'object').toBe(true)
  })

  // ── electron global ────────────────────────────────────────────────────────

  test('window.electron is injected by the preload script', async ({ page }) => {
    const exists = await page.evaluate<boolean>(
      () => typeof (window as any).electron !== 'undefined'
    )
    expect(exists).toBe(true)
  })

  test('window.electron.process.type is "renderer"', async ({ page }) => {
    const type = await page.evaluate<string>(
      () => (window as any).electron?.process?.type
    )
    expect(type).toBe('renderer')
  })

  // ── onApiLog subscription ──────────────────────────────────────────────────

  test('api.onApiLog() returns an unsubscribe function', async ({ page }) => {
    const typeofReturn = await page.evaluate<string>(() => {
      const unsub = (window as any).api.onApiLog(() => {})
      return typeof unsub
    })
    expect(typeofReturn).toBe('function')
  })

  // ── saveFile channel (smoke test — no dialog interaction) ─────────────────

  test('api.saveFile is a function', async ({ page }) => {
    const type = await page.evaluate<string>(
      () => typeof (window as any).api.saveFile
    )
    expect(type).toBe('function')
  })
})
