import fs from "node:fs"
import path from "node:path"
import { Hono } from "hono"
import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import {
  parseBookLabel,
  QuizGenerationOutput,
  QuizGenerationRequest,
  PageSectioningOutput,
  WebRenderingOutput,
  type Quiz,
} from "@adt/types"
import { openBookDb, createBookStorage } from "@adt/storage"
import { createLLMModel, createPromptEngine, createRateLimiter, type LlmLogEntry } from "@adt/llm"
import {
  buildQuizGenerationConfig,
  generateQuizForSelection,
  isContentPage,
  loadBookConfig,
  normalizeLocale,
  type QuizPageInput,
} from "@adt/pipeline"

function safeParseLabel(label: string): string {
  try {
    return parseBookLabel(label)
  } catch (err) {
    throw new HTTPException(400, {
      message: err instanceof Error ? err.message : String(err),
    })
  }
}

function sanitizeProviderError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  const redacted = message
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/AIza[0-9A-Za-z_-]+/g, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
  if (/unauthorized|invalid api key|incorrect api key|authentication|401/i.test(redacted)) {
    return "Provider authentication failed. Check the configured API key."
  }
  if (/rate limit|too many requests|quota|429/i.test(redacted)) {
    return "Provider rate limit or quota was reached. Try again later or use a different provider key."
  }
  if (/provider|model|api/i.test(redacted)) {
    return redacted
  }
  return "Quiz generation failed while calling the provider."
}

function buildProviderCredentials(c: Context) {
  return {
    openaiApiKey: c.req.header("X-OpenAI-Key") || undefined,
    anthropicApiKey: c.req.header("X-Anthropic-API-Key") || undefined,
    googleApiKey: c.req.header("X-Google-API-Key") || undefined,
    customBaseUrl: c.req.header("X-Custom-Base-URL") || undefined,
    customApiKey: c.req.header("X-Custom-API-Key") || undefined,
  }
}

const REQUIRED_ACTIVITY_PROMPT_TOKENS = [
  "activity_type",
  "activity_type_label",
  "question_number",
  "questions_per_quiz",
]

function quizPromptRoots(bookPromptsDir: string, promptsDir: string): string[] {
  const bookPromptPath = path.join(bookPromptsDir, "quiz_generation.liquid")
  if (!fs.existsSync(bookPromptPath)) return [bookPromptsDir, promptsDir]

  const content = fs.readFileSync(bookPromptPath, "utf-8")
  const supportsActivityTypes = REQUIRED_ACTIVITY_PROMPT_TOKENS.every((token) =>
    content.includes(token)
  )
  return supportsActivityTypes ? [bookPromptsDir, promptsDir] : [promptsDir, bookPromptsDir]
}

function renumberQuizzes(quizzes: Quiz[]): Quiz[] {
  return quizzes.map((quiz, index) => ({ ...quiz, quizIndex: index }))
}

function sortQuizzesByBookOrder(quizzes: Quiz[], pageOrder: Map<string, number>): Quiz[] {
  return quizzes.slice().sort((a, b) => {
    const aOrder = pageOrder.get(a.afterPageId) ?? Number.MAX_SAFE_INTEGER
    const bOrder = pageOrder.get(b.afterPageId) ?? Number.MAX_SAFE_INTEGER
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.quizIndex - b.quizIndex
  })
}

