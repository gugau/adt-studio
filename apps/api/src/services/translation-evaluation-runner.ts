import path from "node:path"
import { z } from "zod"
import { createLLMModel, type LLMModel, type LlmLogEntry } from "@adt/llm"
import { createBookStorage } from "@adt/storage"
import {
  DEFAULT_TRANSLATION_EVALUATION_BATCH_SIZE,
  DEFAULT_TRANSLATION_EVALUATION_JUDGE_INSTRUCTIONS,
  DEFAULT_TRANSLATION_EVALUATION_JUDGE_MODEL,
  DEFAULT_TRANSLATION_EVALUATION_MAX_RETRIES,
  TranslationEvaluationIssueType,
  TranslationEvaluationResult,
  TranslationEvaluationRunRequest,
  TranslationEvaluationSeverity,
  type TranslationEvaluationIssueType as TranslationEvaluationIssueTypeData,
  type TranslationEvaluationResult as TranslationEvaluationResultData,
  type TranslationEvaluationRunPage,
  type TranslationEvaluationRunRequest as TranslationEvaluationRunRequestData,
} from "@adt/types"
import type { TaskProgressEmitter } from "./task-service.js"

const ISSUE_TYPES: TranslationEvaluationIssueTypeData[] = [
  "meaning",
  "fluency",
  "terminology",
  "omission-or-addition",
  "formatting",
  "context",
  "other",
]

const TranslationEvaluationJudgeItem = z.object({
  entry_id: z.string().min(1),
  acceptable: z.boolean(),
  rationale: z.string().min(1),
  issue_types: z.array(TranslationEvaluationIssueType),
  severity: TranslationEvaluationSeverity.optional(),
  suggested_text: z.string().min(1).optional(),
})

const TranslationEvaluationJudgeOutput = z.object({
  items: z.array(TranslationEvaluationJudgeItem).min(1),
})
type TranslationEvaluationJudgeOutput = z.infer<typeof TranslationEvaluationJudgeOutput>

export interface TranslationEvaluationRunnerOptions {
  booksDir: string
  apiKey: string
  createModel?: (options: {
    modelId: string
    cacheDir: string
    onLog: (entry: LlmLogEntry) => void
  }) => LLMModel
}

function utcNow(): string {
  return new Date().toISOString()
}

function normalizeJudgeModel(modelId: string | undefined): string {
  const resolved = modelId?.trim() || DEFAULT_TRANSLATION_EVALUATION_JUDGE_MODEL
  return resolved.replace(/^([a-zA-Z0-9_-]+):\/+/, "$1:")
}

function buildJudgeInstructions(request: TranslationEvaluationRunRequestData): string {
  const base = (request.judge_instructions || DEFAULT_TRANSLATION_EVALUATION_JUDGE_INSTRUCTIONS).trim()
  const sections = [base, `Strictness: ${request.strictness ?? "balanced"}.`]
  if (request.target_audience?.trim()) {
    sections.push(`Target audience: ${request.target_audience.trim()}`)
  }
  if (request.style_guidance?.trim()) {
    sections.push(`Style guidance: ${request.style_guidance.trim()}`)
  }
  if (request.terminology_guidance?.trim()) {
    sections.push(`Terminology guidance: ${request.terminology_guidance.trim()}`)
  }
  if (request.additional_guidance?.trim()) {
    sections.push(`Additional guidance:\n${request.additional_guidance.trim()}`)
  }
  return sections.join("\n\n")
}

function buildSystemPrompt(instructions: string): string {
  return `
${instructions}

You are evaluating translated text-catalog entries for one visible book page.
Use all entries on the page as context when judging each individual entry.
Return structured JSON only.

Decision rules:
- acceptable=true means the entry can be used as-is.
- acceptable=false means the entry needs human attention.
- Always return one result for every entry_id provided.
- Always include issue_types. Use [] when acceptable=true.
- If acceptable=false, include one or more issue_types from: ${ISSUE_TYPES.join(", ")}.
- If no issue type clearly applies, use "other".
- If acceptable=false and a clear correction is possible, include suggested_text containing only the corrected target-language translation.
- Do not include suggested_text when acceptable=true.
- Keep rationale concise and specific; for acceptable entries, use a short confirmation.
`.trim()
}

