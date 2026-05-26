import fs from "node:fs"
import path from "node:path"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import {
  parseBookLabel,
  Quiz,
  QuizGenerationOutput,
  QuizOption,
  PageSectioningOutput,
  WebRenderingOutput,
} from "@adt/types"
import { openBookDb, createBookStorage } from "@adt/storage"
import { aiEditQuiz } from "../services/quiz-edit-service.js"
import { createActivity } from "../services/create-activity-service.js"

function safeParseLabel(label: string): string {
  try {
    return parseBookLabel(label)
  } catch (err) {
    throw new HTTPException(400, {
      message: err instanceof Error ? err.message : String(err),
    })
  }
}

const AddQuizRequest = z.object({
  afterPageId: z.string().min(1),
  pageIds: z.array(z.string()).default([]),
  quizType: z.literal("multiple-choice").default("multiple-choice"),
  question: z.string().min(1),
  options: z.array(QuizOption).length(3),
  answerIndex: z.number().int().min(0).max(2),
  reasoning: z.string().default(""),
})

const AiEditQuizRequest = z.object({
  instruction: z.string().min(1),
  currentQuiz: Quiz.optional(),
})

const CreateActivityRequest = z.object({
  contextPageIds: z.array(z.string().min(1)).min(1),
  sectionType: z.string().min(1),
  extraInstructions: z.string().optional(),
})