export function createQuizRoutes(
  booksDir: string,
  promptsDir = path.resolve(process.cwd(), "prompts"),
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

  // POST /books/:label/quizzes/generate — Generate one selected quiz activity
  app.post("/books/:label/quizzes/generate", async (c) => {
    const { label } = c.req.param()
    const safeLabel = safeParseLabel(label)
    const apiKey = c.req.header("X-OpenAI-Key")
    if (!apiKey) {
      throw new HTTPException(400, { message: "Missing X-OpenAI-Key header" })
    }

    const body = await c.req.json()
    const parsed = QuizGenerationRequest.safeParse(body)
    if (!parsed.success) {
      throw new HTTPException(400, {
        message: `Invalid quiz generation request: ${parsed.error.message}`,
      })
    }

    const storage = createBookStorage(safeLabel, booksDir)
    try {
      const config = loadBookConfig(safeLabel, booksDir, configPath)
      const metadataRow = storage.getLatestNodeData("metadata", "book")
      const metadata = metadataRow?.data as { language_code?: string | null } | null
      const language = normalizeLocale(config.editing_language ?? metadata?.language_code ?? "en")
      const quizConfig = buildQuizGenerationConfig(config, language)
      if (!quizConfig) {
        throw new HTTPException(400, { message: "Quiz generation is not configured for this book" })
      }

      const pageOrder = new Map(storage.getPages().map((page, index) => [page.pageId, index]))
      const requestedIds = parsed.data.pageIds
      const quizPages: QuizPageInput[] = []
      for (const pageId of requestedIds) {
        const renderingRow = storage.getLatestNodeData("web-rendering", pageId)
        const sectioningRow = storage.getLatestNodeData("page-sectioning", pageId)
        if (!renderingRow || !sectioningRow) continue

        const rendering = WebRenderingOutput.safeParse(renderingRow.data)
        const sectioning = PageSectioningOutput.safeParse(sectioningRow.data)
        if (!rendering.success || !sectioning.success) continue
        if (!isContentPage(sectioning.data, quizConfig.quizSectionTypes)) continue

        quizPages.push({
          pageId,
          rendering: rendering.data,
          sectioning: sectioning.data,
        })
      }

      if (quizPages.length === 0) {
        throw new HTTPException(400, {
          message: "No selected pages have usable quiz source content",
        })
      }

      const cacheDir = path.join(path.resolve(booksDir), safeLabel, ".cache")
      const bookPromptsDir = path.join(path.resolve(booksDir), safeLabel, "prompts")
      const promptEngine = createPromptEngine(quizPromptRoots(bookPromptsDir, promptsDir))
      const rateLimiter = config.rate_limit
        ? createRateLimiter(config.rate_limit.requests_per_minute)
        : undefined
      const llmModel = createLLMModel({
        modelId: quizConfig.modelId,
        cacheDir,
        promptEngine,
        rateLimiter,
        credentials: buildProviderCredentials(c),
        onLog: (entry: LlmLogEntry) => storage.appendLlmLog(entry),
      })

      const generatedQuiz = await generateQuizForSelection(
        {
          pages: quizPages,
          afterPageId: quizPages[quizPages.length - 1].pageId,
        },
        0,
        quizConfig,
        llmModel,
        {
          activityType: parsed.data.activityType,
          questionsPerQuiz: parsed.data.questionsPerQuiz ?? 1,
        }
      )

      const existingRow = storage.getLatestNodeData("quiz-generation", "book")
      const existing = existingRow
        ? QuizGenerationOutput.safeParse(existingRow.data).success
          ? QuizGenerationOutput.parse(existingRow.data)
          : null
        : null
      const selected = new Set(requestedIds)
      const existingQuizzes = existing?.quizzes ?? []

      const merged = parsed.data.replaceExistingForPages
        ? sortQuizzesByBookOrder(
            [
              ...existingQuizzes.filter(
                (quiz) => !quiz.pageIds.some((pageId) => selected.has(pageId))
              ),
              generatedQuiz,
            ],
            pageOrder
          )
        : [...existingQuizzes, generatedQuiz]

      const next = QuizGenerationOutput.parse({
        generatedAt: new Date().toISOString(),
        language,
        pagesPerQuiz: existing?.pagesPerQuiz ?? quizConfig.pagesPerQuiz,
        quizzes: renumberQuizzes(merged),
      })
      const version = storage.putNodeData("quiz-generation", "book", next)
      return c.json({ quizzes: next, version })
    } catch (err) {
      if (err instanceof HTTPException) throw err
      throw new HTTPException(500, {
        message: `Quiz generation failed: ${sanitizeProviderError(err)}`,
      })
    } finally {
      storage.close()
    }
  })

  return app
}
