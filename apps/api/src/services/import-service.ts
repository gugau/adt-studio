import fs from "node:fs"
import path from "node:path"
import { unzipSync } from "fflate"
import { parseBookLabel } from "@adt/types"
import type { BookSummary } from "./book-service.js"

export interface ImportResult extends BookSummary {}

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
        // TODO: throw an error instead of silently skipping — the user should know their archive contains suspicious paths
        continue
      }

      const destDir = path.dirname(destPath)
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true })
      }

      fs.writeFileSync(destPath, data)
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
    } catch { /* preserve original error */ }
    throw err
  }
}
