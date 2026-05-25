import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createBookStorage } from "@adt/storage"
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
})
