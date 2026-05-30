import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createBookStorage } from "@adt/storage"
import {
  DEFAULT_TRANSLATION_EVALUATION_BATCH_SIZE,
  DEFAULT_TRANSLATION_EVALUATION_JUDGE_INSTRUCTIONS,
  DEFAULT_TRANSLATION_EVALUATION_JUDGE_MODEL,
  DEFAULT_TRANSLATION_EVALUATION_MAX_RETRIES,
} from "@adt/types"
import type { TaskService } from "../services/task-service.js"
import { saveTranslationEvaluationResult } from "../services/translation-evaluation-service.js"
import { createTranslationEvaluationRoutes } from "./translation-evaluations.js"

let tmpDir = ""

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "translation-evaluations-routes-"))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  tmpDir = ""
})

function seedBook(label: string): void {
  const storage = createBookStorage(label, tmpDir)
  try {
    storage.putNodeData("text-catalog", "book", {
      entries: [{ id: "pg001_t001", text: "Do you?" }],
      generatedAt: new Date().toISOString(),
    })
    storage.putNodeData("text-catalog-translation", "es", {
      entries: [{ id: "pg001_t001", text: "Y a ti?" }],
      generatedAt: new Date().toISOString(),
    })
  } finally {
    storage.close()
  }
}

function seedBookWithEditedTranslation(label: string): void {
  const storage = createBookStorage(label, tmpDir)
  try {
    storage.putNodeData("text-catalog", "book", {
      entries: [{ id: "pg001_t001", text: "Do you?" }],
      generatedAt: new Date().toISOString(),
    })
    storage.putNodeData("text-catalog-translation", "es", {
      entries: [{ id: "pg001_t001", text: "¿Lo haces tú?" }],
    })
  } finally {
    storage.close()
  }
}

function defaultEvalConfigHash(): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({
      judge_model: DEFAULT_TRANSLATION_EVALUATION_JUDGE_MODEL,
      max_retries: DEFAULT_TRANSLATION_EVALUATION_MAX_RETRIES,
      batch_size: DEFAULT_TRANSLATION_EVALUATION_BATCH_SIZE,
      judge_instructions: DEFAULT_TRANSLATION_EVALUATION_JUDGE_INSTRUCTIONS,
      additional_guidance: null,
      strictness: "balanced",
      target_audience: null,
      style_guidance: null,
      terminology_guidance: null,
    }))
    .digest("hex")
}

