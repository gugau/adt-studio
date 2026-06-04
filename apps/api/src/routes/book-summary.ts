import path from "node:path"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { parseBookLabel } from "@adt/types"
import type { BookMetadata } from "@adt/types"
import { createBookStorage } from "@adt/storage"
import {
  buildBookSummaryConfig,
  generateBookSummary,
  loadBookConfig,
  normalizeLocale,
} from "@adt/pipeline"
import { createLLMModel, createPromptEngine, createRateLimiter } from "@adt/llm"

export function createBookSummaryRoutes(
  booksDir: string,
  promptsDir: string,
  configPath?: string,
): Hono {
  const app = new Hono()

  // POST /books/:label/book-summary/regenerate — Re-run only the book summary
  // in the current book language, without touching PDF extraction or metadata.
  // Used after the Extract metadata language is corrected so the summary tracks
  // the new language without a full Extract re-run.
  app.post("/books/:label/book-summary/regenerate", async (c) => {
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
      const language = normalizeLocale(
        config.editing_language ?? metadata?.language_code ?? "en",
      )
      const summaryConfig = buildBookSummaryConfig(config, language)

      const summaryPages = storage
        .getPages()
        .map((page) => ({ pageNumber: page.pageNumber, text: page.text }))
      if (summaryPages.length === 0) {
        throw new HTTPException(400, {
          message: "No extracted pages to summarize.",
        })
      }

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
          modelId: summaryConfig.modelId,
          cacheDir,
          promptEngine,
          rateLimiter,
          onLog: (entry) => storage.appendLlmLog(entry),
        })
        const result = await generateBookSummary(summaryPages, summaryConfig, model)
        const version = storage.putNodeData("book-summary", "book", result)
        // Keep the Extract stage complete — this is a targeted refresh.
        storage.markStepCompleted("book-summary")
        return c.json({ ...result, version })
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
