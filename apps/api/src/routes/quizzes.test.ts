import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createBookStorage } from "@adt/storage"
import { createQuizRoutes } from "./quizzes.js"

describe("quiz routes", () => {
  let tmpDir: string
  const label = "quiz-route-book"

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "adt-quiz-route-"))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  function putPage(storage: ReturnType<typeof createBookStorage>, pageId: string, pageNumber: number) {
    storage.putExtractedPage({
      pageId,
      pageNumber,
      text: `Page ${pageNumber}`,
      pageImage: {
        imageId: `${pageId}_page`,
        buffer: Buffer.from(`page-${pageNumber}`),
        format: "png",
        hash: `hash-${pageNumber}`,
        width: 100,
        height: 100,
      },
      images: [],
    })
  }

  function createBookWithActivities() {
    const storage = createBookStorage(label, tmpDir)
    try {
      putPage(storage, "pg001", 1)
      putPage(storage, "pg002", 2)
      storage.putNodeData("metadata", "book", { language_code: "en" })

      storage.putNodeData("page-sectioning", "pg001", {
        reasoning: "ok",
        sections: [
          {
            sectionId: "pg001_sec001",
            sectionType: "activity_multiple_choice",
            backgroundColor: "#fff",
            textColor: "#000",
            pageNumber: 1,
            isPruned: false,
            nodes: [
              { nodeId: "pg001_n001", isPruned: false, role: "activity_instruction", text: "Choose the best answer." },
              {
                nodeId: "pg001_n002",
                isPruned: false,
                structure: "image_group",
                children: [
                  { nodeId: "pg001_im001", isPruned: false, role: "image" },
                  { nodeId: "pg001_n003", isPruned: false, role: "caption", text: "A source image caption." },
                ],
              },
              { nodeId: "pg001_n004", isPruned: true, role: "activity_option", text: "Hidden option" },
            ],
          },
          {
            sectionId: "pg001_sec002",
            sectionType: "text_only",
            backgroundColor: "#fff",
            textColor: "#000",
            pageNumber: 1,
            isPruned: false,
            nodes: [{ nodeId: "pg001_n005", isPruned: false, role: "section_text", text: "Story text" }],
          },
        ],
      })
      storage.putNodeData("web-rendering", "pg001", {
        sections: [
          {
            sectionIndex: 0,
            sectionType: "activity_multiple_choice",
            reasoning: "rendered",
            html: "<section>raw activity html should stay private</section>",
            activityAnswers: { "item-1": true, "item-2": false },
          },
          {
            sectionIndex: 1,
            sectionType: "text_only",
            reasoning: "rendered",
            html: "<section>story</section>",
          },
        ],
      })

      storage.putNodeData("page-sectioning", "pg002", {
        reasoning: "ok",
        sections: [
          {
            sectionId: "pg002_sec001",
            sectionType: "activity_matching",
            backgroundColor: "#fff",
            textColor: "#000",
            pageNumber: 2,
            isPruned: false,
            nodes: [
              { nodeId: "pg002_n001", isPruned: false, role: "activity_instruction", text: "Match the words." },
              { nodeId: "pg002_n002", isPruned: false, role: "activity_option", text: "Root" },
            ],
          },
        ],
      })
    } finally {
      storage.close()
    }
  }

  it("lists detected textbook activities without exposing raw HTML", async () => {
    createBookWithActivities()
    const app = createQuizRoutes(tmpDir)

    const res = await app.request(`/books/${label}/quizzes/textbook-activities`)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.activities).toEqual([
      {
        id: "pg001_sec001",
        pageId: "pg001",
        pageNumber: 1,
        sectionId: "pg001_sec001",
        sectionIndex: 0,
        sectionType: "activity_multiple_choice",
        textPreview: "Choose the best answer. A source image caption.",
        textBlockCount: 2,
        imageCount: 1,
        answerCount: 2,
        hasRendering: true,
      },
      {
        id: "pg002_sec001",
        pageId: "pg002",
        pageNumber: 2,
        sectionId: "pg002_sec001",
        sectionIndex: 0,
        sectionType: "activity_matching",
        textPreview: "Match the words. Root",
        textBlockCount: 2,
        imageCount: 0,
        answerCount: 0,
        hasRendering: false,
      },
    ])
    expect(JSON.stringify(body)).not.toContain("<section>")
  })

  it("returns 404 for missing books", async () => {
    const app = createQuizRoutes(tmpDir)
    const res = await app.request("/books/missing/quizzes/textbook-activities")

    expect(res.status).toBe(404)
  })

  it("stores textbook activity overrides and syncs them into quiz generation", async () => {
    createBookWithActivities()
    const app = createQuizRoutes(tmpDir)
    const payload = {
      sourcePageId: "pg001",
      sourceSectionId: "pg001_sec001",
      activityType: "multiple_choice",
      template: {
        id: "worksheet-rows",
        name: "Worksheet rows",
        style: "worksheet_rows",
        generationMode: "template_single_page",
      },
      questions: [
        {
          activityType: "multiple_choice",
          question: "What should Karma eat?",
          options: [
            { text: "Tree leaves", explanation: "" },
            { text: "Bananas", explanation: "" },
            { text: "Chillies", explanation: "" },
            { text: "Grass", explanation: "" },
          ],
          answerIndex: 1,
          reasoning: "test",
        },
      ],
      assignedPageIds: ["pg002"],
      insertAfterPageId: "pg002",
      questionsPerQuiz: 1,
      replaceExistingForPages: false,
      hidden: false,
    }

    const saveRes = await app.request(
      `/books/${label}/quizzes/textbook-activities/pg001_pg001_sec001/override`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    )
    expect(saveRes.status).toBe(200)
    const saveBody = await saveRes.json()
    expect(saveBody.override).toMatchObject({
      id: "pg001_pg001_sec001",
      assignedPageIds: ["pg002"],
      insertAfterPageId: "pg002",
    })

    const listRes = await app.request(`/books/${label}/quizzes/textbook-activities`)
    const listBody = await listRes.json()
    expect(listBody.activities[0].override).toMatchObject({
      id: "pg001_pg001_sec001",
      activityType: "multiple_choice",
    })

    const quizzesRes = await app.request(`/books/${label}/quizzes`)
    const quizzesBody = await quizzesRes.json()
    expect(quizzesBody.quizzes.quizzes).toHaveLength(1)
    expect(quizzesBody.quizzes.quizzes[0]).toMatchObject({
      sourceTextbookActivityId: "pg001_pg001_sec001",
      afterPageId: "pg002",
      pageIds: ["pg002"],
      question: "What should Karma eat?",
    })

    const resetRes = await app.request(
      `/books/${label}/quizzes/textbook-activities/pg001_pg001_sec001/override`,
      { method: "DELETE" }
    )
    expect(resetRes.status).toBe(200)

    const afterResetQuizzesRes = await app.request(`/books/${label}/quizzes`)
    const afterResetQuizzesBody = await afterResetQuizzesRes.json()
    expect(afterResetQuizzesBody.quizzes.quizzes).toEqual([])
  })

  it("keeps valid textbook overrides when one stored entry is corrupted", async () => {
    createBookWithActivities()
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const storage = createBookStorage(label, tmpDir)
    try {
      storage.putNodeData("textbook-activity-overrides", "book", [
        {
          id: "pg001_pg001_sec001",
          sourcePageId: "pg001",
          sourceSectionId: "pg001_sec001",
          activityType: "multiple_choice",
          template: {
            name: "Worksheet rows",
            style: "worksheet_rows",
            generationMode: "template_single_page",
          },
          questions: [
            {
              activityType: "multiple_choice",
              question: "What should Karma eat?",
              options: [
                { text: "Tree leaves", explanation: "" },
                { text: "Bananas", explanation: "" },
              ],
              answerIndex: 0,
              reasoning: "test",
            },
          ],
          assignedPageIds: ["pg001"],
          insertAfterPageId: "pg001",
          questionsPerQuiz: 1,
          replaceExistingForPages: false,
          hidden: false,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        { id: "bad", sourcePageId: "pg001" },
      ])
    } finally {
      storage.close()
    }

    const app = createQuizRoutes(tmpDir)
    const res = await app.request(`/books/${label}/quizzes/textbook-activities`)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.activities[0].override).toMatchObject({
      id: "pg001_pg001_sec001",
      activityType: "multiple_choice",
    })
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Dropping invalid textbook activity override bad"))
    warnSpy.mockRestore()
  })

  it("surfaces textbook override ids whose detected section no longer exists", async () => {
    createBookWithActivities()
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const storage = createBookStorage(label, tmpDir)
    try {
      storage.putNodeData("textbook-activity-overrides", "book", [
        {
          id: "pg001_pg001_sec999",
          sourcePageId: "pg001",
          sourceSectionId: "pg001_sec999",
          activityType: "multiple_choice",
          template: {
            name: "Worksheet rows",
            style: "worksheet_rows",
            generationMode: "template_single_page",
          },
          questions: [
            {
              activityType: "multiple_choice",
              question: "What should Karma eat?",
              options: [
                { text: "Tree leaves", explanation: "" },
                { text: "Bananas", explanation: "" },
              ],
              answerIndex: 0,
              reasoning: "test",
            },
          ],
          assignedPageIds: ["pg001"],
          insertAfterPageId: "pg001",
          questionsPerQuiz: 1,
          replaceExistingForPages: false,
          hidden: false,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ])
    } finally {
      storage.close()
    }

    const app = createQuizRoutes(tmpDir)
    const res = await app.request(`/books/${label}/quizzes/textbook-activities`)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.orphanedOverrideIds).toEqual(["pg001_pg001_sec999"])
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("without matching sections"))
    warnSpy.mockRestore()
  })

  it("applies the configured open-ended response limit when syncing textbook overrides", async () => {
    createBookWithActivities()
    const app = createQuizRoutes(tmpDir)
    const payload = {
      sourcePageId: "pg001",
      sourceSectionId: "pg001_sec001",
      activityType: "open_ended",
      template: {
        id: "worksheet-rows",
        name: "Worksheet rows",
        style: "worksheet_rows",
        generationMode: "template_single_page",
      },
      questions: [
        {
          activityType: "open_ended",
          question: "Why did Karma ask for help?",
          sampleAnswer: "Karma needed help.",
          guidance: "Use one reason from the story.",
          reasoning: "test",
        },
      ],
      assignedPageIds: ["pg001"],
      insertAfterPageId: "pg001",
      questionsPerQuiz: 1,
      replaceExistingForPages: false,
      hidden: false,
    }

    const saveRes = await app.request(
      `/books/${label}/quizzes/textbook-activities/pg001_pg001_sec001/override`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    )
    expect(saveRes.status).toBe(200)

    const quizzesRes = await app.request(`/books/${label}/quizzes`)
    const quizzesBody = await quizzesRes.json()
    const quiz = quizzesBody.quizzes.quizzes[0]
    expect(quiz.activityType).toBe("open_ended")
    expect(quiz.responseCharacterLimit).toBe(250)
    expect(quiz.questions[0].responseCharacterLimit).toBe(250)
  })
})
