import { afterEach, beforeEach, describe, expect, it } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { openBookDb } from "@adt/storage"
import { createEasyReadRoutes } from "./easy-read.js"

let tmpDir: string
let promptsDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "adt-easy-read-route-"))
  promptsDir = fs.mkdtempSync(path.join(os.tmpdir(), "adt-easy-read-prompts-"))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.rmSync(promptsDir, { recursive: true, force: true })
})

function createTestBook(label: string): void {
  const bookDir = path.join(tmpDir, label)
  fs.mkdirSync(path.join(bookDir, "images"), { recursive: true })
  const db = openBookDb(path.join(bookDir, `${label}.db`))
  db.run(
    "INSERT INTO node_data (node, item_id, version, data) VALUES (?, ?, ?, ?)",
    [
      "metadata",
      "book",
      1,
      JSON.stringify({
        title: "Test Book",
        authors: [],
        publisher: null,
        language_code: "en",
        cover_page_number: null,
        reasoning: "test",
      }),
    ],
  )
  db.close()
}

function easyReadData(text = "Easy text") {
  return {
    blocks: [
      {
        pageId: "pg001",
        pageNumber: 1,
        sectionId: "pg001_sec001",
        sectionIndex: 0,
        sectionType: "text_only",
        entries: [
          {
            sourceId: "pg001_tx001",
            easyReadId: "pg001_tx001_easy_read",
            originalText: "Original text",
            text,
            pageId: "pg001",
            sectionId: "pg001_sec001",
            sectionIndex: 0,
          },
        ],
      },
    ],
    generatedAt: "2026-01-01T00:00:00.000Z",
  }
}

describe("easy read routes", () => {
  it("returns null when no Easy Read output exists", async () => {
    createTestBook("empty")
    const app = createEasyReadRoutes(tmpDir, promptsDir)
    const res = await app.request("/books/empty/easy-read")
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it("saves a new version and clears downstream nodes", async () => {
    createTestBook("editable")
    const dbPath = path.join(tmpDir, "editable", "editable.db")
    const db = openBookDb(dbPath)
    db.run(
      "INSERT INTO node_data (node, item_id, version, data) VALUES (?, ?, ?, ?)",
      ["text-catalog-translation", "es", 1, JSON.stringify({ entries: [], generatedAt: "x" })],
    )
    db.run(
      "INSERT INTO step_runs (step, status, completed_at) VALUES (?, ?, ?)",
      ["catalog-translation", "done", "2026-01-01T00:00:00.000Z"],
    )
    db.close()

    const app = createEasyReadRoutes(tmpDir, promptsDir)
    const res = await app.request("/books/editable/easy-read", {
      method: "PUT",
      body: JSON.stringify(easyReadData("Edited Easy Read")),
      headers: { "Content-Type": "application/json" },
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ version: 1 })

    const verify = openBookDb(dbPath)
    try {
      const latest = verify.get(
        "SELECT data FROM node_data WHERE node = ? AND item_id = ?",
        ["easy-read", "book"],
      ) as { data: string }
      expect(JSON.parse(latest.data).blocks[0].entries[0].text).toBe("Edited Easy Read")
      const downstream = verify.all(
        "SELECT node FROM node_data WHERE node = ?",
        ["text-catalog-translation"],
      )
      expect(downstream).toEqual([])
      const stepRuns = verify.all(
        "SELECT step FROM step_runs WHERE step = ?",
        ["catalog-translation"],
      )
      expect(stepRuns).toEqual([])
    } finally {
      verify.close()
    }
  })

  it("rejects invalid Easy Read payloads", async () => {
    createTestBook("invalid")
    const app = createEasyReadRoutes(tmpDir, promptsDir)
    const res = await app.request("/books/invalid/easy-read", {
      method: "PUT",
      body: JSON.stringify({ blocks: "nope" }),
      headers: { "Content-Type": "application/json" },
    })

    expect(res.status).toBe(400)
  })
})
