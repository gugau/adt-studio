import fs from "node:fs"
import path from "node:path"
import { Zip, ZipDeflate, ZipPassThrough } from "fflate"
import { HTTPException } from "hono/http-exception"
import { parseBookLabel } from "@adt/types"
import { createBookStorage } from "@adt/storage"
import { packageAdtWeb, packageWebpub, loadBookConfig, normalizeLocale } from "@adt/pipeline"

/** File extensions that are already compressed — skip deflation to save CPU */
const COMPRESSED_EXTS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif",
  ".mp3", ".mp4", ".ogg", ".wav", ".aac", ".m4a", ".opus", ".flac",
  ".zip", ".gz", ".br", ".zst",
  ".woff", ".woff2",
  ".pdf", ".db",
])

export interface ExportResult {
  stream: ReadableStream<Uint8Array>
  filename: string
  safeFilename: string
}

function throwBookNotFound(label: string): never {
  throw new HTTPException(404, { message: `Book not found: ${label}` })
}

function throwWebAssetsMissing(): never {
  throw new HTTPException(500, { message: "Web assets directory not found" })
}

function throwAdtDirMissing(): never {
  throw new HTTPException(400, { message: "ADT directory not found — run the pipeline first" })
}

/**
 * Read book title from metadata for use in export filenames.
 * Falls back to the safe label if metadata is not available.
 */
function readBookTitle(label: string, resolvedDir: string): string {
  const storage = createBookStorage(label, resolvedDir)
  try {
    const metadataRow = storage.getLatestNodeData("metadata", "book")
    const metadata = metadataRow?.data as { title?: string | null } | null
    return metadata?.title ?? label
  } finally {
    storage.close()
  }
}

export interface ExportFeatures {
  glossary?: boolean
  readAloud?: boolean
  quizzes?: boolean
  signLanguage?: boolean
  languages?: string[]
}

/**
 * Prepare export by rebuilding the adt/ (and optionally webpub/) directories.
 * Called as a separate step before the actual download so the client can show
 * a spinner during the rebuild.
 */
export async function prepareExport(
  label: string,
  format: "project" | "webpub" | "scorm" | "adt",
  booksDir: string,
  webAssetsDir: string,
  configPath?: string,
  features?: ExportFeatures,
): Promise<void> {
  const safeLabel = parseBookLabel(label)
  const resolvedDir = path.resolve(booksDir)
  const bookDir = path.join(resolvedDir, safeLabel)

  if (!fs.existsSync(bookDir)) {
    throwBookNotFound(safeLabel)
  }
  if (!webAssetsDir || !fs.existsSync(webAssetsDir)) {
    throwWebAssetsMissing()
  }

  const storage = createBookStorage(safeLabel, resolvedDir)
  try {
    const config = loadBookConfig(safeLabel, resolvedDir, configPath)
    const metadataRow = storage.getLatestNodeData("metadata", "book")
    const metadata = metadataRow?.data as {
      title?: string | null
      language_code?: string | null
    } | null
    const language = normalizeLocale(config.editing_language ?? metadata?.language_code ?? "en")
    const outputLanguages = Array.from(
      new Set(
        (config.output_languages && config.output_languages.length > 0
          ? config.output_languages
          : [language]).map((code) => normalizeLocale(code))
      )
    )
    const title = metadata?.title ?? safeLabel

    const requestedLanguages = features?.languages
    const finalLanguages = requestedLanguages && requestedLanguages.length > 0
      ? requestedLanguages.filter((lang) => outputLanguages.includes(normalizeLocale(lang))).map(normalizeLocale)
      : outputLanguages

    const opts = {
      bookDir,
      label: safeLabel,
      language,
      outputLanguages: finalLanguages.length > 0 ? finalLanguages : outputLanguages,
      title,
      webAssetsDir,
      applyBodyBackground: config.apply_body_background,
      features,
    }

    await packageAdtWeb(storage, opts)

    if (format === "webpub") {
      packageWebpub(storage, opts)
    }
  } finally {
    storage.close()
  }
}

