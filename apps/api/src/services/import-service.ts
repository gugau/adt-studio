import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { unzipSync } from "fflate"
import { parseBookLabel, BookMetadata, PIPELINE } from "@adt/types"
import { renderPdfCover } from "@adt/pdf"
import { openBookDb } from "@adt/storage"
import type { BookSummary } from "./book-service.js"

export interface ImportResult extends BookSummary {}

export interface ImportPreview {
  label: string
  title: string | null
  authors: string[]
  publisher: string | null
  languageCode: string | null
  pageCount: number
  hasSourcePdf: boolean
  imageCount: number
  videoCount: number
  coverBase64: string | null
  stages: Record<string, { status: string; stepCount: number; doneCount: number }>
  validationError: string | null
}

function resolveUniqueLabel(baseLabel: string, booksDir: string): string {
  const resolvedDir = path.resolve(booksDir)
  if (!fs.existsSync(path.join(resolvedDir, baseLabel))) {
    return baseLabel
  }
  let n = 2
  while (fs.existsSync(path.join(resolvedDir, `${baseLabel}-${n}`))) {
    n++
  }
  return `${baseLabel}-${n}`
}

export function previewImport(zipBuffer: Buffer): ImportPreview {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(zipBuffer)
  } catch {
    throw new Error("Invalid ZIP file")
  }

  const filePaths = Object.keys(entries)

  const dbEntry = filePaths.find((p) => p.endsWith(".db") && !p.includes("/"))
  if (!dbEntry) {
    throw new Error("Invalid project archive: missing database file (.db) at root level")
  }

  const rawLabel = dbEntry.replace(/\.db$/, "")
  const safeLabel = parseBookLabel(rawLabel)

  const pdfEntry = filePaths.find((p) => p.endsWith(".pdf") && !p.includes("/"))
  const hasPdf = !!pdfEntry
  const imageCount = filePaths.filter((p) => p.startsWith("images/") && !p.endsWith("/")).length
  const videoCount = filePaths.filter((p) => p.startsWith("videos/") && !p.endsWith("/")).length

  let coverBase64: string | null = null
  if (pdfEntry) {
    const pdfBuffer = Buffer.from(entries[pdfEntry])
    const coverPng = renderPdfCover(pdfBuffer)
    if (coverPng) {
      coverBase64 = coverPng.toString("base64")
    }
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "adt-preview-"))
  const tmpDbPath = path.join(tmpDir, `${safeLabel}.db`)

  let title: string | null = null
  let authors: string[] = []
  let publisher: string | null = null
  let languageCode: string | null = null
  let pageCount = 0
  let validationError: string | null = null
  const stages: ImportPreview["stages"] = {}

  try {
    fs.writeFileSync(tmpDbPath, entries[dbEntry])
    const db = openBookDb(tmpDbPath)
    try {
      const tables = db.all(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('pages', 'node_data', 'step_runs')",
      ) as Array<{ name: string }>
      const tableNames = new Set(tables.map((t) => t.name))

      if (!tableNames.has("pages") || !tableNames.has("node_data")) {
        validationError = "The database does not contain the expected ADT tables. This may not be a valid ADT Studio project."
      } else {
        const pages = db.all("SELECT COUNT(*) as count FROM pages") as Array<{ count: number }>
        pageCount = pages[0]?.count ?? 0

        if (pageCount === 0) {
          validationError = "The database contains no pages. This project may be incomplete or corrupted."
        }

        const metaRows = db.all(
          "SELECT data FROM node_data WHERE node = ? AND item_id = ? ORDER BY version DESC LIMIT 1",
          ["metadata", "book"],
        ) as Array<{ data: string }>
        if (metaRows.length > 0) {
          const parsed = BookMetadata.safeParse(JSON.parse(metaRows[0].data))
          if (parsed.success) {
            title = parsed.data.title
            authors = parsed.data.authors
            publisher = parsed.data.publisher
            languageCode = parsed.data.language_code
          }
        }

        if (tableNames.has("step_runs")) {
          const stepRuns = db.all("SELECT step, status FROM step_runs") as Array<{
            step: string
            status: string
          }>

          for (const stage of PIPELINE) {
            const stageSteps: string[] = stage.steps.map((s) => s.name)
            const matching = stepRuns.filter((r) => stageSteps.includes(r.step))
            stages[stage.name] = {
              status: matching.length === 0
                ? "pending"
                : matching.every((r) => r.status === "done")
                  ? "done"
                  : matching.some((r) => r.status === "error")
                    ? "error"
                    : matching.some((r) => r.status === "running")
                      ? "running"
                      : "partial",
              stepCount: stageSteps.length,
              doneCount: matching.filter((r) => r.status === "done").length,
            }
          }
        }
      }
    } finally {
      db.close()
    }
  } catch {
    validationError = "Could not read the project database. The file may be corrupted or not a valid ADT Studio project."
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch { /* ignore */ }
  }

  return {
    label: safeLabel,
    title,
    authors,
    publisher,
    languageCode,
    pageCount,
    hasSourcePdf: hasPdf,
    imageCount,
    videoCount,
    coverBase64,
    stages,
    validationError,
  }
}

