import { afterEach, beforeEach, describe, expect, it } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createBookStorage } from "@adt/storage"
import {
  getTranslationEvaluationStatus,
  listTranslationEvaluationStatuses,
  saveTranslationEvaluationResult,
} from "./translation-evaluation-service.js"

describe("translation-evaluation-service", () => {
  let tmpDir: string
  const label = "test-book"

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "translation-evaluation-svc-"))
    const storage = createBookStorage(label, tmpDir)
    storage.close()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  function seedCatalogAndTranslation(language = "fr") {
    const storage = createBookStorage(label, tmpDir)
    try {
      storage.putNodeData("text-catalog", "book", {
        entries: [
          { id: "pg001:body", text: "Hello world" },
          { id: "pg002:body", text: "Open the book" },
        ],
        generatedAt: "2026-04-06T12:00:00.000Z",
      })
      storage.putNodeData("text-catalog-translation", language, {
        entries: [
          { id: "pg001:body", text: "Bonjour le monde" },
          { id: "pg002:body", text: "Ouvrez le livre" },
        ],
        generatedAt: "2026-04-06T12:01:00.000Z",
      })
    } finally {
      storage.close()
    }
  }

  it("saves a versioned evaluation and returns it as current", () => {
    seedCatalogAndTranslation()

    const saved = saveTranslationEvaluationResult(label, tmpDir, {
      generated_at: "2026-04-06T12:02:00.000Z",
      provider: "adt-llm",
      language: "fr",
      source_catalog_version: 1,
      translation_version: 1,
      eval_config_hash: "cfg-123",
      summary: {
        total: 2,
        acceptable: 1,
        unacceptable: 1,
      },
      items: [
        {
          entry_id: "pg001:body",
          acceptable: true,
          rationale: "Meaning is preserved.",
        },
        {
          entry_id: "pg002:body",
          acceptable: false,
          rationale: "The imperative wording is weaker.",
          issue_types: ["meaning"],
        },
      ],
    })

    expect(saved.version).toBe(1)
    const status = getTranslationEvaluationStatus(label, tmpDir, "fr")
    expect(status).not.toBeNull()
    expect(status?.currentSourceCatalogVersion).toBe(1)
    expect(status?.currentTranslationVersion).toBe(1)
    expect(status?.evaluationVersion).toBe(1)
    expect(status?.evaluation?.language).toBe("fr")
    expect(status?.isStale).toBe(false)
  })

  it("lists translated languages even when they have not been evaluated", () => {
    seedCatalogAndTranslation("fr")
    seedCatalogAndTranslation("sw")

    const statuses = listTranslationEvaluationStatuses(label, tmpDir)

    expect(statuses).toEqual([
      {
        language: "fr",
        currentSourceCatalogVersion: 2,
        currentTranslationVersion: 1,
        evaluationVersion: null,
        evaluation: null,
        isStale: false,
      },
      {
        language: "sw",
        currentSourceCatalogVersion: 2,
        currentTranslationVersion: 1,
        evaluationVersion: null,
        evaluation: null,
        isStale: false,
      },
    ])
  })

  it("marks an evaluation stale when the translation version changes", () => {
    seedCatalogAndTranslation()
    saveTranslationEvaluationResult(label, tmpDir, {
      generated_at: "2026-04-06T12:02:00.000Z",
      provider: "adt-llm",
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
          rationale: "Looks good.",
        },
      ],
    })

    const storage = createBookStorage(label, tmpDir)
    try {
      storage.putNodeData("text-catalog-translation", "fr", {
        entries: [{ id: "pg001:body", text: "Salut tout le monde" }],
        generatedAt: "2026-04-06T12:03:00.000Z",
      })
    } finally {
      storage.close()
    }

    const status = getTranslationEvaluationStatus(label, tmpDir, "fr")
    expect(status?.currentTranslationVersion).toBe(2)
    expect(status?.evaluation?.translation_version).toBe(1)
    expect(status?.isStale).toBe(true)
  })

  it("marks an evaluation stale when the source catalog version changes", () => {
    seedCatalogAndTranslation()
    saveTranslationEvaluationResult(label, tmpDir, {
      generated_at: "2026-04-06T12:02:00.000Z",
      provider: "adt-llm",
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
          rationale: "Looks good.",
        },
      ],
    })

    const storage = createBookStorage(label, tmpDir)
    try {
      storage.putNodeData("text-catalog", "book", {
        entries: [{ id: "pg001:body", text: "Hello updated world" }],
        generatedAt: "2026-04-06T12:04:00.000Z",
      })
    } finally {
      storage.close()
    }

    const status = getTranslationEvaluationStatus(label, tmpDir, "fr")
    expect(status?.currentSourceCatalogVersion).toBe(2)
    expect(status?.evaluation?.source_catalog_version).toBe(1)
    expect(status?.isStale).toBe(true)
  })

  it("returns null when neither a translation nor an evaluation exists", () => {
    expect(getTranslationEvaluationStatus(label, tmpDir, "de")).toBeNull()
  })
})
