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
  type TranslationEvaluationIssueType as TranslationEvaluationIssueTypeData,
  type TranslationEvaluationResult as TranslationEvaluationResultData,
  type TranslationEvaluationRunEntry,
  type TranslationEvaluationRunRequest as TranslationEvaluationRunRequestData,
} from "@adt/types"
import type { TaskProgressEmitter } from "./task-service.js"

const ISSUE_TYPES: TranslationEvaluationIssueTypeData[] = [
  "meaning",
  "fluency",
  "terminology",
  "omission-or-addition",
  "formatting",
  "other",
]

const TranslationEvaluationJudgeOutput = z.object({
  acceptable: z.boolean(),
  rationale: z.string().min(1),
  issue_types: z.array(TranslationEvaluationIssueType),
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
  if (request.additional_guidance?.trim()) {
    return `${base}\n\nAdditional guidance:\n${request.additional_guidance.trim()}`
  }
  return base
}

function buildSystemPrompt(instructions: string): string {
  return `
${instructions}

You are evaluating one translated text-catalog entry.
Return structured JSON only.

Decision rules:
- acceptable=true means the translation is acceptable overall.
- acceptable=false means the translation needs review.
- Always include issue_types. Use [] when acceptable=true.
- If acceptable=false, include one or more issue_types from: ${ISSUE_TYPES.join(", ")}.
- If no issue type clearly applies, use "other".
- Keep the rationale concise and specific.
`.trim()
}

function buildUserPrompt(entry: TranslationEvaluationRunEntry, request: TranslationEvaluationRunRequestData): string {
  return `
Entry ID: ${entry.entry_id}
Source language: ${request.source_language || "unknown"}
Target language: ${request.language}

Source text:
${entry.source_text}

Translated text:
${entry.translated_text}
`.trim()
}

function normalizeJudgeOutput(
  entry: TranslationEvaluationRunEntry,
  output: TranslationEvaluationJudgeOutput,
) {
  const issueTypes = output.acceptable
    ? []
    : output.issue_types && output.issue_types.length > 0
      ? output.issue_types
      : ["other" as const]

  return {
    entry_id: entry.entry_id,
    acceptable: output.acceptable,
    source_text: entry.source_text,
    translated_text: entry.translated_text,
    rationale: output.rationale.trim(),
    issue_types: issueTypes,
  }
}

function buildFailedEvaluationItem(entry: TranslationEvaluationRunEntry, err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  return {
    entry_id: entry.entry_id,
    acceptable: false,
    source_text: entry.source_text,
    translated_text: entry.translated_text,
    rationale: `Translation judge failed: ${message}`,
    issue_types: ["other" as const],
  }
}

function setOpenAIKey(apiKey: string): () => void {
  const previous = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = apiKey
  return () => {
    if (previous !== undefined) {
      process.env.OPENAI_API_KEY = previous
    } else {
      delete process.env.OPENAI_API_KEY
    }
  }
}

function chunkEntries<T>(entries: T[], batchSize: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < entries.length; index += batchSize) {
    chunks.push(entries.slice(index, index + batchSize))
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
  const restoreOpenAIKey = setOpenAIKey(apiKey)

  try {
    const onLog = (entry: LlmLogEntry) => storage.appendLlmLog(entry)
    const llmModel = options.createModel
      ? options.createModel({ modelId, cacheDir, onLog })
      : createLLMModel({ modelId, cacheDir, onLog })
    const batches = chunkEntries(parsedRequest.entries, batchSize)
    const items: TranslationEvaluationResultData["items"] = []
    let failedItems = 0

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
      emitProgress?.(
        `Evaluating translation batch ${batchIndex + 1} of ${batches.length}`,
        40 + Math.round((batchIndex / Math.max(1, batches.length)) * 40),
      )

      for (const entry of batches[batchIndex]) {
        try {
          const result = await llmModel.generateObject<TranslationEvaluationJudgeOutput>({
            schema: TranslationEvaluationJudgeOutput,
            system,
            messages: [
              {
                role: "user",
                content: buildUserPrompt(entry, parsedRequest),
              },
            ],
            maxRetries,
            temperature: 0,
            log: {
              taskType: "translation-evaluation",
              pageId: entry.entry_id,
              promptName: "translation-evaluation-judge",
            },
          })
          items.push(normalizeJudgeOutput(entry, result.object))
        } catch (err) {
          failedItems += 1
          items.push(buildFailedEvaluationItem(entry, err))
        }
      }
    }

    const acceptableCount = items.filter((item) => item.acceptable).length
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
      },
      summary: {
        total: items.length,
        acceptable: acceptableCount,
        unacceptable: items.length - acceptableCount,
      },
      items,
      metadata: {
        failed_items: failedItems,
        selected_entry_count: parsedRequest.entries.length,
      },
    })

    emitProgress?.("Translation evaluation completed", 80)
    return result
  } finally {
    restoreOpenAIKey()
    storage.close()
  }
}

export const translationEvaluationRunnerInternals = {
  buildJudgeInstructions,
  buildSystemPrompt,
  buildUserPrompt,
  normalizeJudgeModel,
}