function buildUserPrompt(page: TranslationEvaluationRunPage, request: TranslationEvaluationRunRequestData): string {
  return JSON.stringify({
    book: {
      metadata: request.book_metadata ?? null,
      source_language: request.source_language ?? "unknown",
      target_language: request.language,
    },
    page: {
      page_id: page.page_id,
      entries: page.entries.map((entry) => ({
        entry_id: entry.entry_id,
        source_text: entry.source_text,
        translated_text: entry.translated_text,
      })),
    },
  }, null, 2)
}

function normalizeJudgeOutput(
  page: TranslationEvaluationRunPage,
  output: TranslationEvaluationJudgeOutput,
) {
  const sourceById = new Map(page.entries.map((entry) => [entry.entry_id, entry]))
  const items = []
  const seen = new Set<string>()
  for (const outputItem of output.items) {
    const entry = sourceById.get(outputItem.entry_id)
    if (!entry) continue
    seen.add(outputItem.entry_id)
    const issueTypes = outputItem.acceptable
      ? []
      : outputItem.issue_types && outputItem.issue_types.length > 0
        ? outputItem.issue_types
        : ["other" as const]
    items.push({
      entry_id: entry.entry_id,
      acceptable: outputItem.acceptable,
      page_id: page.page_id,
      source_text: entry.source_text,
      translated_text: entry.translated_text,
      rationale: outputItem.rationale.trim(),
      issue_types: issueTypes,
      ...(outputItem.severity ? { severity: outputItem.severity } : {}),
      ...(entry.source_hash ? { source_hash: entry.source_hash } : {}),
      ...(entry.translated_hash ? { translated_hash: entry.translated_hash } : {}),
      ...(!outputItem.acceptable && outputItem.suggested_text?.trim()
        ? { suggested_text: outputItem.suggested_text.trim() }
        : {}),
    })
  }

  for (const entry of page.entries) {
    if (seen.has(entry.entry_id)) continue
    items.push({
      entry_id: entry.entry_id,
      acceptable: false,
      page_id: page.page_id,
      source_text: entry.source_text,
      translated_text: entry.translated_text,
      rationale: "Translation judge did not return a verdict for this entry.",
      issue_types: ["other" as const],
      severity: "medium" as const,
      ...(entry.source_hash ? { source_hash: entry.source_hash } : {}),
      ...(entry.translated_hash ? { translated_hash: entry.translated_hash } : {}),
    })
  }

  return items
}

function buildFailedEvaluationItems(page: TranslationEvaluationRunPage, err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  return page.entries.map((entry) => ({
    entry_id: entry.entry_id,
    acceptable: false,
    page_id: page.page_id,
    source_text: entry.source_text,
    translated_text: entry.translated_text,
    rationale: `Translation judge failed: ${message}`,
    issue_types: ["other" as const],
    severity: "medium" as const,
    ...(entry.source_hash ? { source_hash: entry.source_hash } : {}),
    ...(entry.translated_hash ? { translated_hash: entry.translated_hash } : {}),
  }))
}

function chunkPages<T>(pages: T[], batchSize: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < pages.length; index += batchSize) {
    chunks.push(pages.slice(index, index + batchSize))
  }
  return chunks
}

