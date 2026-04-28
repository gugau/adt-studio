import { z } from "zod"

export const DEFAULT_TRANSLATION_EVALUATION_JUDGE_INSTRUCTIONS = `
Review the translation in {{ outputs }} against the source content in {{ inputs }}.

Decide whether the translation is acceptable overall.
Use these criteria:
- preserve meaning faithfully
- sound fluent and natural in the target language
- keep important terminology correct and consistent
- avoid important omissions or unsupported additions
- preserve meaningful formatting markers and placeholders when they affect meaning

Return a concise rationale for your decision.
`.trim()

export const DEFAULT_TRANSLATION_EVALUATION_JUDGE_MODEL = "openai:/gpt-4.1-mini"
export const DEFAULT_TRANSLATION_EVALUATION_MAX_RETRIES = 3
export const DEFAULT_TRANSLATION_EVALUATION_SCOPE_MODE: TranslationEvaluationScopeMode = "all"
export const DEFAULT_TRANSLATION_EVALUATION_SAMPLING_METHOD: TranslationEvaluationSamplingMethod = "sequential"
export const DEFAULT_TRANSLATION_EVALUATION_BATCH_SIZE = 10

export const TranslationEvaluationScopeMode = z.enum(["all", "sample"])
export type TranslationEvaluationScopeMode = z.infer<typeof TranslationEvaluationScopeMode>

export const TranslationEvaluationSamplingMethod = z.enum(["random", "sequential"])
export type TranslationEvaluationSamplingMethod = z.infer<typeof TranslationEvaluationSamplingMethod>

export const TranslationEvaluationConfig = z.object({
  enable_translation_evaluation: z.boolean().optional(),
  enabled: z.boolean().optional(),
  judge_model: z.string().min(1).optional(),
  max_retries: z.number().int().min(0).optional(),
  evaluation_scope_mode: TranslationEvaluationScopeMode.optional(),
  evaluation_scope_count: z.number().int().min(1).optional(),
  sampling_method: TranslationEvaluationSamplingMethod.optional(),
  sampling_seed: z.number().int().optional(),
  batch_size: z.number().int().min(1).optional(),
  judge_instructions: z.string().min(1).optional(),
  additional_guidance: z.string().min(1).optional(),
  sample_size: z.number().int().min(1).optional(),
})
export type TranslationEvaluationConfig = z.infer<typeof TranslationEvaluationConfig>

export interface ResolvedTranslationEvaluationConfig {
  enable_translation_evaluation: boolean
  judge_model: string
  max_retries: number
  evaluation_scope_mode: TranslationEvaluationScopeMode
  evaluation_scope_count: number | null
  sampling_method: TranslationEvaluationSamplingMethod
  sampling_seed: number | null
  batch_size: number
  judge_instructions: string
  additional_guidance: string | null
}

export function resolveTranslationEvaluationConfig(
  config: TranslationEvaluationConfig | null | undefined,
): ResolvedTranslationEvaluationConfig {
  const evaluationScopeMode = config?.evaluation_scope_mode
    ?? (config?.sample_size !== undefined ? "sample" : DEFAULT_TRANSLATION_EVALUATION_SCOPE_MODE)
  const evaluationScopeCount = config?.evaluation_scope_count
    ?? config?.sample_size
    ?? null

  return {
    enable_translation_evaluation: config?.enable_translation_evaluation
      ?? config?.enabled
      ?? false,
    judge_model: config?.judge_model ?? DEFAULT_TRANSLATION_EVALUATION_JUDGE_MODEL,
    max_retries: config?.max_retries ?? DEFAULT_TRANSLATION_EVALUATION_MAX_RETRIES,
    evaluation_scope_mode: evaluationScopeMode,
    evaluation_scope_count: evaluationScopeCount,
    sampling_method: config?.sampling_method ?? DEFAULT_TRANSLATION_EVALUATION_SAMPLING_METHOD,
    sampling_seed: config?.sampling_seed ?? null,
    batch_size: config?.batch_size ?? DEFAULT_TRANSLATION_EVALUATION_BATCH_SIZE,
    judge_instructions: config?.judge_instructions ?? DEFAULT_TRANSLATION_EVALUATION_JUDGE_INSTRUCTIONS,
    additional_guidance: config?.additional_guidance ?? null,
  }
}

