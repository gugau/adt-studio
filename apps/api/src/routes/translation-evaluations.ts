import crypto from "node:crypto"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import { createBookStorage } from "@adt/storage"
import { loadBookConfig } from "@adt/pipeline"
import {
  resolveTranslationEvaluationConfig,
  parseBookLabel,
  TextCatalogOutput,
  type TranslationEvaluationRunRequest,
} from "@adt/types"
import type { EvalServiceClient } from "../services/eval-service-client.js"
import { saveTranslationEvaluationResult } from "../services/translation-evaluation-service.js"
import type { TaskService } from "../services/task-service.js"
import {
  getTranslationEvaluationStatus,
  listTranslationEvaluationStatuses,
} from "../services/translation-evaluation-service.js"

const TranslationEvaluationLanguageParam = z.string().min(1)

function safeParseLabel(label: string): string {
  try {
    return parseBookLabel(label)
  } catch (err) {
    throw new HTTPException(400, {
      message: err instanceof Error ? err.message : String(err),
    })
  }
}

function isTranslationEvaluationEnabled(booksDir: string, configPath: string | undefined, label: string): boolean {
  if (!configPath) return false
  const config = loadBookConfig(label, booksDir, configPath)
  return resolveTranslationEvaluationConfig(config.translation_evaluation).enable_translation_evaluation
}

function parseLanguage(language: string): string {
  const parsed = TranslationEvaluationLanguageParam.safeParse(language)
  if (!parsed.success) {
    throw new HTTPException(400, {
      message: parsed.error.message,
    })
  }
  return parsed.data
}

function buildEvalConfigHash(config: {
  evaluation_scope_mode?: string
  evaluation_scope_count?: number | null
  sampling_method?: string
  sampling_seed?: number | null
  judge_model?: string
  max_retries?: number
  batch_size?: number
  judge_instructions?: string
  additional_guidance?: string | null
}): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({
      evaluation_scope_mode: config.evaluation_scope_mode ?? null,
      evaluation_scope_count: config.evaluation_scope_count ?? null,
      sampling_method: config.sampling_method ?? null,
      sampling_seed: config.sampling_seed ?? null,
      judge_model: config.judge_model ?? null,
      max_retries: config.max_retries ?? null,
      batch_size: config.batch_size ?? null,
      judge_instructions: config.judge_instructions ?? null,
      additional_guidance: config.additional_guidance ?? null,
    }))
    .digest("hex")
}

function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function selectEntries(
  entries: TranslationEvaluationRunRequest["entries"],
  scopeMode: "all" | "sample",
  scopeCount: number | null,
  samplingMethod: "random" | "sequential",
  samplingSeed: number | null,
): TranslationEvaluationRunRequest["entries"] {
  if (scopeMode === "all" || scopeCount === null || scopeCount >= entries.length) {
    return entries
  }
  if (samplingMethod === "sequential") {
    return entries.slice(0, scopeCount)
  }

  const random = seededRandom(samplingSeed ?? Date.now())
  const shuffled = [...entries]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled.slice(0, scopeCount)
}

function buildTranslationEvaluationRunRequest(options: {
  booksDir: string
  configPath?: string
  label: string
  language: string
}): TranslationEvaluationRunRequest {
  const storage = createBookStorage(options.label, options.booksDir)
  try {
    const config = options.configPath
      ? loadBookConfig(options.label, options.booksDir, options.configPath)
      : null

    const sourceRow = storage.getLatestNodeData("text-catalog", "book")
    if (!sourceRow) {
      throw new Error("Text catalog not found for this book")
    }
    const parsedSource = TextCatalogOutput.safeParse(sourceRow.data)
    if (!parsedSource.success) {
      throw new Error("Stored text catalog data is invalid")
    }

    const translationRow = storage.getLatestNodeData("text-catalog-translation", options.language)
    if (!translationRow) {
      throw new Error(`Translated text catalog not found for language: ${options.language}`)
    }
    const parsedTranslation = TextCatalogOutput.safeParse(translationRow.data)
    if (!parsedTranslation.success) {
      throw new Error(`Stored translated text catalog data is invalid for language: ${options.language}`)
    }

    const resolvedConfig = resolveTranslationEvaluationConfig(config?.translation_evaluation)

    const metadataRow = storage.getLatestNodeData("metadata", "book")
    const metadata = metadataRow?.data as { language_code?: string | null } | null
    const sourceLanguage = config?.editing_language ?? metadata?.language_code ?? undefined
    const translationEntries = new Map(
      parsedTranslation.data.entries.map((entry) => [entry.id, entry.text]),
    )

    const entries = parsedSource.data.entries.map((entry) => {
      const translatedText = translationEntries.get(entry.id)
      if (translatedText === undefined) {
        throw new Error(`Translated text catalog is missing entry: ${entry.id}`)
      }
      return {
        entry_id: entry.id,
        source_text: entry.text,
        translated_text: translatedText,
      }
    })

    const selectedEntries = selectEntries(
      entries,
      resolvedConfig.evaluation_scope_mode,
      resolvedConfig.evaluation_scope_count,
      resolvedConfig.sampling_method,
      resolvedConfig.sampling_seed,
    )

    return {
      book_label: options.label,
      language: options.language,
      source_language: sourceLanguage ?? undefined,
      source_catalog_version: sourceRow.version,
      translation_version: translationRow.version,
      eval_config_hash: buildEvalConfigHash({
        evaluation_scope_mode: resolvedConfig.evaluation_scope_mode,
        evaluation_scope_count: resolvedConfig.evaluation_scope_count,
        sampling_method: resolvedConfig.sampling_method,
        sampling_seed: resolvedConfig.sampling_seed,
        judge_model: resolvedConfig.judge_model,
        max_retries: resolvedConfig.max_retries,
        batch_size: resolvedConfig.batch_size,
        judge_instructions: resolvedConfig.judge_instructions,
        additional_guidance: resolvedConfig.additional_guidance,
      }),
      judge_model: resolvedConfig.judge_model,
      max_retries: resolvedConfig.max_retries,
      evaluation_scope_mode: resolvedConfig.evaluation_scope_mode,
      ...(resolvedConfig.evaluation_scope_count !== null
        ? { evaluation_scope_count: resolvedConfig.evaluation_scope_count }
        : {}),
      sampling_method: resolvedConfig.sampling_method,
      ...(resolvedConfig.sampling_seed !== null
        ? { sampling_seed: resolvedConfig.sampling_seed }
        : {}),
      batch_size: resolvedConfig.batch_size,
      judge_instructions: resolvedConfig.judge_instructions,
      ...(resolvedConfig.additional_guidance
        ? { additional_guidance: resolvedConfig.additional_guidance }
        : {}),
      sample_size: resolvedConfig.evaluation_scope_mode === "sample"
        ? (resolvedConfig.evaluation_scope_count ?? undefined)
        : undefined,
      entries: selectedEntries,
    }
  } finally {
    storage.close()
  }
}