export function createQuizRoutes(
  booksDir: string,
  promptsDir?: string,
  configPath?: string,
  webAssetsDir?: string,
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

  // POST /books/:label/quizzes — Append a user-authored quiz at a chosen placement
  app.post("/books/:label/quizzes", async (c) => {
    const { label } = c.req.param()
    const safeLabel = safeParseLabel(label)

    const body = await c.req.json()
    const parsed = AddQuizRequest.safeParse(body)
    if (!parsed.success) {
      throw new HTTPException(400, {
        message: `Invalid quiz: ${parsed.error.message}`,
      })
    }
    const input = parsed.data

    const storage = createBookStorage(safeLabel, booksDir)
    try {
      const pages = storage.getPages()
      const pageOrder = new Map(pages.map((p, i) => [p.pageId, i]))
      if (!pageOrder.has(input.afterPageId)) {
        throw new HTTPException(400, {
          message: `Unknown afterPageId: ${input.afterPageId}`,
        })
      }

      const existingRow = storage.getLatestNodeData("quiz-generation", "book")
      let existing: QuizGenerationOutput
      if (existingRow) {
        const existingParsed = QuizGenerationOutput.safeParse(existingRow.data)
        if (!existingParsed.success) {
          throw new HTTPException(500, {
            message: "Stored quiz data is invalid",
          })
        }
        existing = existingParsed.data
      } else {
        existing = {
          generatedAt: new Date().toISOString(),
          language: "en",
          pagesPerQuiz: 3,
          quizzes: [],
        }
      }

      const pageIds = input.pageIds.length > 0 ? input.pageIds : [input.afterPageId]

      const newQuiz: Quiz = {
        quizIndex: 0,
        afterPageId: input.afterPageId,
        pageIds,
        question: input.question,
        options: input.options,
        answerIndex: input.answerIndex,
        reasoning: input.reasoning,
      }

      const merged = [...existing.quizzes, newQuiz]
      merged.sort((a, b) => {
        const ai = pageOrder.get(a.afterPageId) ?? Number.MAX_SAFE_INTEGER
        const bi = pageOrder.get(b.afterPageId) ?? Number.MAX_SAFE_INTEGER
        return ai - bi
      })
      const repacked = merged.map((q, i) => ({ ...q, quizIndex: i }))

      const insertedIndex = repacked.findIndex(
        (q) => q.afterPageId === newQuiz.afterPageId && q.question === newQuiz.question,
      )

      const updated: QuizGenerationOutput = {
        ...existing,
        quizzes: repacked,
      }

      const version = storage.putNodeData("quiz-generation", "book", updated)
      return c.json({ version, quizIndex: insertedIndex })
    } finally {
      storage.close()
    }
  })

  // POST /books/:label/quizzes/:quizIndex/ai-edit — Ask the LLM to revise a quiz
  app.post("/books/:label/quizzes/:quizIndex/ai-edit", async (c) => {
    const { label, quizIndex } = c.req.param()
    const safeLabel = safeParseLabel(label)
    const idx = parseInt(quizIndex, 10)
    if (Number.isNaN(idx) || idx < 0) {
      throw new HTTPException(400, { message: "Invalid quiz index" })
    }

    const apiKey = c.req.header("X-OpenAI-Key")
    if (!apiKey) {
      throw new HTTPException(400, { message: "Missing X-OpenAI-Key header" })
    }

    if (!promptsDir) {
      throw new HTTPException(500, {
        message: "Quiz AI editing is not configured on this server",
      })
    }

    const body = await c.req.json()
    const parsed = AiEditQuizRequest.safeParse(body)
    if (!parsed.success) {
      throw new HTTPException(400, {
        message: `Invalid request: ${parsed.error.message}`,
      })
    }

    const result = await aiEditQuiz({
      label: safeLabel,
      quizIndex: idx,
      instruction: parsed.data.instruction,
      currentQuiz: parsed.data.currentQuiz,
      booksDir,
      promptsDir,
      configPath,
      apiKey,
    })

    return c.json(result)
  })

  // POST /books/:label/activities — Create a new user-authored activity section.
  app.post("/books/:label/activities", async (c) => {
    const { label } = c.req.param()
    const safeLabel = safeParseLabel(label)

    const apiKey = c.req.header("X-OpenAI-Key")
    if (!apiKey) {
      throw new HTTPException(400, { message: "Missing X-OpenAI-Key header" })
    }
    if (!promptsDir) {
      throw new HTTPException(500, {
        message: "Activity creation is not configured on this server",
      })
    }

    const body = await c.req.json()
    const parsed = CreateActivityRequest.safeParse(body)
    if (!parsed.success) {
      throw new HTTPException(400, {
        message: `Invalid request: ${parsed.error.message}`,
      })
    }

    const result = await createActivity({
      label: safeLabel,
      contextPageIds: parsed.data.contextPageIds,
      sectionType: parsed.data.sectionType,
      extraInstructions: parsed.data.extraInstructions,
      booksDir,
      promptsDir,
      webAssetsDir,
      configPath,
      apiKey,
    })

    return c.json(result)
  })

  // GET /books/:label/activities — Unified list of quizzes + activity-typed sections
  app.get("/books/:label/activities", (c) => {
    const { label } = c.req.param()
    const safeLabel = safeParseLabel(label)
    const dbPath = path.join(
      path.resolve(booksDir),
      safeLabel,
      `${safeLabel}.db`,
    )

    if (!fs.existsSync(dbPath)) {
      throw new HTTPException(404, {
        message: `Book not found: ${safeLabel}`,
      })
    }

    const storage = createBookStorage(safeLabel, booksDir)
    try {
      const pages = storage.getPages()
      const pageOrder = new Map(pages.map((p, i) => [p.pageId, i]))

      type ActivityItem =
        | {
            kind: "quiz"
            quizIndex: number
            afterPageId: string
            pageIds: string[]
            order: number
            quiz: Quiz
          }
        | {
            kind: "section-activity"
            pageId: string
            pageNumber: number
            sectionIndex: number
            sectionType: string
            sectionId: string
            order: number
            html: string
            activityAnswers: Record<string, string | boolean | number>
            activityReasoning?: string
          }

      const items: ActivityItem[] = []

      const quizRow = storage.getLatestNodeData("quiz-generation", "book")
      let quizVersion: number | null = null
      if (quizRow) {
        quizVersion = quizRow.version
        const parsed = QuizGenerationOutput.safeParse(quizRow.data)
        if (parsed.success) {
          for (const quiz of parsed.data.quizzes) {
            const order = pageOrder.get(quiz.afterPageId) ?? Number.MAX_SAFE_INTEGER
            items.push({
              kind: "quiz",
              quizIndex: quiz.quizIndex,
              afterPageId: quiz.afterPageId,
              pageIds: quiz.pageIds,
              order: order * 1000 + 999,
              quiz,
            })
          }
        }
      }

      for (const page of pages) {
        const sectioningRow = storage.getLatestNodeData("page-sectioning", page.pageId)
        if (!sectioningRow) continue
        const sectioningParsed = PageSectioningOutput.safeParse(sectioningRow.data)
        if (!sectioningParsed.success) continue

        const renderingRow = storage.getLatestNodeData("web-rendering", page.pageId)
        const renderingParsed = renderingRow
          ? WebRenderingOutput.safeParse(renderingRow.data)
          : null
        const renderingByIndex = new Map(
          renderingParsed?.success
            ? renderingParsed.data.sections.map((s) => [s.sectionIndex, s])
            : [],
        )

        sectioningParsed.data.sections.forEach((section, sectionIndex) => {
          if (section.isPruned) return
          if (!section.sectionType.startsWith("activity_")) return
          const rendering = renderingByIndex.get(sectionIndex)
          if (!rendering) return
          const pageIdx = pageOrder.get(page.pageId) ?? Number.MAX_SAFE_INTEGER
          items.push({
            kind: "section-activity",
            pageId: page.pageId,
            pageNumber: page.pageNumber,
            sectionIndex,
            sectionType: section.sectionType,
            sectionId: section.sectionId,
            order: pageIdx * 1000 + sectionIndex,
            html: rendering.html,
            activityAnswers: rendering.activityAnswers ?? {},
            activityReasoning: rendering.activityReasoning,
          })
        })
      }

      items.sort((a, b) => a.order - b.order)

      return c.json({
        items: items.map(({ order: _order, ...rest }) => rest),
        quizVersion,
      })
    } finally {
      storage.close()
    }
  })

  return app
}
