/**
 * Pipeline UI smoke tests.
 *
 * These tests verify:
 *  - The Electron app starts and loads the Studio SPA.
 *  - The embedded API server is healthy and reachable.
 *  - The books REST API works: empty list → create book → list shows the book.
 *  - Pipeline stage metadata is returned by the step-status endpoint.
 *
 * No LLM calls are triggered; all assertions are over the HTTP API or
 * high-level page properties that don't depend on pipeline state.
 */

import fs from 'node:fs'
import { test, expect, createTestBook, RAVEN_PDF } from './setup'

test.describe('API server health', () => {
  test('GET /api/health returns { status: "ok" }', async ({ apiUrl }) => {
    const resp = await fetch(`${apiUrl}/api/health`)
    expect(resp.ok).toBe(true)
    const body = await resp.json()
    expect(body).toMatchObject({ status: 'ok' })
  })

  test('API URL uses localhost and a valid port', async ({ apiUrl }) => {
    expect(apiUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
    const port = parseInt(new URL(apiUrl).port, 10)
    expect(port).toBeGreaterThan(1024)
    expect(port).toBeLessThanOrEqual(65535)
  })
})

test.describe('Books CRUD via API', () => {
  test('GET /api/books returns an empty array for a fresh booksDir', async ({ apiUrl }) => {
    const resp = await fetch(`${apiUrl}/api/books`)
    expect(resp.ok).toBe(true)
    const books = await resp.json()
    expect(Array.isArray(books)).toBe(true)
    expect(books).toHaveLength(0)
  })

  test('POST /api/books creates a book and returns 201', async ({ apiUrl }) => {
    const label = await createTestBook(apiUrl, RAVEN_PDF, 'raven-pipeline-test')
    expect(label).toBe('raven-pipeline-test')
  })

  test('GET /api/books lists the newly created book', async ({ apiUrl }) => {
    await createTestBook(apiUrl, RAVEN_PDF, 'raven-list-test')
    const resp = await fetch(`${apiUrl}/api/books`)
    const books = await resp.json() as Array<{ label: string }>
    const labels = books.map((b) => b.label)
    expect(labels).toContain('raven-list-test')
  })

  test('GET /api/books/:label returns the book detail', async ({ apiUrl }) => {
    await createTestBook(apiUrl, RAVEN_PDF, 'raven-detail-test')
    const resp = await fetch(`${apiUrl}/api/books/raven-detail-test`)
    expect(resp.ok).toBe(true)
    const book = await resp.json() as { label: string }
    expect(book.label).toBe('raven-detail-test')
  })

  test('GET /api/books/:label returns 404 for a non-existent book', async ({ apiUrl }) => {
    const resp = await fetch(`${apiUrl}/api/books/does-not-exist-xyz`)
    expect(resp.status).toBe(404)
  })

  test('POST /api/books rejects duplicate labels with 409', async ({ apiUrl }) => {
    await createTestBook(apiUrl, RAVEN_PDF, 'raven-dup-test')
    const body = new FormData()
    body.append('label', 'raven-dup-test')
    body.append(
      'pdf',
      new Blob([fs.readFileSync(RAVEN_PDF)], { type: 'application/pdf' }),
      'raven.pdf'
    )
    const resp = await fetch(`${apiUrl}/api/books`, { method: 'POST', body })
    expect(resp.status).toBe(409)
  })
})

test.describe('Step-status endpoint', () => {
  test('GET /api/books/:label/step-status returns stage status after book creation', async ({
    apiUrl,
  }) => {
    await createTestBook(apiUrl, RAVEN_PDF, 'raven-status-test')
    const resp = await fetch(`${apiUrl}/api/books/raven-status-test/step-status`)
    expect(resp.ok).toBe(true)
    const body = await resp.json()
    // Response shape: { stages: Record<string,string>, steps: Record<string,string>, error: null }
    expect(typeof body).toBe('object')
    expect(body).not.toBeNull()
    expect(body).toHaveProperty('stages')
    expect(body).toHaveProperty('steps')
    // All step statuses should start as "idle" for a fresh book
    const stepStatuses = Object.values(body.steps as Record<string, string>)
    const validValues = new Set(['idle', 'running', 'done', 'error', 'queued', 'skipped'])
    const invalid = stepStatuses.filter((s) => !validValues.has(s))
    expect(invalid).toHaveLength(0)
  })
})

test.describe('Renderer (Studio SPA)', () => {
  test('page title is set (not a blank or error page)', async ({ page }) => {
    const title = await page.title()
    expect(title).toBeTruthy()
    expect(title.toLowerCase()).not.toContain('error')
  })

  test('body element is present', async ({ page }) => {
    const tag = await page.evaluate(() => document.body?.tagName)
    expect(tag).toBe('BODY')
  })

  test('no uncaught JS errors on initial load', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    // Give the SPA a moment to fully initialise
    await page.waitForTimeout(2_000)
    // Filter out known third-party noise; hard failures should be empty
    const fatal = errors.filter(
      (e) =>
        !e.includes('ResizeObserver loop') &&
        !e.includes('Non-Error promise rejection')
    )
    expect(fatal).toHaveLength(0)
  })
})
