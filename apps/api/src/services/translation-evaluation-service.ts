import fs from "node:fs"
import path from "node:path"
import {
  TranslationEvaluationResult as TranslationEvaluationResultSchema,
  parseBookLabel,
  type TranslationEvaluationResult,
} from "@adt/types"
import { createBookStorage, openBookDb } from "@adt/storage"
import { HTTPException } from "hono/http-exception"
import { type ZodType } from "zod"

export const TRANSLATION_EVALUATION_NODE = "translation-evaluation"

export interface VersionedTranslationEvaluationResult {
  version: number
  evaluation: TranslationEvaluationResult
}

export interface TranslationEvaluationStatus {
  language: string
  currentSourceCatalogVersion: number | null
  currentTranslationVersion: number | null
  evaluationVersion: number | null
  evaluation: TranslationEvaluationResult | null
  isStale: boolean
}

function getDbPath(label: string, booksDir: string): { safeLabel: string; dbPath: string } {
  const safeLabel = parseBookLabel(label)
  const dbPath = path.join(path.resolve(booksDir), safeLabel, `${safeLabel}.db`)
  return { safeLabel, dbPath }
}

function ensureBookExists(dbPath: string, safeLabel: string) {
  if (!fs.existsSync(dbPath)) {
    throw new HTTPException(404, { message: `Book not found: ${safeLabel}` })
  }
}

function parseLatestRows<T>(
  dbPath: string,
  node: string,
  schema: ZodType<T>,
): Array<{ itemId: string; version: number; data: T }> {
  const db = openBookDb(dbPath)
  try {
    const rows = db.all(
      `SELECT current.item_id as item_id, current.version as version, current.data as data
       FROM node_data current
       INNER JOIN (
         SELECT item_id, MAX(version) as max_version
         FROM node_data
         WHERE node = ?
         GROUP BY item_id
       ) latest
       ON current.item_id = latest.item_id AND current.version = latest.max_version
       WHERE current.node = ?
       ORDER BY current.item_id ASC`,
      [node, node],
    ) as Array<{ item_id: string; version: number; data: string }>

    return rows.map((row) => ({
      itemId: row.item_id,
      version: row.version,
      data: schema.parse(JSON.parse(row.data)),
    }))
  } finally {
    db.close()
  }
}

function getLatestNodeVersion(
  dbPath: string,
  node: string,
  itemId: string,
): number | null {
  const db = openBookDb(dbPath)
  try {
    const rows = db.all(
      "SELECT version FROM node_data WHERE node = ? AND item_id = ? ORDER BY version DESC LIMIT 1",
      [node, itemId],
    ) as Array<{ version: number }>
    return rows[0]?.version ?? null
  } finally {
    db.close()
  }
}

function getLatestNodeVersions(dbPath: string, node: string): Map<string, number> {
  const db = openBookDb(dbPath)
  try {
    const rows = db.all(
      `SELECT current.item_id as item_id, current.version as version
       FROM node_data current
       INNER JOIN (
         SELECT item_id, MAX(version) as max_version
         FROM node_data
         WHERE node = ?
         GROUP BY item_id
       ) latest
       ON current.item_id = latest.item_id AND current.version = latest.max_version
       WHERE current.node = ?
       ORDER BY current.item_id ASC`,
      [node, node],
    ) as Array<{ item_id: string; version: number }>

    return new Map(rows.map((row) => [row.item_id, row.version]))
  } finally {
    db.close()
  }
}

function buildEvaluationStatus(
  language: string,
  currentSourceCatalogVersion: number | null,
  currentTranslationVersion: number | null,
  evaluationRow?: { version: number; data: TranslationEvaluationResult },
): TranslationEvaluationStatus {
  const evaluation = evaluationRow?.data ?? null
  const evaluationVersion = evaluationRow?.version ?? null
  const isStale = evaluation !== null && (
    currentSourceCatalogVersion === null ||
    currentTranslationVersion === null ||
    evaluation.source_catalog_version !== currentSourceCatalogVersion ||
    evaluation.translation_version !== currentTranslationVersion
  )

  return {
    language,
    currentSourceCatalogVersion,
    currentTranslationVersion,
    evaluationVersion,
    evaluation,
    isStale,
  }
}

export function listTranslationEvaluationStatuses(
  label: string,
  booksDir: string,
): TranslationEvaluationStatus[] {
  const { safeLabel, dbPath } = getDbPath(label, booksDir)
  ensureBookExists(dbPath, safeLabel)

  const evaluationRows = parseLatestRows(
    dbPath,
    TRANSLATION_EVALUATION_NODE,
    TranslationEvaluationResultSchema,
  )
  const evaluationByLanguage = new Map(evaluationRows.map((row) => [row.itemId, row]))
  const translationVersions = getLatestNodeVersions(dbPath, "text-catalog-translation")
  const currentSourceCatalogVersion = getLatestNodeVersion(dbPath, "text-catalog", "book")
  const languages = new Set<string>([
    ...translationVersions.keys(),
    ...evaluationByLanguage.keys(),
  ])

  return [...languages]
    .sort((left, right) => left.localeCompare(right))
    .map((language) => buildEvaluationStatus(
      language,
      currentSourceCatalogVersion,
      translationVersions.get(language) ?? null,
      evaluationByLanguage.get(language),
    ))
}

export function getTranslationEvaluationStatus(
  label: string,
  booksDir: string,
  language: string,
): TranslationEvaluationStatus | null {
  const { safeLabel, dbPath } = getDbPath(label, booksDir)
  ensureBookExists(dbPath, safeLabel)

  const evaluationRows = parseLatestRows(
    dbPath,
    TRANSLATION_EVALUATION_NODE,
    TranslationEvaluationResultSchema,
  )
  const evaluationRow = evaluationRows.find((row) => row.itemId === language)
  const currentTranslationVersion = getLatestNodeVersion(dbPath, "text-catalog-translation", language)
  const currentSourceCatalogVersion = getLatestNodeVersion(dbPath, "text-catalog", "book")

  if (!evaluationRow && currentTranslationVersion === null) {
    return null
  }

  return buildEvaluationStatus(
    language,
    currentSourceCatalogVersion,
    currentTranslationVersion,
    evaluationRow,
  )
}

export function saveTranslationEvaluationResult(
  label: string,
  booksDir: string,
  evaluation: TranslationEvaluationResult,
): VersionedTranslationEvaluationResult {
  const { safeLabel, dbPath } = getDbPath(label, booksDir)
  ensureBookExists(dbPath, safeLabel)

  const storage = createBookStorage(safeLabel, booksDir)
  try {
    const parsed = TranslationEvaluationResultSchema.parse(evaluation)
    const version = storage.putNodeData(TRANSLATION_EVALUATION_NODE, parsed.language, parsed)
    return { version, evaluation: parsed }
  } finally {
    storage.close()
  }
}