export const TranslationEvaluationIssueType = z.enum([
  "meaning",
  "fluency",
  "terminology",
  "omission-or-addition",
  "formatting",
  "other",
])
export type TranslationEvaluationIssueType = z.infer<typeof TranslationEvaluationIssueType>

export const TranslationEvaluationSummary = z
  .object({
    total: z.number().int().min(0),
    acceptable: z.number().int().min(0),
    unacceptable: z.number().int().min(0),
  })
  .superRefine((value, ctx) => {
    if (value.acceptable + value.unacceptable !== value.total) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["total"],
        message: "total must equal acceptable + unacceptable",
      })
    }
  })
export type TranslationEvaluationSummary = z.infer<typeof TranslationEvaluationSummary>

export const TranslationEvaluationItem = z.object({
  entry_id: z.string().min(1),
  acceptable: z.boolean(),
  source_text: z.string().optional(),
  translated_text: z.string().optional(),
  rationale: z.string().min(1),
  issue_types: z.array(TranslationEvaluationIssueType).optional(),
})
export type TranslationEvaluationItem = z.infer<typeof TranslationEvaluationItem>

export const TranslationEvaluationMlflowMetadata = z.object({
  run_id: z.string().min(1).optional(),
  experiment_id: z.string().min(1).optional(),
  url: z.string().min(1).optional(),
})
export type TranslationEvaluationMlflowMetadata = z.infer<typeof TranslationEvaluationMlflowMetadata>

export const TranslationEvaluationProvider = z.enum(["adt-llm", "mlflow"])
export type TranslationEvaluationProvider = z.infer<typeof TranslationEvaluationProvider>

export const TranslationEvaluationJudgeMetadata = z.object({
  model: z.string().min(1),
  instructions: z.string().min(1),
  additional_guidance: z.string().min(1).nullable().optional(),
  max_retries: z.number().int().min(0).optional(),
  batch_size: z.number().int().min(1).optional(),
})
export type TranslationEvaluationJudgeMetadata = z.infer<typeof TranslationEvaluationJudgeMetadata>

export const TranslationEvaluationMetadata = z.object({
  failed_items: z.number().int().min(0).optional(),
  selected_entry_count: z.number().int().min(0).optional(),
})
export type TranslationEvaluationMetadata = z.infer<typeof TranslationEvaluationMetadata>

export const TranslationEvaluationRunEntry = z.object({
  entry_id: z.string().min(1),
  source_text: z.string(),
  translated_text: z.string(),
})
export type TranslationEvaluationRunEntry = z.infer<typeof TranslationEvaluationRunEntry>

export const TranslationEvaluationRunRequest = z.object({
  book_label: z.string().min(1),
  language: z.string().min(1),
  source_language: z.string().min(1).optional(),
  source_catalog_version: z.number().int().min(1),
  translation_version: z.number().int().min(1),
  eval_config_hash: z.string().min(1),
  judge_model: z.string().min(1).optional(),
  max_retries: z.number().int().min(0).optional(),
  evaluation_scope_mode: TranslationEvaluationScopeMode.optional(),
  evaluation_scope_count: z.number().int().min(1).optional(),
  sampling_method: TranslationEvaluationSamplingMethod.optional(),
  sampling_seed: z.number().int().optional(),
  batch_size: z.number().int().min(1).optional(),
  judge_instructions: z.string().min(1).optional(),
  additional_guidance: z.string().min(1).optional(),
  sample_size: z.number().int().min(1).optional(),
  entries: z.array(TranslationEvaluationRunEntry).min(1),
})
export type TranslationEvaluationRunRequest = z.infer<typeof TranslationEvaluationRunRequest>

export const TranslationEvaluationResult = z.object({
  generated_at: z.string().datetime(),
  provider: TranslationEvaluationProvider,
  language: z.string().min(1),
  source_language: z.string().min(1).optional(),
  source_catalog_version: z.number().int().min(1),
  translation_version: z.number().int().min(1),
  eval_config_hash: z.string().min(1),
  judge: TranslationEvaluationJudgeMetadata.optional(),
  summary: TranslationEvaluationSummary,
  items: z.array(TranslationEvaluationItem),
  metadata: TranslationEvaluationMetadata.optional(),
  mlflow: TranslationEvaluationMlflowMetadata.optional(),
})
export type TranslationEvaluationResult = z.infer<typeof TranslationEvaluationResult>
