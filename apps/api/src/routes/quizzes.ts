import fs from "node:fs"
import path from "node:path"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import {
  parseBookLabel,
  QuizGenerationOutput,
  type Quiz,
  type WebRenderingOutput,
  type PageSectioningOutput,
} from "@adt/types"
import { openBookDb, createBookStorage } from "@adt/storage"
import {
  buildQuizGenerationConfig,
  generateQuiz,
  loadBookConfig,
  normalizeLocale,
  type QuizPageInput,
} from "@adt/pipeline"
import { createLLMModel, createPromptEngine } from "@adt/llm"

function safeParseLabel(label: string): string {
  try {
    return parseBookLabel(label)
  } catch (err) {
    throw new HTTPException(400, {
      message: err instanceof Error ? err.message : String(err),
    })
  }
}

export function createQuizRoutes(
  booksDir: string,
  promptsDir?: string,
  configPath?: string
): Hono {
  const app = new Hono()

  // GET /books/:label/quizzes — Get latest quizzes
  app.get("/books/:label/quizzes", (c) => {
    const { label } = c.req.param()
    const safeLabel = safeParseLabel(label)
    const dbPath = path.join(
      path.resolve(booksDir),
      safeLabel,
      `${safeLabel}.db`
    )

    if (!fs.existsSync(dbPath)) {
      throw new HTTPException(404, {
        message: `Book not found: ${safeLabel}`,
      })
    }

    const db = openBookDb(dbPath)
    try {
      const rows = db.all(
        "SELECT version, data FROM node_data WHERE node = ? AND item_id = ? ORDER BY version DESC LIMIT 1",
        ["quiz-generation", "book"]
      ) as Array<{ version: number; data: string }>

      if (rows.length === 0) {
        return c.json({ quizzes: null, version: null })
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(rows[0].data)
      } catch {
        throw new HTTPException(500, {
          message: `Stored quiz data is corrupted for book: ${safeLabel}`,
        })
      }

      const validated = QuizGenerationOutput.safeParse(parsed)
      if (!validated.success) {
        throw new HTTPException(500, {
          message: `Stored quiz data is invalid for book: ${safeLabel}`,
        })
      }

      return c.json({
        quizzes: validated.data,
        version: rows[0].version,
      })
    } finally {
      db.close()
    }
  })

  // PUT /books/:label/quizzes — Update quizzes
  app.put("/books/:label/quizzes", async (c) => {
    const { label } = c.req.param()
    const safeLabel = safeParseLabel(label)

    const body = await c.req.json()
    const parsed = QuizGenerationOutput.safeParse(body)
    if (!parsed.success) {
      throw new HTTPException(400, {
        message: `Invalid quiz data: ${parsed.error.message}`,
      })
    }

    const storage = createBookStorage(safeLabel, booksDir)
    try {
      const version = storage.putNodeData("quiz-generation", "book", parsed.data)
      return c.json({ version })
    } finally {
      storage.close()
    }
  })

  // POST /books/:label/quizzes/generate-one — Generate a single quiz from
  // a hand-picked set of pages and insert it at a chosen location.
  const GenerateOneBody = z.object({
    pageIds: z.array(z.string().min(1)).min(1).max(5),
    afterPageId: z.string().min(1),
  })

  app.post("/books/:label/quizzes/generate-one", async (c) => {
    if (!promptsDir) {
      throw new HTTPException(500, {
        message: "Server misconfigured: promptsDir not provided to quiz routes",
      })
    }

    const { label } = c.req.param()
    const safeLabel = safeParseLabel(label)

    const apiKey = c.req.header("X-OpenAI-Key")
    if (!apiKey) {
      throw new HTTPException(400, { message: "Missing X-OpenAI-Key header" })
    }
    const credentials = {
      openaiApiKey: apiKey,
      anthropicApiKey: c.req.header("X-Anthropic-API-Key") || undefined,
      googleApiKey: c.req.header("X-Google-API-Key") || undefined,
      customBaseUrl: c.req.header("X-Custom-Base-URL") || undefined,
      customApiKey: c.req.header("X-Custom-API-Key") || undefined,
    }

    const body = await c.req.json()
    const parsed = GenerateOneBody.safeParse(body)
    if (!parsed.success) {
      throw new HTTPException(400, {
        message: `Invalid body: ${parsed.error.message}`,
      })
    }
    const { pageIds, afterPageId } = parsed.data

    const storage = createBookStorage(safeLabel, booksDir)
    try {
      const appConfig = loadBookConfig(safeLabel, booksDir, configPath)
      const metadataRow = storage.getLatestNodeData("metadata", "book")
      const metadata = metadataRow?.data as { language_code?: string | null } | null
      const language = normalizeLocale(
        appConfig.editing_language ?? metadata?.language_code ?? "en"
      )

      const quizConfig = buildQuizGenerationConfig(appConfig, language)
      if (!quizConfig) {
        throw new HTTPException(400, {
          message: "Quiz generation is not available: no editing language is set.",
        })
      }

      // Map every page to its number so we can order pages within the quiz
      // batch and place the resulting quiz at the right spot in the book.
      const pageNumberById = new Map<string, number>()
      for (const page of storage.getPages()) {
        pageNumberById.set(page.pageId, page.pageNumber)
      }

      // Gather rendering + sectioning for the selected pages, in reading order.
      const orderedPageIds = [...new Set(pageIds)].sort(
        (a, b) => (pageNumberById.get(a) ?? 0) - (pageNumberById.get(b) ?? 0)
      )
      const batch: QuizPageInput[] = []
      for (const pageId of orderedPageIds) {
        const renderingRow = storage.getLatestNodeData("web-rendering", pageId)
        const sectioningRow = storage.getLatestNodeData("page-sectioning", pageId)
        if (!renderingRow || !sectioningRow) continue
        batch.push({
          pageId,
          rendering: renderingRow.data as WebRenderingOutput,
          sectioning: sectioningRow.data as PageSectioningOutput,
        })
      }

      if (batch.length === 0) {
        throw new HTTPException(400, {
          message:
            "None of the selected pages have rendering data. Run Storyboard first.",
        })
      }

      const cacheDir = path.join(path.resolve(booksDir), safeLabel, ".cache")
      const bookPromptsDir = path.join(path.resolve(booksDir), safeLabel, "prompts")
      const promptEngine = createPromptEngine([bookPromptsDir, promptsDir])
      const llmModel = createLLMModel({
        modelId: quizConfig.modelId,
        cacheDir,
        promptEngine,
        onLog: (entry) => storage.appendLlmLog(entry),
        credentials,
      })

      const generated = await generateQuiz(batch, 0, quizConfig, llmModel)
      // The user chooses where the quiz lands, independent of its source pages.
      const newQuiz: Quiz = { ...generated, afterPageId }

      // Append to the existing quiz set (or start a fresh one), then re-order by
      // book position and renumber so quizIndex stays sequential.
      const existingRow = storage.getLatestNodeData("quiz-generation", "book")
      const existing = existingRow
        ? (existingRow.data as QuizGenerationOutput)
        : null

      const quizzes = [...(existing?.quizzes ?? []), newQuiz]
      quizzes.sort(
        (a, b) =>
          (pageNumberById.get(a.afterPageId) ?? 0) -
          (pageNumberById.get(b.afterPageId) ?? 0)
      )
      quizzes.forEach((q, i) => {
        q.quizIndex = i
      })

      const output: QuizGenerationOutput = {
        generatedAt: existing?.generatedAt ?? new Date().toISOString(),
        language: existing?.language ?? quizConfig.language,
        pagesPerQuiz: existing?.pagesPerQuiz ?? quizConfig.pagesPerQuiz,
        quizzes,
      }

      const version = storage.putNodeData("quiz-generation", "book", output)
      return c.json({ quiz: newQuiz, version })
    } finally {
      storage.close()
    }
  })

  return app
}