export async function importProject(
  zipBuffer: Buffer,
  booksDir: string,
): Promise<ImportResult> {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(zipBuffer)
  } catch {
    throw new Error("Invalid ZIP file")
  }

  const filePaths = Object.keys(entries)

  const dbEntry = filePaths.find((p) => p.endsWith(".db") && !p.includes("/"))
  if (!dbEntry) {
    throw new Error("Invalid project archive: missing database file (.db) at root level")
  }

  const rawLabel = dbEntry.replace(/\.db$/, "")

  const pdfEntry = filePaths.find((p) => p.endsWith(".pdf") && !p.includes("/"))
  if (!pdfEntry) {
    throw new Error("Invalid project archive: missing PDF file at root level")
  }

  const safeLabel = parseBookLabel(rawLabel)
  const targetLabel = resolveUniqueLabel(safeLabel, booksDir)
  const resolvedDir = path.resolve(booksDir)
  const bookDir = path.join(resolvedDir, targetLabel)

  fs.mkdirSync(bookDir, { recursive: true })

  try {
    for (const [entryPath, data] of Object.entries(entries)) {
      const renamedPath = entryPath.startsWith(`${rawLabel}.`)
        ? entryPath.replace(rawLabel, targetLabel)
        : entryPath

      const destPath = path.join(bookDir, renamedPath)

      if (!destPath.startsWith(bookDir + path.sep) && destPath !== bookDir) {
        throw new Error("Invalid project archive: contains paths that escape the project directory")
      }

      const destDir = path.dirname(destPath)
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true })
      }

      fs.writeFileSync(destPath, data)
    }

    const dbPath = path.join(bookDir, `${targetLabel}.db`)
    const db = openBookDb(dbPath)
    try {
      const tables = db.all(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('pages', 'node_data')",
      ) as Array<{ name: string }>
      const tableNames = new Set(tables.map((t) => t.name))

      if (!tableNames.has("pages") || !tableNames.has("node_data")) {
        throw new Error("Invalid project archive: database does not contain expected ADT tables")
      }

      const pages = db.all("SELECT COUNT(*) as count FROM pages") as Array<{ count: number }>
      if ((pages[0]?.count ?? 0) === 0) {
        throw new Error("Invalid project archive: database contains no pages")
      }
    } finally {
      db.close()
    }

    return {
      label: targetLabel,
      title: null,
      authors: [],
      publisher: null,
      languageCode: null,
      pageCount: 0,
      hasSourcePdf: fs.existsSync(path.join(bookDir, `${targetLabel}.pdf`)),
      needsRebuild: false,
      rebuildReason: null,
    }
  } catch (err) {
    try {
      fs.rmSync(bookDir, { recursive: true, force: true })
    } catch { /* ignore */ }
    throw err
  }
}