describe("translation evaluation routes", () => {
  it("marks a needs-attention item as accepted anyway without changing translation text", async () => {
    const label = "accept-anyway"
    seedBook(label)
    saveTranslationEvaluationResult(label, tmpDir, {
      generated_at: new Date().toISOString(),
      provider: "adt-llm",
      language: "es",
      source_language: "en",
      source_catalog_version: 1,
      translation_version: 1,
      eval_config_hash: "hash",
      summary: {
        total: 1,
        acceptable: 0,
        unacceptable: 1,
      },
      items: [
        {
          entry_id: "pg001_t001",
          page_id: "pg001",
          acceptable: false,
          source_text: "Do you?",
          translated_text: "Y a ti?",
          rationale: "Meaning changed.",
          issue_types: ["meaning"],
          suggested_text: "¿Lo haces tú?",
        },
      ],
      metadata: {
        page_id: "pg001",
        selected_entry_count: 1,
        selected_entry_ids: ["pg001_t001"],
      },
    })

    const app = createTranslationEvaluationRoutes(tmpDir)
    const res = await app.request(`/books/${label}/evaluations/translations/es/items/pg001_t001/accept-anyway`, {
      method: "POST",
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.version).toBe(2)
    expect(body.evaluation.summary.accepted_anyway).toBe(1)
    expect(body.evaluation.items[0].accepted_anyway).toBe(true)

    const storage = createBookStorage(label, tmpDir)
    try {
      const translation = storage.getLatestNodeData("text-catalog-translation", "es")
      expect((translation?.data as { entries: Array<{ text: string }> }).entries[0].text).toBe("Y a ti?")
    } finally {
      storage.close()
    }
  })

  it("submits a new review when the matching saved evaluation contains failed pages", async () => {
    const label = "rerun-failed-review"
    seedBook(label)
    saveTranslationEvaluationResult(label, tmpDir, {
      generated_at: new Date().toISOString(),
      provider: "adt-llm",
      language: "es",
      source_language: "en",
      source_catalog_version: 1,
      translation_version: 1,
      eval_config_hash: defaultEvalConfigHash(),
      summary: {
        total: 1,
        acceptable: 0,
        unacceptable: 1,
      },
      items: [
        {
          entry_id: "pg001_t001",
          page_id: "visible",
          acceptable: false,
          source_text: "Do you?",
          translated_text: "Y a ti?",
          rationale: "Translation judge failed: No object generated.",
          issue_types: ["other"],
          severity: "medium",
        },
      ],
      metadata: {
        page_id: "visible",
        selected_entry_count: 1,
        selected_entry_ids: ["pg001_t001"],
        failed_pages: 1,
      },
    })

    let submitted = false
    const taskService: TaskService = {
      submitTask: () => {
        submitted = true
        return { taskId: "task-1" }
      },
      getActiveTasks: () => [],
    }
    const app = createTranslationEvaluationRoutes(
      tmpDir,
      undefined,
      taskService,
      async (request) => ({
        generated_at: new Date().toISOString(),
        provider: "adt-llm",
        language: request.language,
        ...(request.source_language ? { source_language: request.source_language } : {}),
        source_catalog_version: request.source_catalog_version,
        translation_version: request.translation_version,
        eval_config_hash: request.eval_config_hash,
        summary: { total: 1, acceptable: 1, unacceptable: 0 },
        items: [
          {
            entry_id: "pg001_t001",
            page_id: "visible",
            acceptable: true,
            source_text: "Do you?",
            translated_text: "Y a ti?",
            rationale: "Translation is acceptable.",
            issue_types: [],
          },
        ],
        metadata: {
          page_id: "visible",
          selected_entry_count: 1,
          selected_entry_ids: ["pg001_t001"],
        },
      }),
    )

    const res = await app.request(`/books/${label}/evaluations/translations/es/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-OpenAI-Key": "sk-test" },
      body: JSON.stringify({ entry_ids: ["pg001_t001"] }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("submitted")
    expect(submitted).toBe(true)
  })

  it("can review an edited translation catalog that is missing generatedAt", async () => {
    const label = "edited-translation-review"
    seedBookWithEditedTranslation(label)
    let submitted = false
    const taskService: TaskService = {
      submitTask: () => {
        submitted = true
        return { taskId: "task-1" }
      },
      getActiveTasks: () => [],
    }
    const app = createTranslationEvaluationRoutes(
      tmpDir,
      undefined,
      taskService,
      async (request) => ({
        generated_at: new Date().toISOString(),
        provider: "adt-llm",
        language: request.language,
        ...(request.source_language ? { source_language: request.source_language } : {}),
        source_catalog_version: request.source_catalog_version,
        translation_version: request.translation_version,
        eval_config_hash: request.eval_config_hash,
        summary: { total: 1, acceptable: 1, unacceptable: 0 },
        items: [
          {
            entry_id: "pg001_t001",
            page_id: "visible",
            acceptable: true,
            source_text: "Do you?",
            translated_text: "¿Lo haces tú?",
            rationale: "Translation is acceptable.",
            issue_types: [],
          },
        ],
      }),
    )

    const res = await app.request(`/books/${label}/evaluations/translations/es/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-OpenAI-Key": "sk-test" },
      body: JSON.stringify({ entry_ids: ["pg001_t001"] }),
    })

    expect(res.status).toBe(200)
    expect(submitted).toBe(true)
  })
})
