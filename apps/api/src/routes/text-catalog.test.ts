import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createBookStorage } from "@adt/storage"
import { TextCatalogOutput } from "@adt/types"
import { createTextCatalogRoutes } from "./text-catalog.js"

let tmpDir = ""

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "text-catalog-routes-"))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  tmpDir = ""
})

function seedBook(label: string): void {
  const storage = createBookStorage(label, tmpDir)
  storage.close()
}

describe("text catalog routes", () => {
  it("stores edited translations as valid text catalog output", async () => {
    const label = "edited-translations"
    seedBook(label)
    const app = createTextCatalogRoutes(tmpDir)

    const res = await app.request(`/books/${label}/text-catalog-translation/es`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: [{ id: "pg001_t001", text: "¿Lo haces tú?" }],
      }),
    })

    expect(res.status).toBe(200)
    const storage = createBookStorage(label, tmpDir)
    try {
      const translation = storage.getLatestNodeData("text-catalog-translation", "es")
      const parsed = TextCatalogOutput.safeParse(translation?.data)
      expect(parsed.success).toBe(true)
      expect(parsed.data?.entries[0].text).toBe("¿Lo haces tú?")
      expect(parsed.data?.generatedAt).toEqual(expect.any(String))
    } finally {
      storage.close()
    }
  })
})
