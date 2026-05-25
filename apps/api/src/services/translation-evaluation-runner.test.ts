import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createBookStorage } from "@adt/storage"
import type { LLMModel } from "@adt/llm"
import type { TranslationEvaluationRunRequest } from "@adt/types"
import { evaluateTranslationInApi } from "./translation-evaluation-runner.js"

let tmpDir = ""

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "translation-evaluation-runner-"))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  tmpDir = ""
})

function seedBook(label: string): void {
  const storage = createBookStorage(label, tmpDir)
  storage.close()
}

function buildRequest(label: string): TranslationEvaluationRunRequest {
  return {
    book_label: label,
    language: "es",
    source_language: "en",
    source_catalog_version: 1,
    translation_version: 2,
    eval_config_hash: "hash",
    judge_model: "openai:/gpt-4.1-mini",
    max_retries: 1,
    batch_size: 1,
    judge_instructions: "Review translations.",
    book_metadata: {
      title: "Forest Book",
      language_code: "en",
    },
    pages: [
      {
        page_id: "pg001",
        entries: [
          {
            entry_id: "pg001_t001",
            source_text: "Do you?",
            translated_text: "Y a ti?",
            source_hash: "source-hash",
            translated_hash: "translated-hash",
          },
        ],
      },
    ],
  }
}

describe("evaluateTranslationInApi", () => {
  it("evaluates entries with page context and stores item-level results", async () => {
    const label = "eval-runner"
    seedBook(label)
    const generateObject = vi.fn<LLMModel["generateObject"]>().mockResolvedValue({
      object: {
        items: [
          {
            entry_id: "pg001_t001",
            acceptable: false,
            rationale: "The translation changes the implied question.",
            issue_types: ["meaning"],
            severity: "high",
            suggested_text: "¿Lo haces tú?",
          },
        ],
      },
    })
    const model: LLMModel = {
      generateObject,
      renderPrompt: vi.fn(),
    }

    const result = await evaluateTranslationInApi(
      buildRequest(label),
      {
        booksDir: tmpDir,
        apiKey: "sk-test",
        createModel: () => model,
      },
    )

    expect(result.summary).toEqual({ total: 1, acceptable: 0, unacceptable: 1 })
    expect(result.metadata?.page_id).toBe("pg001")
    expect(result.metadata?.book_metadata?.title).toBe("Forest Book")
    expect(result.items[0]).toMatchObject({
      entry_id: "pg001_t001",
      page_id: "pg001",
      acceptable: false,
      severity: "high",
      suggested_text: "¿Lo haces tú?",
      source_hash: "source-hash",
      translated_hash: "translated-hash",
    })
    expect(generateObject).toHaveBeenCalledWith(expect.objectContaining({
      log: expect.objectContaining({ pageId: "pg001" }),
    }))
    const prompt = generateObject.mock.calls[0][0].messages?.[0]?.content
    expect(String(prompt)).toContain("Forest Book")
    expect(String(prompt)).toContain("Y a ti?")
  })
})
