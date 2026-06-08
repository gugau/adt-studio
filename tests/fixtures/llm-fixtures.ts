/**
 * LLM mock fixtures for e2e tests.
 *
 * Strategy: the LLM client in @adt/llm implements file-based caching.
 * When a cache file `{hash}.json` exists in the configured cacheDir,
 * the client returns it without making a real API call.
 *
 * This module provides:
 *  1. `computeCacheHash` — mirrors packages/llm/src/cache.ts so tests can
 *     produce hashes that match what the real pipeline generates.
 *  2. `seedLlmCache` — writes fixture JSON files into a cache directory.
 *  3. Sample response objects that satisfy each step's Zod schema.
 *
 * GENERATING FIXTURES
 * -------------------
 * Run the pipeline once against raven.pdf with a real LLM key, then copy
 * the resulting cache files from `{booksDir}/{label}/llm-cache/` into
 * `tests/fixtures/llm-cache/`. Commit those files and use `seedLlmCache`
 * in tests to install them before launching the Electron app.
 *
 * MOCK SERVER ALTERNATIVE
 * -----------------------
 * For tests that need full pipeline runs without committed cache files,
 * use `startMockLlmServer` below. It launches an OpenAI-compatible HTTP
 * server that returns fixture responses. Pass the returned baseUrl as
 * CUSTOM_OPENAI_BASE_URL to the Electron process and configure the book
 * to use the `custom:` provider prefix.
 */

import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Hash computation (mirrors packages/llm/src/cache.ts) ────────────────────

interface HashInput {
  modelId: string
  mode?: string
  system?: string
  messages: unknown[]
  schema: unknown
  temperature?: number
}

function stableReplacer(key: string, value: unknown): unknown {
  if (key === '_cached') return undefined
  return value
}

export function computeCacheHash(input: HashInput): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(input, stableReplacer))
    .digest('hex')
}

// ── Cache seed helpers ───────────────────────────────────────────────────────

export interface LlmFixture {
  input: HashInput
  response: unknown
}

/** Write fixture files into `cacheDir` so the LLM client returns them as hits. */
export function seedLlmCache(cacheDir: string, fixtures: LlmFixture[]): void {
  fs.mkdirSync(cacheDir, { recursive: true })
  for (const { input, response } of fixtures) {
    const hash = computeCacheHash(input)
    fs.writeFileSync(
      path.join(cacheDir, `${hash}.json`),
      JSON.stringify(response, null, 2) + '\n'
    )
  }
}

/** Copy every *.json file from a pre-recorded cache directory into `destDir`. */
export function installCachedFixtures(srcDir: string, destDir: string): void {
  if (!fs.existsSync(srcDir)) return
  fs.mkdirSync(destDir, { recursive: true })
  for (const file of fs.readdirSync(srcDir)) {
    if (file.endsWith('.json')) {
      fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file))
    }
  }
}

// ── Pre-recorded cache directory (committed fixture files) ───────────────────
export const RECORDED_LLM_CACHE_DIR = path.join(__dirname, 'llm-cache')

// ── Sample response payloads ─────────────────────────────────────────────────
// These match the Zod schemas in packages/types/. Update them when schemas change.

export const MOCK_METADATA: unknown = {
  title: 'Raven — A Test Book',
  author: 'Edgar Allan Poe',
  subject: 'Poetry',
  language: 'en',
  pageCount: 10,
  publisher: null,
  year: null,
  isbn: null,
}

export const MOCK_BOOK_SUMMARY: unknown = {
  summary: 'A short test fixture representing a poetry collection.',
  keywords: ['poetry', 'test', 'raven'],
}

export const MOCK_IMAGE_FILTERING: unknown = {
  isContent: true,
  reason: 'The image is a content illustration relevant to the text.',
}

export const MOCK_IMAGE_MEANINGFULNESS: unknown = {
  meaningful: true,
  reason: 'The image conveys meaningful visual information.',
}

export const MOCK_PAGE_SECTIONS: unknown = {
  sections: [
    {
      id: 'sec-1',
      type: 'heading',
      level: 1,
      content: 'The Raven',
    },
    {
      id: 'sec-2',
      type: 'paragraph',
      content: 'Once upon a midnight dreary, while I pondered, weak and weary…',
    },
  ],
}

// ── Mock OpenAI-compatible HTTP server ───────────────────────────────────────

export interface MockLlmServer {
  baseUrl: string
  /** Override the next response body returned for any `/v1/chat/completions` call. */
  setNextResponse(body: unknown): void
  close(): Promise<void>
}

/**
 * Start a minimal OpenAI-compatible mock server.
 *
 * Usage in setup.ts:
 *
 *   const llm = await startMockLlmServer()
 *   // Launch Electron with CUSTOM_OPENAI_BASE_URL=llm.baseUrl
 *   // Configure the test book to use model "custom:mock-model"
 *   llm.setNextResponse(MOCK_METADATA)
 *   // ... run test ...
 *   await llm.close()
 */
export function startMockLlmServer(): Promise<MockLlmServer> {
  let nextResponseBody: unknown = { result: 'mock-ok' }

  const server = http.createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405)
      res.end()
      return
    }

    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => {
      // Return a minimal response that satisfies the Vercel AI SDK's generateObject parser.
      // The SDK expects a JSON-mode response with the object in the `content` field.
      const payload = {
        id: 'mock-' + Date.now(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'mock-model',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify(nextResponseBody),
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(payload))
    })
  })

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number }
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        setNextResponse(body) { nextResponseBody = body },
        close() {
          return new Promise<void>((res, rej) => server.close((err) => (err ? rej(err) : res())))
        },
      })
    })
    server.once('error', reject)
  })
}
