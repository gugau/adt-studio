import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { Hono } from "hono"
import { createBookStorage } from "@adt/storage"
import { errorHandler } from "../middleware/error-handler.js"
import { createBookEventBus } from "../services/book-event-bus.js"
import { createTaskService } from "../services/task-service.js"
import { createTaskRoutes } from "./tasks.js"
import { createTranslationEvaluationRoutes, type TranslationEvaluationRunner } from "./translation-evaluations.js"
import {
  getTranslationEvaluationStatus,
  saveTranslationEvaluationResult,
} from "../services/translation-evaluation-service.js"

const DEFAULT_TRANSLATION_EVALUATION_JUDGE_INSTRUCTIONS = `
Review the translation in {{ outputs }} against the source content in {{ inputs }}.

Decide whether the translation is acceptable overall.
Use these criteria:
- preserve meaning faithfully
- sound fluent and natural in the target language
- keep important terminology correct and consistent
- avoid important omissions or unsupported additions
- preserve meaningful formatting markers and placeholders when they affect meaning

Return a concise rationale for your decision.
`.trim()

async function flushTasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe("Translation evaluation routes", () => {
  let tmpDir: string
  let configPath: string
  let app: Hono
  let evaluateTranslation: TranslationEvaluationRunner
  let previousOpenAIKey: string | undefined
  const label = "translation-eval-book"

  beforeEach(() => {
    previousOpenAIKey = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "translation-evaluations-routes-"))

    const storage = createBookStorage(label, tmpDir)
    try {
      storage.putNodeData("text-catalog", "book", {
        entries: [
          { id: "pg001:body", text: "Hello world" },
        ],
        generatedAt: "2026-04-06T12:00:00.000Z",
      })
      storage.putNodeData("text-catalog-translation", "fr", {
        entries: [
          { id: "pg001:body", text: "Bonjour le monde" },
        ],
        generatedAt: "2026-04-06T12:01:00.000Z",
      })
    } finally {
      storage.close()
    }

    configPath = path.join(tmpDir, "config.yaml")
    fs.writeFileSync(configPath, [
      "structure_types:",
      "  paragraph: Paragraph",
      "role_types:",
      "  heading: Heading",
    ].join("\n"))

    app = new Hono()
    app.onError(errorHandler)
    const eventBus = createBookEventBus()
    const taskService = createTaskService(eventBus)
    evaluateTranslation = vi.fn(async (request) => ({
      generated_at: "2026-04-06T12:02:00.000Z",
      provider: "adt-llm",
      language: request.language,
      source_catalog_version: request.source_catalog_version,
      translation_version: request.translation_version,
      eval_config_hash: request.eval_config_hash,
      summary: {
        total: request.entries.length,
        acceptable: request.entries.length,
        unacceptable: 0,
      },
      items: request.entries.map((entry) => ({
        entry_id: entry.entry_id,
        acceptable: true,
        source_text: entry.source_text,
        translated_text: entry.translated_text,
        rationale: "Meaning is preserved.",
        issue_types: [],
      })),
    }))
    app.route("/api", createTranslationEvaluationRoutes(tmpDir, configPath, taskService, evaluateTranslation))
    app.route("/api", createTaskRoutes(taskService))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    if (previousOpenAIKey !== undefined) {
      process.env.OPENAI_API_KEY = previousOpenAIKey
    } else {
      delete process.env.OPENAI_API_KEY
    }
  })

  function enableTranslationEvaluation() {
    fs.writeFileSync(configPath, [
      "structure_types:",
      "  paragraph: Paragraph",
      "role_types:",
      "  heading: Heading",
      "translation_evaluation:",
      "  enable_translation_evaluation: true",
      "  judge_model: openai:/gpt-4.1-mini",
      "  evaluation_scope_mode: all",
      "  sampling_method: sequential",
      "  batch_size: 10",
      "  judge_instructions: Review {{ inputs }} against {{ outputs }}.",
      ].join("\n"))
  }

  function enableTranslationEvaluationWithSampleSize(sampleSize: number) {
    fs.writeFileSync(configPath, [
      "structure_types:",
      "  paragraph: Paragraph",
      "role_types:",
      "  heading: Heading",
      "translation_evaluation:",
      "  enabled: true",
      "  judge_model: openai:/gpt-4.1-mini",
      `  sample_size: ${sampleSize}`,
    ].join("\n"))
  }

  function enableTranslationEvaluationWithNewScopeConfig() {
    fs.writeFileSync(configPath, [
      "structure_types:",
      "  paragraph: Paragraph",
      "role_types:",
      "  heading: Heading",
      "translation_evaluation:",
      "  enable_translation_evaluation: true",
      "  judge_model: openai:/gpt-4.1-mini",
      "  max_retries: 4",
      "  evaluation_scope_mode: sample",
      "  evaluation_scope_count: 1",
      "  sampling_method: sequential",
      "  batch_size: 8",
      "  judge_instructions: Review {{ inputs }} against {{ outputs }}.",
      "  additional_guidance: Prefer classroom-friendly terminology.",
    ].join("\n"))
  }

  it("lists translation evaluation statuses", async () => {
    const res = await app.request(`/api/books/${label}/evaluations/translations`)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.evaluations).toEqual([
      {
        language: "fr",
        currentSourceCatalogVersion: 1,
        currentTranslationVersion: 1,
        evaluationVersion: null,
        evaluation: null,
        isStale: false,
      },
    ])
  })

  it("returns a single translation evaluation status", async () => {
    saveTranslationEvaluationResult(label, tmpDir, {
      generated_at: "2026-04-06T12:02:00.000Z",
      provider: "mlflow",
      language: "fr",
      source_catalog_version: 1,
      translation_version: 1,
      eval_config_hash: "cfg-123",
      summary: {
        total: 1,
        acceptable: 1,
        unacceptable: 0,
      },
      items: [
        {
          entry_id: "pg001:body",
          acceptable: true,
          rationale: "Meaning is preserved.",
        },
      ],
    })

    const res = await app.request(`/api/books/${label}/evaluations/translations/fr`)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.language).toBe("fr")
    expect(body.evaluationVersion).toBe(1)
    expect(body.evaluation.summary.acceptable).toBe(1)
  })

  it("returns 404 when no translation or evaluation exists for a language", async () => {
    const res = await app.request(`/api/books/${label}/evaluations/translations/de`)
    expect(res.status).toBe(404)
    expect(await res.text()).toContain("Translation evaluation not found")
  })

  it("blocks run submission when translation evaluation is disabled", async () => {
    const res = await app.request(`/api/books/${label}/evaluations/translations/fr/run`, {
      method: "POST",
    })

    expect(res.status).toBe(409)
    expect(await res.text()).toContain("Translation evaluation is disabled")
  })

  it("requires an OpenAI API key for run submission", async () => {
    enableTranslationEvaluation()

    const res = await app.request(`/api/books/${label}/evaluations/translations/fr/run`, {
      method: "POST",
    })

    expect(res.status).toBe(400)
    expect(await res.text()).toContain("OpenAI API key required")
  })

  it("blocks run submission when the translation does not exist", async () => {
    enableTranslationEvaluation()

    const res = await app.request(`/api/books/${label}/evaluations/translations/sw/run`, {
      method: "POST",
      headers: { "X-OpenAI-Key": "sk-test" },
    })

    expect(res.status).toBe(404)
    expect(await res.text()).toContain("Translated text catalog not found")
  })

  it("submits a translation evaluation task", async () => {
    enableTranslationEvaluation()

    const res = await app.request(`/api/books/${label}/evaluations/translations/fr/run`, {
      method: "POST",
      headers: { "X-OpenAI-Key": "sk-test" },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("submitted")
    expect(body.taskId).toMatch(/^task-/)
    expect(body.label).toBe(label)
    expect(body.language).toBe("fr")

    await flushTasks()

    const tasksRes = await app.request(`/api/books/${label}/tasks`)
    expect(tasksRes.status).toBe(200)
    const tasksBody = await tasksRes.json()
    expect(tasksBody.tasks).toHaveLength(1)
    expect(tasksBody.tasks[0].kind).toBe("translation-evaluation")
    expect(tasksBody.tasks[0].description).toContain("fr")

    expect(evaluateTranslation).toHaveBeenCalledTimes(1)
    const saved = getTranslationEvaluationStatus(label, tmpDir, "fr")
    expect(saved?.evaluationVersion).toBe(1)
    expect(saved?.evaluation?.summary.acceptable).toBe(1)
    expect(saved?.isStale).toBe(false)
  })

  it("uses OPENAI_API_KEY from the API environment when the request header is absent", async () => {
    enableTranslationEvaluation()
    process.env.OPENAI_API_KEY = "sk-env-test"

    const res = await app.request(`/api/books/${label}/evaluations/translations/fr/run`, {
      method: "POST",
    })

    expect(res.status).toBe(200)
    await flushTasks()

    expect(evaluateTranslation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        booksDir: tmpDir,
        apiKey: "sk-env-test",
      }),
      expect.any(Function),
    )
  })

  it("accepts the fallback ADT OpenAI key header", async () => {
    enableTranslationEvaluation()

    const res = await app.request(`/api/books/${label}/evaluations/translations/fr/run`, {
      method: "POST",
      headers: { "X-ADT-OpenAI-Key": "sk-adt-header-test" },
    })

    expect(res.status).toBe(200)
    await flushTasks()

    expect(evaluateTranslation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        booksDir: tmpDir,
        apiKey: "sk-adt-header-test",
      }),
      expect.any(Function),
    )
  })

  it("accepts the OpenAI key from the Authorization bearer header", async () => {
    enableTranslationEvaluation()

    const res = await app.request(`/api/books/${label}/evaluations/translations/fr/run`, {
      method: "POST",
      headers: { Authorization: "Bearer sk-bearer-test" },
    })

    expect(res.status).toBe(200)
    await flushTasks()

    expect(evaluateTranslation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        booksDir: tmpDir,
        apiKey: "sk-bearer-test",
      }),
      expect.any(Function),
    )
  })

  it("does not create a duplicate evaluation version when the current result already matches", async () => {
    enableTranslationEvaluation()

    const firstRes = await app.request(`/api/books/${label}/evaluations/translations/fr/run`, {
      method: "POST",
      headers: { "X-OpenAI-Key": "sk-test" },
    })
    expect(firstRes.status).toBe(200)
    await flushTasks()

    const secondRes = await app.request(`/api/books/${label}/evaluations/translations/fr/run`, {
      method: "POST",
      headers: { "X-OpenAI-Key": "sk-test" },
    })

    expect(secondRes.status).toBe(200)
    const body = await secondRes.json()
    expect(body).toEqual({
      status: "current",
      taskId: null,
      label,
      language: "fr",
      version: 1,
    })
    await flushTasks()

    expect(evaluateTranslation).toHaveBeenCalledTimes(1)
    const saved = getTranslationEvaluationStatus(label, tmpDir, "fr")
    expect(saved?.evaluationVersion).toBe(1)
  })

  it("marks an evaluation stale when the evaluation settings change", async () => {
    enableTranslationEvaluation()

    const runRes = await app.request(`/api/books/${label}/evaluations/translations/fr/run`, {
      method: "POST",
      headers: { "X-OpenAI-Key": "sk-test" },
    })
    expect(runRes.status).toBe(200)
    await flushTasks()

    enableTranslationEvaluationWithNewScopeConfig()

    const statusRes = await app.request(`/api/books/${label}/evaluations/translations/fr`)
    expect(statusRes.status).toBe(200)
    const status = await statusRes.json()
    expect(status.evaluationVersion).toBe(1)
    expect(status.isStale).toBe(true)
  })

  it("limits the submitted evaluation payload to the configured sample size", async () => {
    const storage = createBookStorage(label, tmpDir)
    try {
      storage.putNodeData("text-catalog", "book", {
        entries: [
          { id: "pg001:body", text: "Hello world" },
          { id: "pg002:body", text: "Goodbye world" },
        ],
        generatedAt: "2026-04-06T12:05:00.000Z",
      })
      storage.putNodeData("text-catalog-translation", "fr", {
        entries: [
          { id: "pg001:body", text: "Bonjour le monde" },
          { id: "pg002:body", text: "Au revoir le monde" },
        ],
        generatedAt: "2026-04-06T12:06:00.000Z",
      })
    } finally {
      storage.close()
    }

    enableTranslationEvaluationWithSampleSize(1)

    const res = await app.request(`/api/books/${label}/evaluations/translations/fr/run`, {
      method: "POST",
      headers: { "X-OpenAI-Key": "sk-test" },
    })

    expect(res.status).toBe(200)
    await flushTasks()

    expect(evaluateTranslation).toHaveBeenCalledTimes(1)
    expect(evaluateTranslation).toHaveBeenCalledWith(
      expect.objectContaining({
        evaluation_scope_mode: "sample",
        evaluation_scope_count: 1,
        sampling_method: "sequential",
        batch_size: 10,
        sample_size: 1,
        judge_instructions: DEFAULT_TRANSLATION_EVALUATION_JUDGE_INSTRUCTIONS,
        entries: [
          {
            entry_id: "pg001:body",
            source_text: "Hello world",
            translated_text: "Bonjour le monde",
          },
        ],
      }),
      expect.objectContaining({
        booksDir: tmpDir,
        apiKey: "sk-test",
      }),
      expect.any(Function),
    )
  })

  it("forwards the redesigned translation evaluation settings to the evaluator", async () => {
    enableTranslationEvaluationWithNewScopeConfig()

    const res = await app.request(`/api/books/${label}/evaluations/translations/fr/run`, {
      method: "POST",
      headers: { "X-OpenAI-Key": "sk-test" },
    })

    expect(res.status).toBe(200)
    await flushTasks()

    expect(evaluateTranslation).toHaveBeenCalledWith(
      expect.objectContaining({
        judge_model: "openai:/gpt-4.1-mini",
        max_retries: 4,
        evaluation_scope_mode: "sample",
        evaluation_scope_count: 1,
        sampling_method: "sequential",
        batch_size: 8,
        judge_instructions: "Review {{ inputs }} against {{ outputs }}.",
        additional_guidance: "Prefer classroom-friendly terminology.",
      }),
      expect.objectContaining({
        booksDir: tmpDir,
        apiKey: "sk-test",
      }),
      expect.any(Function),
    )
  })
})
