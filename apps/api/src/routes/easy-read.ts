import fs from "node:fs"
import path from "node:path"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { EasyReadOutput, parseBookLabel } from "@adt/types"
import type { BookMetadata, EasyReadOutput as EasyReadOutputType } from "@adt/types"
import { createBookStorage } from "@adt/storage"
import {
  buildEasyReadConfig,
  buildEasyReadSourceBlocks,
  generateEasyRead,
  loadBookConfig,
  normalizeLocale,
} from "@adt/pipeline"
import { createLLMModel, createPromptEngine, createRateLimiter } from "@adt/llm"

function getDbPath(label: string, booksDir: string): string {
  const safeLabel = parseBookLabel(label)
  return path.join(path.resolve(booksDir), safeLabel, `${safeLabel}.db`)
}

function readLanguage(
  metadata: BookMetadata | null,
  config: ReturnType<typeof loadBookConfig>,
): string {
  return normalizeLocale(config.editing_language ?? metadata?.language_code ?? "en")
}

function clearEasyReadDependents(storage: ReturnType<typeof createBookStorage>): void {
  storage.clearNodesByType([
    "text-catalog-translation",
    "tts",
    "tts-timestamps",
    "accessibility-assessment",
  ])
  storage.clearStepRuns([
    "catalog-translation",
    "image-translation",
    "tts",
    "word-timestamps",
    "package-web",
    "accessibility-assessment",
  ])
}

export function createEasyReadRoutes(
  booksDir: string,
  promptsDir: string,
  configPath?: string,
): Hono {
  const app = new Hono()

  app.get("/books/:label/easy-read", (c) => {
    const { label } = c.req.param()
    const safeLabel = parseBookLabel(label)
    const dbPath = getDbPath(safeLabel, booksDir)
    if (!fs.existsSync(dbPath)) {
      throw new HTTPException(404, { message: `Book not found: ${safeLabel}` })
    }

    const storage = createBookStorage(safeLabel, booksDir)
    try {
      const row = storage.getLatestNodeData("easy-read", "book")
      if (!row) return c.json(null)
      const parsed = EasyReadOutput.safeParse(row.data)
      if (!parsed.success) {
        throw new HTTPException(500, {
          message: `Stored Easy Read data is invalid: ${parsed.error.message}`,
        })
      }
      return c.json({ ...parsed.data, version: row.version })
    } finally {
      storage.close()
    }
  })

  app.put("/books/:label/easy-read", async (c) => {
    const { label } = c.req.param()
    const safeLabel = parseBookLabel(label)
    const body = await c.req.json()
    const parsed = EasyReadOutput.safeParse(body)
    if (!parsed.success) {
      throw new HTTPException(400, {
        message: `Invalid Easy Read data: ${parsed.error.message}`,
      })
    }

    const storage = createBookStorage(safeLabel, booksDir)
    try {
      const version = storage.putNodeData("easy-read", "book", parsed.data)
      clearEasyReadDependents(storage)
      return c.json({ version })
    } finally {
      storage.close()
    }
  })

  app.post("/books/:label/easy-read/regenerate", async (c) => {
    const { label } = c.req.param()
    const safeLabel = parseBookLabel(label)
    const apiKey = c.req.header("X-OpenAI-Key")
    if (!apiKey) {
      throw new HTTPException(400, {
        message: "API key required. Set X-OpenAI-Key header.",
      })
    }

    const storage = createBookStorage(safeLabel, booksDir)
    try {
      const config = loadBookConfig(safeLabel, booksDir, configPath)
      const metadataRow = storage.getLatestNodeData("metadata", "book")
      const metadata = metadataRow?.data as BookMetadata | null
      const language = readLanguage(metadata, config)
      const easyReadConfig = buildEasyReadConfig(config, language)
      if (!easyReadConfig.enabled) {
        throw new HTTPException(400, { message: "Easy Read is disabled in config" })
      }

      const pages = storage.getPages()
      const blocks = buildEasyReadSourceBlocks(storage, pages)
      const cacheDir = path.join(path.resolve(booksDir), safeLabel, ".cache")
      const bookPromptsDir = path.join(path.resolve(booksDir), safeLabel, "prompts")
      const promptEngine = createPromptEngine([bookPromptsDir, promptsDir])
      const rateLimiter = config.rate_limit
        ? createRateLimiter(config.rate_limit.requests_per_minute)
        : undefined
      const previousKey = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = apiKey
      try {
        const model = createLLMModel({
          modelId: easyReadConfig.modelId,
          cacheDir,
          promptEngine,
          rateLimiter,
          onLog: (entry) => storage.appendLlmLog(entry),
        })
        const output: EasyReadOutputType = await generateEasyRead(blocks, easyReadConfig, model)
        const version = storage.putNodeData("easy-read", "book", output)
        clearEasyReadDependents(storage)
        return c.json({ ...output, version })
      } finally {
        if (previousKey !== undefined) {
          process.env.OPENAI_API_KEY = previousKey
        } else {
          delete process.env.OPENAI_API_KEY
        }
      }
    } finally {
      storage.close()
    }
  })

  return app
}
