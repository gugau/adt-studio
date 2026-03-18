import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import {
  ReviewerPageValidationRecord,
  ReviewerPageValidationSections,
  ReviewerValidationIdentificationFields,
  ReviewerValidationInstructions,
  ReviewerValidationSession,
  parseBookLabel,
} from "@adt/types"
import {
  ReviewerValidationListQuery,
  listReviewerPageValidationRecords,
  listReviewerValidationSessions,
  saveReviewerPageValidationRecord,
  saveReviewerValidationSession,
} from "../services/reviewer-validation-service.js"

export function createReviewerValidationRoutes(booksDir: string): Hono {
  const app = new Hono()

  app.get("/books/:label/validation/catalog", (c) => {
    parseBookLabel(c.req.param("label"))

    return c.json({
      identificationFields: ReviewerValidationIdentificationFields,
      instructions: ReviewerValidationInstructions,
      pageSections: ReviewerPageValidationSections,
    })
  })

  app.get("/books/:label/validation/sessions", (c) => {
    const { label } = c.req.param()
    const sessions = listReviewerValidationSessions(label, booksDir)
    return c.json({ sessions })
  })

  app.post("/books/:label/validation/sessions", async (c) => {
    const { label } = c.req.param()
    const body = await c.req.json<unknown>()
    const parsed = ReviewerValidationSession.safeParse(body)
    if (!parsed.success) {
      throw new HTTPException(400, { message: parsed.error.message })
    }

    const saved = saveReviewerValidationSession(label, booksDir, parsed.data)
    return c.json(saved, 201)
  })

  app.get("/books/:label/validation/page-results", (c) => {
    const { label } = c.req.param()
    const parsed = ReviewerValidationListQuery.safeParse({
      sessionId: c.req.query("sessionId"),
      pageId: c.req.query("pageId") || undefined,
      language: c.req.query("language") || undefined,
    })

    if (!parsed.success) {
      throw new HTTPException(400, { message: parsed.error.message })
    }

    const records = listReviewerPageValidationRecords(label, booksDir, parsed.data)
    return c.json({ records })
  })

  app.post("/books/:label/validation/page-results", async (c) => {
    const { label } = c.req.param()
    const body = await c.req.json<unknown>()
    const parsed = ReviewerPageValidationRecord.safeParse(body)
    if (!parsed.success) {
      throw new HTTPException(400, { message: parsed.error.message })
    }

    const saved = saveReviewerPageValidationRecord(label, booksDir, parsed.data)
    return c.json(saved, 201)
  })

  return app
}