export async function exportProject(
  label: string,
  booksDir: string,
): Promise<ExportResult> {
  const safeLabel = parseBookLabel(label)
  const resolvedDir = path.resolve(booksDir)
  const bookDir = path.join(resolvedDir, safeLabel)

  if (!fs.existsSync(bookDir)) {
    throwBookNotFound(safeLabel)
  }

  const title = readBookTitle(safeLabel, resolvedDir)

  return {
    stream: createZipStream(bookDir, new Set(["adt", "webpub"])),
    filename: `${title}-project.zip`,
    safeFilename: `${safeLabel}-project.zip`,
  }
}

export async function exportWebpub(
  label: string,
  booksDir: string,
): Promise<ExportResult> {
  const safeLabel = parseBookLabel(label)
  const resolvedDir = path.resolve(booksDir)
  const bookDir = path.join(resolvedDir, safeLabel)

  if (!fs.existsSync(bookDir)) {
    throwBookNotFound(safeLabel)
  }

  const title = readBookTitle(safeLabel, resolvedDir)
  const webpubDir = path.join(bookDir, "webpub")

  return {
    stream: createZipStream(webpubDir),
    filename: `${title}.webpub`,
    safeFilename: `${safeLabel}.webpub`,
  }
}

export async function exportScorm(
  label: string,
  booksDir: string,
): Promise<ExportResult> {
  const safeLabel = parseBookLabel(label)
  const resolvedDir = path.resolve(booksDir)
  const bookDir = path.join(resolvedDir, safeLabel)

  if (!fs.existsSync(bookDir)) {
    throwBookNotFound(safeLabel)
  }

  const title = readBookTitle(safeLabel, resolvedDir)
  const adtDir = path.join(bookDir, "adt")
  if (!fs.existsSync(adtDir)) {
    throwAdtDirMissing()
  }

  return {
    stream: createZipStream(adtDir),
    filename: `${title}-scorm.zip`,
    safeFilename: `${safeLabel}-scorm.zip`,
  }
}

export async function exportAdt(
  label: string,
  booksDir: string,
): Promise<ExportResult> {
  const safeLabel = parseBookLabel(label)
  const resolvedDir = path.resolve(booksDir)
  const bookDir = path.join(resolvedDir, safeLabel)

  if (!fs.existsSync(bookDir)) {
    throwBookNotFound(safeLabel)
  }

  const title = readBookTitle(safeLabel, resolvedDir)
  const adtDir = path.join(bookDir, "adt")
  if (!fs.existsSync(adtDir)) {
    throwAdtDirMissing()
  }

  return {
    stream: createZipStream(adtDir),
    filename: `${title}-adt.zip`,
    safeFilename: `${safeLabel}-adt.zip`,
  }
}

/**
 * Collect relative file paths under a directory (lightweight — no file content read).
 */
function collectFilePaths(dir: string, prefix = "", excludeDirs?: Set<string>): string[] {
  const result: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const zipPath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      if (excludeDirs && !prefix && excludeDirs.has(entry.name)) continue
      result.push(...collectFilePaths(path.join(dir, entry.name), zipPath, excludeDirs))
    } else if (entry.isFile()) {
      result.push(zipPath)
    }
  }
  return result
}

/**
 * Create a streaming ZIP of a directory. Files are read and compressed one at a
 * time so memory stays bounded regardless of total directory size.
 */
function createZipStream(sourceDir: string, excludeDirs?: Set<string>): ReadableStream<Uint8Array> {
  const filePaths = collectFilePaths(sourceDir, "", excludeDirs)

  return new ReadableStream({
    async start(controller) {
      const zip = new Zip((err, chunk, final) => {
        if (err) { controller.error(err); return }
        if (chunk.length > 0) controller.enqueue(chunk)
        if (final) controller.close()
      })

      for (let i = 0; i < filePaths.length; i++) {
        const relPath = filePaths[i]
        const absPath = path.join(sourceDir, relPath)
        const data = new Uint8Array(fs.readFileSync(absPath))
        const ext = path.extname(relPath).toLowerCase()

        const file = COMPRESSED_EXTS.has(ext)
          ? new ZipPassThrough(relPath)
          : new ZipDeflate(relPath, { level: 6 })

        zip.add(file)
        file.push(data, true)

        // Yield to event loop every 50 files to avoid blocking
        if (i % 50 === 49) {
          await new Promise(resolve => setTimeout(resolve, 0))
        }
      }
      zip.end()
    },
  })
}