export async function evaluateTranslationInApi(
  request: TranslationEvaluationRunRequestData,
  options: TranslationEvaluationRunnerOptions,
  emitProgress?: TaskProgressEmitter,
): Promise<TranslationEvaluationResultData> {
  const parsedRequest = TranslationEvaluationRunRequest.parse(request)
  const apiKey = options.apiKey.trim()
  if (!apiKey) {
    throw new Error("OpenAI API key required for translation evaluation")
  }

  const modelId = normalizeJudgeModel(parsedRequest.judge_model)
  const instructions = buildJudgeInstructions(parsedRequest)
  const system = buildSystemPrompt(instructions)
  const batchSize = parsedRequest.batch_size ?? DEFAULT_TRANSLATION_EVALUATION_BATCH_SIZE
  const maxRetries = parsedRequest.max_retries ?? DEFAULT_TRANSLATION_EVALUATION_MAX_RETRIES
  const cacheDir = path.join(path.resolve(options.booksDir), parsedRequest.book_label, ".cache")
  const storage = createBookStorage(parsedRequest.book_label, options.booksDir)

  try {
    const previousOpenAIKey = process.env.OPENAI_API_KEY
    process.env.OPENAI_API_KEY = apiKey
    const onLog = (entry: LlmLogEntry) => storage.appendLlmLog(entry)
    const llmModel = options.createModel
      ? options.createModel({ modelId, cacheDir, onLog })
      : createLLMModel({ modelId, cacheDir, onLog })
    try {
      const pageBatches = chunkPages(parsedRequest.pages, batchSize)
      const items: TranslationEvaluationResultData["items"] = []
      let failedPages = 0
      let completedPages = 0
      const totalPages = parsedRequest.pages.length

      for (let batchIndex = 0; batchIndex < pageBatches.length; batchIndex += 1) {
        emitProgress?.(
          `Evaluating translation page batch ${batchIndex + 1} of ${pageBatches.length}`,
          40 + Math.round((batchIndex / Math.max(1, pageBatches.length)) * 40),
        )

        for (const page of pageBatches[batchIndex]) {
          try {
            const result = await llmModel.generateObject<TranslationEvaluationJudgeOutput>({
              schema: TranslationEvaluationJudgeOutput,
              system,
              messages: [
                {
                  role: "user",
                  content: buildUserPrompt(page, parsedRequest),
                },
              ],
              maxRetries,
              temperature: 0,
              log: {
                taskType: "translation-evaluation",
                pageId: page.page_id,
                promptName: "translation-evaluation-judge",
              },
            })
            items.push(...normalizeJudgeOutput(page, result.object))
          } catch (err) {
            failedPages += 1
            items.push(...buildFailedEvaluationItems(page, err))
          }
          completedPages += 1
          emitProgress?.(
            `Evaluated ${completedPages} of ${totalPages} pages`,
            40 + Math.round((completedPages / Math.max(1, totalPages)) * 40),
          )
        }
      }

      const acceptableCount = items.filter((item) => item.acceptable).length
      const selectedEntryIds = parsedRequest.pages.flatMap((page) => page.entries.map((entry) => entry.entry_id))
      const result = TranslationEvaluationResult.parse({
        generated_at: utcNow(),
        provider: "adt-llm",
        language: parsedRequest.language,
        ...(parsedRequest.source_language ? { source_language: parsedRequest.source_language } : {}),
        source_catalog_version: parsedRequest.source_catalog_version,
        translation_version: parsedRequest.translation_version,
        eval_config_hash: parsedRequest.eval_config_hash,
        judge: {
          model: modelId,
          instructions,
          additional_guidance: parsedRequest.additional_guidance ?? null,
          max_retries: maxRetries,
          batch_size: batchSize,
          strictness: parsedRequest.strictness ?? "balanced",
          target_audience: parsedRequest.target_audience ?? null,
          style_guidance: parsedRequest.style_guidance ?? null,
          terminology_guidance: parsedRequest.terminology_guidance ?? null,
        },
        summary: {
          total: items.length,
          acceptable: acceptableCount,
          unacceptable: items.length - acceptableCount,
        },
        items,
        metadata: {
          failed_pages: failedPages,
          selected_entry_count: selectedEntryIds.length,
          page_id: parsedRequest.pages.length === 1 ? parsedRequest.pages[0].page_id : null,
          selected_entry_ids: selectedEntryIds,
          book_metadata: parsedRequest.book_metadata ?? null,
        },
      })

      emitProgress?.("Translation evaluation completed", 80)
      return result
    } finally {
      if (previousOpenAIKey === undefined) {
        delete process.env.OPENAI_API_KEY
      } else {
        process.env.OPENAI_API_KEY = previousOpenAIKey
      }
    }
  } finally {
    storage.close()
  }
}

export const translationEvaluationRunnerInternals = {
  buildJudgeInstructions,
  buildSystemPrompt,
  buildUserPrompt,
  normalizeJudgeModel,
}
