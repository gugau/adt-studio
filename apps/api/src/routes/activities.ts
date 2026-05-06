import fs from "node:fs"
import path from "node:path"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import {
  ActivitiesOutput,
  ActivityTemplateType,
  parseBookLabel,
  readActivitiesFromNode,
  type Activity,
} from "@adt/types"
import { openBookDb, createBookStorage } from "@adt/storage"
import type { TaskService } from "../services/task-service.js"
import { generateActivitiesForPages } from "../services/activity-generation.js"

function safeParseLabel(label: string): string {
  try {
    return parseBookLabel(label)
  } catch (err) {
    throw new HTTPException(400, {
      message: err instanceof Error ? err.message : String(err),
    })
  }
}

function nextActivityId(existing: Activity[]): string {
  let max = 0
  for (const a of existing) {
    const m = /^act(\d+)$/.exec(a.activityId)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `act${String(max + 1).padStart(3, "0")}`
}

function blankActivity(
  templateType: "multiple_choice" | "true_false" | "fill_in_the_blank",
  activityId: string,
  afterPageId: string,
): Activity {
  const common = {
    activityId,
    afterPageId,
    pageIds: [] as string[],
    generatedAt: new Date().toISOString(),
  }
  switch (templateType) {
    case "multiple_choice":
      return {
        ...common,
        templateType: "multiple_choice",
        question: "",
        options: [
          { text: "", explanation: "" },
          { text: "", explanation: "" },
          { text: "", explanation: "" },
        ],
        answerIndex: 0,
        reasoning: "",
      }
    case "true_false":
      return {
        ...common,
        templateType: "true_false",
        prompt: "",
        statements: [{ text: "", isTrue: true, explanation: "" }],
      }
    case "fill_in_the_blank":
      return {
        ...common,
        templateType: "fill_in_the_blank",
        prompt: "",
        sentences: [{ text: "", hint: "" }],
      }
  }
}

export interface CreateActivityRoutesOptions {
  booksDir: string
  promptsDir: string
  configPath?: string
  taskService?: TaskService
}

export function createActivityRoutes(opts: CreateActivityRoutesOptions): Hono {
  const { booksDir, promptsDir, configPath, taskService } = opts
  const app = new Hono()

  // GET /books/:label/activities — Latest activities (transparently upgrades legacy quiz data).
  app.get("/books/:label/activities", (c) => {
    const { label } = c.req.param()
    const safeLabel = safeParseLabel(label)
    const dbPath = path.join(path.resolve(booksDir), safeLabel, `${safeLabel}.db`)
    if (!fs.existsSync(dbPath)) {
      throw new HTTPException(404, { message: `Book not found: ${safeLabel}` })
    }

    const db = openBookDb(dbPath)
    try {
      const rows = db.all(
        "SELECT version, data FROM node_data WHERE node = ? AND item_id = ? ORDER BY version DESC LIMIT 1",
        ["quiz-generation", "book"],
      ) as Array<{ version: number; data: string }>

      if (rows.length === 0) {
        return c.json({ activities: null, version: null })
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(rows[0].data)
      } catch {
        throw new HTTPException(500, {
          message: `Stored activity data is corrupted for book: ${safeLabel}`,
        })
      }

      const upgraded = readActivitiesFromNode(parsed)
      if (!upgraded) {
        throw new HTTPException(500, {
          message: `Stored activity data is invalid for book: ${safeLabel}`,
        })
      }

      return c.json({ activities: upgraded, version: rows[0].version })
    } finally {
      db.close()
    }
  })

  // PUT /books/:label/activities — Save full edited activity list.
  app.put("/books/:label/activities", async (c) => {
    const { label } = c.req.param()
    const safeLabel = safeParseLabel(label)

    const body = await c.req.json()
    const parsed = ActivitiesOutput.safeParse(body)
    if (!parsed.success) {
      throw new HTTPException(400, {
        message: `Invalid activity data: ${parsed.error.message}`,
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

  // POST /books/:label/activities/new — Append a blank activity at afterPageId.
  app.post("/books/:label/activities/new", async (c) => {
    const { label } = c.req.param()
    const safeLabel = safeParseLabel(label)
    const body = await c.req.json()

    const templateParse = ActivityTemplateType.safeParse(body?.templateType)
    if (!templateParse.success) {
      throw new HTTPException(400, { message: "Invalid templateType" })
    }
    const afterPageId = typeof body?.afterPageId === "string" ? body.afterPageId : ""
    if (!afterPageId) {
      throw new HTTPException(400, { message: "Missing afterPageId" })
    }

    const storage = createBookStorage(safeLabel, booksDir)
    try {
      const row = storage.getLatestNodeData("quiz-generation", "book")
      const current = row ? readActivitiesFromNode(row.data) : null
      const existing = current?.activities ?? []
      const next: Activity = blankActivity(
        templateParse.data,
        nextActivityId(existing),
        afterPageId,
      )
      const updated = ActivitiesOutput.parse({
        generatedAt: current?.generatedAt ?? new Date().toISOString(),
        language: current?.language ?? "en",
        activities: [...existing, next],
      })
      const version = storage.putNodeData("quiz-generation", "book", updated)
      return c.json({ version, activity: next })
    } finally {
      storage.close()
    }
  })

  // POST /books/:label/activities/generate — Generate or extract activities for one or more pages.
  // Body: { source: "page" | "pages", pageIds: string[], templateType, count? }.
  app.post("/books/:label/activities/generate", async (c) => {
    const { label } = c.req.param()
    const safeLabel = safeParseLabel(label)
    const apiKey = c.req.header("X-OpenAI-Key")
    if (!apiKey) {
      throw new HTTPException(400, { message: "Missing X-OpenAI-Key header" })
    }

    const body = await c.req.json().catch(() => ({}))
    const source = body?.source === "pages" ? "pages" : "page"
    const templateParse = ActivityTemplateType.safeParse(body?.templateType)
    if (!templateParse.success) {
      throw new HTTPException(400, { message: "Invalid templateType" })
    }
    const templateType = templateParse.data
    const pageIds = Array.isArray(body?.pageIds)
      ? (body.pageIds as unknown[]).filter((p): p is string => typeof p === "string")
      : []
    if (pageIds.length === 0) {
      throw new HTTPException(400, { message: "pageIds must be a non-empty array of strings" })
    }
    const count = typeof body?.count === "number" && body.count > 0 ? Math.min(body.count, 10) : 1

    const desc =
      source === "page"
        ? `Extracting activity from ${pageIds[0]}`
        : `Generating ${count} activity${count > 1 ? "ies" : ""} from ${pageIds.length} pages`

    if (taskService) {
      const { taskId } = taskService.submitTask(
        safeLabel,
        "activity-generate",
        desc,
        async () => {
          return await generateActivitiesForPages({
            label: safeLabel,
            booksDir,
            promptsDir,
            configPath,
            apiKey,
            source,
            templateType,
            pageIds,
            count,
          })
        },
        { url: `/books/${safeLabel}/quizzes` },
      )
      return c.json({ taskId, status: "submitted" })
    }

    const result = await generateActivitiesForPages({
      label: safeLabel,
      booksDir,
      promptsDir,
      configPath,
      apiKey,
      source,
      templateType,
      pageIds,
      count,
    })
    return c.json(result)
  })

  return app
}