function assertMatchingEvaluationResult(
  request: TranslationEvaluationRunRequest,
  result: {
    language: string
    source_catalog_version: number
    translation_version: number
    eval_config_hash: string
  },
): void {
  if (result.language !== request.language) {
    throw new Error("Eval service returned a mismatched language")
  }
  if (result.source_catalog_version !== request.source_catalog_version) {
    throw new Error("Eval service returned a mismatched source catalog version")
  }
  if (result.translation_version !== request.translation_version) {
    throw new Error("Eval service returned a mismatched translation version")
  }
  if (result.eval_config_hash !== request.eval_config_hash) {
    throw new Error("Eval service returned a mismatched evaluation config hash")
  }
}

export function createTranslationEvaluationRoutes(
  booksDir: string,
  configPath?: string,
  taskService?: TaskService,
  evalServiceClient?: EvalServiceClient,
): Hono {
  const app = new Hono()

  app.get("/books/:label/evaluations/translations", (c) => {
    const { label } = c.req.param()
    const safeLabel = safeParseLabel(label)
    const evaluations = listTranslationEvaluationStatuses(safeLabel, booksDir)
    return c.json({ evaluations })
  })

  app.get("/books/:label/evaluations/translations/:language", (c) => {
    const { label, language } = c.req.param()
    const safeLabel = safeParseLabel(label)
    const safeLanguage = parseLanguage(language)
    const evaluation = getTranslationEvaluationStatus(safeLabel, booksDir, safeLanguage)
    if (!evaluation) {
      throw new HTTPException(404, {
        message: `Translation evaluation not found for language: ${safeLanguage}`,
      })
    }
    return c.json(evaluation)
  })

  app.post("/books/:label/evaluations/translations/:language/run", (c) => {
    const { label, language } = c.req.param()
    const safeLabel = safeParseLabel(label)
    const safeLanguage = parseLanguage(language)

    if (!isTranslationEvaluationEnabled(booksDir, configPath, safeLabel)) {
      throw new HTTPException(409, {
        message: "Translation evaluation is disabled for this book",
      })
    }

    const evaluation = getTranslationEvaluationStatus(safeLabel, booksDir, safeLanguage)
    if (!evaluation || evaluation.currentTranslationVersion === null) {
      throw new HTTPException(404, {
        message: `Translated text catalog not found for language: ${safeLanguage}`,
      })
    }
    if (evaluation.currentSourceCatalogVersion === null) {
      throw new HTTPException(409, {
        message: "Text catalog not found for this book",
      })
    }

    if (!evalServiceClient) {
      throw new HTTPException(503, {
        message: "Translation evaluation service is not configured",
      })
    }

    if (!taskService) {
      throw new HTTPException(501, {
        message: "Translation evaluation task submission is not implemented yet",
      })
    }

    const { taskId } = taskService.submitTask(
      safeLabel,
      "translation-evaluation",
      `Running translation evaluation for ${safeLanguage}`,
      async (emitProgress) => {
        emitProgress("Preparing translation evaluation payload", 10)
        const request = buildTranslationEvaluationRunRequest({
          booksDir,
          configPath,
          label: safeLabel,
          language: safeLanguage,
        })

        emitProgress("Submitting translation evaluation", 40)
        const result = await evalServiceClient.evaluateTranslation(request)
        assertMatchingEvaluationResult(request, result)

        emitProgress("Saving translation evaluation result", 80)
        const saved = saveTranslationEvaluationResult(safeLabel, booksDir, result)

        emitProgress("Translation evaluation completed", 100)
        return {
          language: safeLanguage,
          version: saved.version,
        }
      },
      {
        url: `/books/${safeLabel}/validation`,
      },
    )

    return c.json({
      status: "submitted",
      taskId,
      label: safeLabel,
      language: safeLanguage,
    })
  })

  return app
}
