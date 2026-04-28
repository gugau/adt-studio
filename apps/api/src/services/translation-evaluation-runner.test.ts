import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createBookStorage } from "@adt/storage"
import type { LLMModel } from "@adt/llm"
import {
  evaluateTranslationInApi,
  translationEvaluationRunnerInternals,
} from "./translation-evaluation-runner.js"

describe("translation-evaluation-runner", () => {
  let tmpDir: string
  const label = "translation-runner-book"

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "translation-evaluation-runner-"))
    const storage = createBookStorage(label, tmpDir)
    storage.close()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  function buildRequest() {
    return {
      book_label: label,
      language: "fr",
      source_language: "en",
      source_catalog_version: 1,
      translation_version: 2,
      eval_config_hash: "cfg-123",
      judge_model: "openai:/gpt-4.1-mini",
      max_retries: 2,
      batch_size: 1,
      judge_instructions: "Review the translation.",
      additional_guidance: "Prefer classroom-friendly wording.",
      entries: [
        {
          entry_id: "pg001:body",
          source_text: "Hello world",
          translated_text: "Bonjour le monde",
        },
      ],
    }
  }

  it("evaluates entries with the TypeScript LLM judge and keeps text snapshots", async () => {
    const generateObject = vi.fn(async () => ({
      object: {
        acceptable: true,
        rationale: "The translation preserves the meaning.",
        issue_types: [],
      },
      usage: { inputTokens: 10, outputTokens: 6 },
      cached: false,
    }))
    const createModel = vi.fn(() => ({
      generateObject,
      renderPrompt: vi.fn(),
    }) as unknown as LLMModel)

    const result = await evaluateTranslationInApi(buildRequest(), {
      booksDir: tmpDir,
      apiKey: "sk-test",
      createModel,
    })

    expect(createModel).toHaveBeenCalledWith(expect.objectContaining({
      modelId: "openai:gpt-4.1-mini",
      cacheDir: path.join(tmpDir, label, ".cache"),
    }))
    expect(generateObject).toHaveBeenCalledWith(expect.objectContaining({
      maxRetries: 2,
      temperature: 0,
      log: expect.objectContaining({
        taskType: "translation-evaluation",
        promptName: "translation-evaluation-judge",
        pageId: "pg001:body",
      }),
    }))
    const generateOptions = generateObject.mock.calls[0]?.[0] as {
      schema: { safeParse: (input: unknown) => { success: boolean } }
      system: string
    }
    expect(generateOptions.system).toContain("Always include issue_types")
    expect(generateOptions.schema.safeParse({
      acceptable: true,
      rationale: "Acceptable translation.",
    }).success).toBe(false)
    expect(generateOptions.schema.safeParse({
      acceptable: true,
      rationale: "Acceptable translation.",
      issue_types: [],
    }).success).toBe(true)
    expect(result.provider).toBe("adt-llm")
    expect(result.summary).toEqual({ total: 1, acceptable: 1, unacceptable: 0 })
    expect(result.items[0]).toEqual({
      entry_id: "pg001:body",
      acceptable: true,
      source_text: "Hello world",
      translated_text: "Bonjour le monde",
      rationale: "The translation preserves the meaning.",
      issue_types: [],
    })
    expect(result.judge?.model).toBe("openai:gpt-4.1-mini")
    expect(result.metadata?.failed_items).toBe(0)
  })

  it("records per-entry LLM failures as needs-review items", async () => {
    const generateObject = vi.fn(async () => {
      throw new Error("provider timed out")
    })
    const createModel = vi.fn(() => ({
      generateObject,
      renderPrompt: vi.fn(),
    }) as unknown as LLMModel)

    const result = await evaluateTranslationInApi(buildRequest(), {
      booksDir: tmpDir,
      apiKey: "sk-test",
      createModel,
    })

    expect(result.summary).toEqual({ total: 1, acceptable: 0, unacceptable: 1 })
    expect(result.items[0]).toEqual(expect.objectContaining({
      entry_id: "pg001:body",
      acceptable: false,
      rationale: "Translation judge failed: provider timed out",
      issue_types: ["other"],
    }))
    expect(result.metadata?.failed_items).toBe(1)
  })

  it("requires a user-provided OpenAI API key", async () => {
    await expect(evaluateTranslationInApi(buildRequest(), {
      booksDir: tmpDir,
      apiKey: "",
      createModel: vi.fn(),
    })).rejects.toThrow("OpenAI API key required")
  })

  it("normalizes legacy slash-prefixed OpenAI model URIs", () => {
    expect(translationEvaluationRunnerInternals.normalizeJudgeModel("openai:/gpt-4.1-mini"))
      .toBe("openai:gpt-4.1-mini")
  })
})
