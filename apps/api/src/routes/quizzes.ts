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
  TextbookActivityOverride,
  TextbookActivityOverrideInput,
  type ContentNodeData,
  type Quiz,
  type QuizQuestion,
  type TextbookActivity,
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
  if (/provider|model|api|schema|response_format|invalid request|bad request/i.test(redacted)) {
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

const TEXTBOOK_ACTIVITY_OVERRIDES_NODE = "textbook-activity-overrides"
const TEXTBOOK_ACTIVITY_OVERRIDES_ITEM = "book"
const TEXTBOOK_ACTIVITY_SECTION_TYPES = new Set([
  "activity_multiple_choice",
  "activity_matching",
  "activity_fill_in_a_table",
  "activity_true_false",
  "activity_open_ended_answer",
  "activity_fill_in_the_blank",
  "activity_sorting",
  "activity_other",
])

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

function loadStoredQuizGeneration(storage: ReturnType<typeof createBookStorage>): QuizGenerationOutput | null {
  const row = storage.getLatestNodeData("quiz-generation", "book")
  if (!row) return null
  const parsed = QuizGenerationOutput.safeParse(row.data)
  return parsed.success ? parsed.data : null
}

function applyOpenEndedResponseLimit(
  question: QuizQuestion,
  openEndedCharacterLimit: number | undefined
): QuizQuestion {
  if (question.activityType !== "open_ended" || question.responseCharacterLimit !== undefined) {
    return question
  }
  if (openEndedCharacterLimit === undefined) return question
  return {
    ...question,
    responseCharacterLimit: openEndedCharacterLimit,
  }
}

function buildTextbookOverrideQuiz(
  override: TextbookActivityOverride,
  quizIndex: number,
  options: { openEndedCharacterLimit?: number } = {}
): Quiz {
  const questions = override.questions.map((question) =>
    applyOpenEndedResponseLimit(question, options.openEndedCharacterLimit)
  )
  const firstQuestion = questions[0]
  return {
    ...firstQuestion,
    quizIndex,
    afterPageId: override.insertAfterPageId,
    pageIds: override.assignedPageIds,
    template: override.template,
    questions,
    sourceTextbookActivityId: override.id,
    isPruned: false,
  }
}

function saveTextbookOverrideQuizGeneration({
  storage,
  override,
  safeLabel,
  booksDir,
  configPath,
}: {
  storage: ReturnType<typeof createBookStorage>
  override: TextbookActivityOverride
  safeLabel: string
  booksDir: string
  configPath?: string
}): number | null {
  const pages = storage.getPages()
  const pageOrder = new Map(pages.map((page, index) => [page.pageId, index]))
  const existing = loadStoredQuizGeneration(storage)
  const config = loadBookConfig(safeLabel, booksDir, configPath)
  const metadataRow = storage.getLatestNodeData("metadata", "book")
  const metadata = metadataRow?.data as { language_code?: string | null } | null
  const configuredLanguage = config.editing_language ?? metadata?.language_code ?? existing?.language
  if (!configuredLanguage) {
    throw new HTTPException(400, {
      message: "Set editing language before saving textbook activity overrides.",
    })
  }
  const language = normalizeLocale(configuredLanguage)
  const quizConfig = buildQuizGenerationConfig(config, language)
  const selected = new Set(override.assignedPageIds)
  const withoutPreviousOverride = (existing?.quizzes ?? []).filter(
    (quiz) => quiz.sourceTextbookActivityId !== override.id
  )
  const retained = override.replaceExistingForPages
    ? withoutPreviousOverride.filter(
        (quiz) => !quiz.pageIds.some((pageId) => selected.has(pageId))
      )
    : withoutPreviousOverride

  const merged = override.hidden
    ? retained
    : sortQuizzesByBookOrder(
        [
          ...retained,
          buildTextbookOverrideQuiz(override, retained.length, {
            openEndedCharacterLimit: quizConfig?.openEndedCharacterLimit,
          }),
        ],
        pageOrder
      )

  const next = QuizGenerationOutput.parse({
    generatedAt: new Date().toISOString(),
    language,
    pagesPerQuiz: existing?.pagesPerQuiz ?? 1,
    quizzes: renumberQuizzes(merged),
  })
  return storage.putNodeData("quiz-generation", "book", next)
}

function removeTextbookOverrideQuizGeneration(
  storage: ReturnType<typeof createBookStorage>,
  overrideId: string
): number | null {
  const existing = loadStoredQuizGeneration(storage)
  if (!existing) return null
  const retained = existing.quizzes.filter((quiz) => quiz.sourceTextbookActivityId !== overrideId)
  const next = QuizGenerationOutput.parse({
    ...existing,
    generatedAt: new Date().toISOString(),
    quizzes: renumberQuizzes(retained),
  })
  return storage.putNodeData("quiz-generation", "book", next)
}

function isActivitySectionType(sectionType: string | undefined): boolean {
  return sectionType ? TEXTBOOK_ACTIVITY_SECTION_TYPES.has(sectionType) : false
}

function textbookActivityOverrideKey(pageId: string, sectionId: string): string {
  return `${pageId}_${sectionId}`
}

function loadTextbookActivityOverrides(
  storage: ReturnType<typeof createBookStorage>
): Record<string, TextbookActivityOverride> {
  const row = storage.getLatestNodeData(TEXTBOOK_ACTIVITY_OVERRIDES_NODE, TEXTBOOK_ACTIVITY_OVERRIDES_ITEM)
  if (!row) return {}
  const rawEntries = Array.isArray(row.data)
    ? row.data
    : Object.values(row.data as Record<string, unknown>)
  const overrides: Record<string, TextbookActivityOverride> = {}
  for (const rawEntry of rawEntries) {
    const parsed = TextbookActivityOverride.safeParse(rawEntry)
    if (!parsed.success) {
      const id = typeof rawEntry === "object" && rawEntry && "id" in rawEntry
        ? String((rawEntry as { id?: unknown }).id)
        : "<unknown>"
      console.warn(
        `Dropping invalid textbook activity override ${id}: ${parsed.error.message}`
      )
      continue
    }
    overrides[parsed.data.id] = parsed.data
  }
  return overrides
}

function saveTextbookActivityOverrides(
  storage: ReturnType<typeof createBookStorage>,
  overrides: Record<string, TextbookActivityOverride>
): number {
  return storage.putNodeData(
    TEXTBOOK_ACTIVITY_OVERRIDES_NODE,
    TEXTBOOK_ACTIVITY_OVERRIDES_ITEM,
    Object.values(overrides).sort((a, b) => a.id.localeCompare(b.id))
  )
}

function collectActivitySectionStats(nodes: ContentNodeData[]): {
  textPreview: string
  textBlockCount: number
  imageCount: number
} {
  const textParts: string[] = []
  let textBlockCount = 0
  let imageCount = 0

  const walk = (node: ContentNodeData): void => {
    if (node.isPruned) return
    if (node.role === "image") imageCount++
    if (typeof node.text === "string" && node.text.trim()) {
      textBlockCount++
      textParts.push(node.text.trim())
    }
    for (const child of node.children ?? []) walk(child)
  }

  for (const node of nodes) walk(node)

  const textPreview = textParts.join(" ").replace(/\s+/g, " ").trim().slice(0, 240)
  return { textPreview, textBlockCount, imageCount }
}

export function createQuizRoutes(
  booksDir: string,
  promptsDir = path.resolve(process.cwd(), "prompts"),
  configPath?: string
): Hono {
  const app = new Hono()

  // GET /books/:label/quizzes/textbook-activities - List activity sections detected in the book
  app.get("/books/:label/quizzes/textbook-activities", (c) => {
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

    const storage = createBookStorage(safeLabel, booksDir)
    try {
      const activities: TextbookActivity[] = []
      const overrides = loadTextbookActivityOverrides(storage)
      const matchedOverrideIds = new Set<string>()

      for (const page of storage.getPages()) {
        const sectioningRow = storage.getLatestNodeData("page-sectioning", page.pageId)
        if (!sectioningRow) continue

        const sectioning = PageSectioningOutput.safeParse(sectioningRow.data)
        if (!sectioning.success) continue

        const renderingRow = storage.getLatestNodeData("web-rendering", page.pageId)
        const rendering = renderingRow
          ? WebRenderingOutput.safeParse(renderingRow.data)
          : null
        const renderedSections = rendering?.success ? rendering.data.sections : []

        sectioning.data.sections.forEach((section, sectionIndex) => {
          if (section.isPruned) return

          const renderedSection = renderedSections.find((s) => s.sectionIndex === sectionIndex)
          const sectionType = isActivitySectionType(section.sectionType)
            ? section.sectionType
            : renderedSection?.sectionType ?? section.sectionType
          if (!isActivitySectionType(section.sectionType) && !isActivitySectionType(renderedSection?.sectionType)) {
            return
          }

          const stats = collectActivitySectionStats(section.nodes)
          const sectionId = section.sectionId || `${page.pageId}_sec${String(sectionIndex + 1).padStart(3, "0")}`
          const overrideId = textbookActivityOverrideKey(page.pageId, sectionId)
          const override = overrides[overrideId]
          if (override) matchedOverrideIds.add(override.id)
          activities.push({
            id: sectionId,
            pageId: page.pageId,
            pageNumber: page.pageNumber,
            sectionId,
            sectionIndex,
            sectionType,
            textPreview: stats.textPreview,
            textBlockCount: stats.textBlockCount,
            imageCount: stats.imageCount,
            answerCount: renderedSection?.activityAnswers ? Object.keys(renderedSection.activityAnswers).length : 0,
            hasRendering: Boolean(renderedSection),
            ...(override ? { override } : {}),
          })
        })
      }

      const orphanedOverrideIds = Object.keys(overrides).filter((id) => !matchedOverrideIds.has(id))
      if (orphanedOverrideIds.length > 0) {
        console.warn(
          `Found textbook activity overrides without matching sections: ${orphanedOverrideIds.join(", ")}`
        )
      }

      return c.json({
        activities,
        ...(orphanedOverrideIds.length > 0 ? { orphanedOverrideIds } : {}),
      })
    } finally {
      storage.close()
    }
  })

  // PUT /books/:label/quizzes/textbook-activities/:activityId/override
  // Store a non-destructive customization for a detected textbook activity.
  app.put("/books/:label/quizzes/textbook-activities/:activityId/override", async (c) => {
    const { label, activityId } = c.req.param()
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

    const body = await c.req.json().catch(() => null)
    const parsed = TextbookActivityOverrideInput.safeParse(body)
    if (!parsed.success) {
      throw new HTTPException(400, {
        message: parsed.error.issues.map((issue) => issue.message).join("; "),
      })
    }

    const expectedId = textbookActivityOverrideKey(parsed.data.sourcePageId, parsed.data.sourceSectionId)
    if (expectedId !== activityId) {
      throw new HTTPException(400, {
        message: `Override id mismatch: expected ${expectedId}`,
      })
    }

    const storage = createBookStorage(safeLabel, booksDir)
    try {
      const knownPageIds = new Set(storage.getPages().map((page) => page.pageId))
      const invalidPageIds = [
        ...parsed.data.assignedPageIds,
        parsed.data.insertAfterPageId,
      ].filter((pageId) => !knownPageIds.has(pageId))
      if (invalidPageIds.length > 0) {
        throw new HTTPException(400, {
          message: `Unknown page id(s): ${Array.from(new Set(invalidPageIds)).join(", ")}`,
        })
      }
      const overrides = loadTextbookActivityOverrides(storage)
      const override: TextbookActivityOverride = {
        ...parsed.data,
        id: activityId,
        updatedAt: new Date().toISOString(),
      }
      overrides[activityId] = override
      const version = saveTextbookActivityOverrides(storage, overrides)
      saveTextbookOverrideQuizGeneration({ storage, override, safeLabel, booksDir, configPath })
      return c.json({ override, version })
    } finally {
      storage.close()
    }
  })

  // DELETE /books/:label/quizzes/textbook-activities/:activityId/override
  app.delete("/books/:label/quizzes/textbook-activities/:activityId/override", (c) => {
    const { label, activityId } = c.req.param()
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

    const storage = createBookStorage(safeLabel, booksDir)
    try {
      const overrides = loadTextbookActivityOverrides(storage)
      delete overrides[activityId]
      const version = saveTextbookActivityOverrides(storage, overrides)
      removeTextbookOverrideQuizGeneration(storage, activityId)
      return c.json({ override: null, version })
    } finally {
      storage.close()
    }
  })

  // GET /books/:label/quizzes - Get latest quizzes
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

  // PUT /books/:label/quizzes - Update quizzes
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

  // POST /books/:label/quizzes/generate - Generate one selected quiz activity
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
      const insertAfterPageId = parsed.data.insertAfterPageId?.trim()
      if (insertAfterPageId && !pageOrder.has(insertAfterPageId)) {
        throw new HTTPException(400, {
          message: "Insert-after page was not found",
        })
      }
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
          afterPageId: insertAfterPageId || quizPages[quizPages.length - 1].pageId,
        },
        0,
        quizConfig,
        llmModel,
        {
          activityType: parsed.data.activityType,
          questionsPerQuiz: parsed.data.questionsPerQuiz ?? 1,
          template: parsed.data.template,
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
