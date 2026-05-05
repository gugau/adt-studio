import { z } from "zod"
import { parseDocument, DomUtils } from "htmlparser2"
import type {
  AppConfig,
  WebRenderingOutput,
  PageSectioningOutput,
  QuizGenerationOutput,
  Quiz,
  QuizGroup,
} from "@adt/types"
import { quizLLMSchema, DEFAULT_LLM_MAX_RETRIES } from "@adt/types"
import type { LLMModel, ValidationResult } from "@adt/llm"
import { processWithConcurrency } from "./concurrency.js"
import { buildLanguageContext, normalizeLocale } from "./language-context.js"

export interface QuizConfig {
  language: string
  pagesPerQuiz: number
  quizSectionTypes?: string[]
  /** When non-empty, replaces auto-batching: one quiz per group with explicit placement. */
  quizGroups?: QuizGroup[]
  promptName: string
  modelId: string
  maxRetries: number
  timeoutMs: number
}

/** A resolved batch ready to feed into the LLM, with explicit placement. */
export interface QuizBatch {
  pages: QuizPageInput[]
  afterPageId: string
}

export interface QuizPageInput {
  pageId: string
  rendering: WebRenderingOutput
  sectioning: PageSectioningOutput
}

function renumberOptionText(text: string, index: number): string {
  const stripped = text.replace(/^\s*\d+\)\s*/u, "").trim()
  const label = `${index + 1})`
  return stripped ? `${label} ${stripped}` : label
}

function shuffleQuizOptions(
  options: Array<{ text: string; explanation: string }>,
  answerIndex: number,
  rng: () => number = Math.random
): { options: Array<{ text: string; explanation: string }>; answerIndex: number } {
  const withCorrect = options.map((option, index) => ({
    option,
    isCorrect: index === answerIndex,
  }))
  const shuffled = withCorrect.slice()

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const newAnswerIndex = shuffled.findIndex((entry) => entry.isCorrect)
  const renumbered = shuffled.map((entry, index) => ({
    text: renumberOptionText(entry.option.text, index),
    explanation: entry.option.explanation,
  }))

  return { options: renumbered, answerIndex: newAnswerIndex }
}

/**
 * Build quiz generation config from AppConfig and detected language.
 * Returns null if no language is available.
 */
export function buildQuizGenerationConfig(
  appConfig: AppConfig,
  detectedLanguage: string | null
): QuizConfig | null {
  const language = appConfig.editing_language ?? detectedLanguage
  if (!language) return null

  return {
    language: normalizeLocale(language),
    pagesPerQuiz: appConfig.quiz_generation?.pages_per_quiz ?? 3,
    quizSectionTypes: appConfig.quiz_generation?.quiz_section_types,
    quizGroups: appConfig.quiz_generation?.quiz_groups,
    promptName: appConfig.quiz_generation?.prompt ?? "quiz_generation",
    modelId:
      appConfig.quiz_generation?.model ??
      appConfig.page_sectioning?.model ??
      "openai:gpt-5.4",
    maxRetries:
      appConfig.quiz_generation?.max_retries ?? DEFAULT_LLM_MAX_RETRIES,
    timeoutMs: (appConfig.quiz_generation?.timeout ?? 90) * 1000,
  }
}

/**
 * Extract plain text from rendered HTML by stripping tags.
 * Uses htmlparser2 (already an @adt/pipeline dependency).
 */
export function extractTextFromHtml(html: string): string {
  const doc = parseDocument(html)
  return DomUtils.textContent(doc).trim()
}

/**
 * Determine if a page has at least one non-pruned section.
 * If quizSectionTypes is undefined, all non-pruned sections count.
 * If quizSectionTypes is provided (including empty), only sections
 * matching those types are considered.
 */
export function isContentPage(
  sectioning: PageSectioningOutput,
  quizSectionTypes?: string[]
): boolean {
  return sectioning.sections.some((s) => {
    if (s.isPruned) return false
    if (quizSectionTypes === undefined) return true
    return quizSectionTypes.includes(s.sectionType)
  })
}

/**
 * Resolve the user-defined quiz groups against the available pages, producing
 * one batch per group with an explicit `afterPageId` for placement.
 *
 * Pages whose IDs aren't found in the available pages are silently dropped.
 * Groups that resolve to zero available pages are skipped entirely.
 */
function buildBatchesFromGroups(
  pages: QuizPageInput[],
  quizGroups: QuizGroup[]
): QuizBatch[] {
  const pageById = new Map(pages.map((p) => [p.pageId, p]))
  const lastBookPageId = pages.length > 0 ? pages[pages.length - 1].pageId : ""
  const batches: QuizBatch[] = []
  for (const group of quizGroups) {
    const groupPages: QuizPageInput[] = []
    for (const id of group.source_page_ids) {
      const page = pageById.get(id)
      if (page) groupPages.push(page)
    }
    if (groupPages.length === 0) continue

    let afterPageId: string
    if (group.insert_after === "end") {
      afterPageId = lastBookPageId
    } else if (group.insert_after) {
      afterPageId = group.insert_after
    } else {
      afterPageId = groupPages[groupPages.length - 1].pageId
    }
    batches.push({ pages: groupPages, afterPageId })
  }
  return batches
}

/**
 * Auto-batch eligible content pages into groups of N. Used when no
 * user-defined quiz groups are provided. Each batch's afterPageId is the
 * last page in the batch.
 */
function buildBatchesAuto(
  pages: QuizPageInput[],
  pagesPerQuiz: number,
  quizSectionTypes?: string[]
): QuizBatch[] {
  const contentPages = pages.filter((p) => isContentPage(p.sectioning, quizSectionTypes))
  const batches: QuizBatch[] = []
  for (let i = 0; i < contentPages.length; i += pagesPerQuiz) {
    const slice = contentPages.slice(i, i + pagesPerQuiz)
    batches.push({ pages: slice, afterPageId: slice[slice.length - 1].pageId })
  }
  return batches
}

/**
 * Build the list of quiz batches to generate. Custom groups take priority
 * over auto-batching when provided.
 */
export function buildQuizBatches(
  pages: QuizPageInput[],
  config: QuizConfig
): QuizBatch[] {
  if (config.quizGroups && config.quizGroups.length > 0) {
    return buildBatchesFromGroups(pages, config.quizGroups)
  }
  return buildBatchesAuto(pages, config.pagesPerQuiz, config.quizSectionTypes)
}

/**
 * Generate a single quiz for a batch of pages.
 */
export async function generateQuiz(
  batch: QuizBatch,
  quizIndex: number,
  config: QuizConfig,
  llmModel: LLMModel
): Promise<Quiz> {
  const pageTexts = batch.pages.map((page) => {
    const combinedHtml = page.rendering.sections.map((s) => s.html).join("\n")
    return {
      pageId: page.pageId,
      text: extractTextFromHtml(combinedHtml),
    }
  })

  const result = await llmModel.generateObject<{
    reasoning: string
    question: string
    options: Array<{ text: string; explanation: string }>
    answer_index: number
  }>({
    schema: quizLLMSchema,
    prompt: config.promptName,
    context: {
      ...buildLanguageContext(config.language),
      page_texts: pageTexts,
    },
    validate: (raw: unknown): ValidationResult => {
      const r = raw as {
        question: string
        options: Array<{ text: string; explanation: string }>
        answer_index: number
      }
      const errors: string[] = []
      if (r.question.length > 200) {
        errors.push("Question exceeds 200 characters")
      }
      if (r.options.length !== 3) {
        errors.push(`Must provide exactly 3 options, got ${r.options.length}`)
      }
      for (const opt of r.options) {
        if (opt.text.length > 80)
          errors.push(
            `Option text exceeds 80 characters: "${opt.text.slice(0, 30)}..."`
          )
        if (opt.explanation.length > 400)
          errors.push("Explanation exceeds 400 characters")
        if (!opt.text) errors.push("Option text is missing")
        if (!opt.explanation) errors.push("Option explanation is missing")
      }
      if (r.answer_index < 0 || r.answer_index >= r.options.length) {
        errors.push(
          `answer_index ${r.answer_index} is out of range [0, ${r.options.length - 1}]`
        )
      }
      return { valid: errors.length === 0, errors }
    },
    maxRetries: config.maxRetries,
    timeoutMs: config.timeoutMs,
    log: {
      taskType: "quiz-generation",
      promptName: config.promptName,
    },
  })

  const shuffled = shuffleQuizOptions(
    result.object.options,
    result.object.answer_index
  )

  return {
    quizIndex,
    afterPageId: batch.afterPageId,
    pageIds: batch.pages.map((p) => p.pageId),
    question: result.object.question,
    options: shuffled.options,
    answerIndex: shuffled.answerIndex,
    reasoning: result.object.reasoning,
  }
}

/**
 * Generate all quizzes for a book.
 * Pure function — all dependencies provided as parameters.
 */
export async function generateAllQuizzes(
  pages: QuizPageInput[],
  config: QuizConfig,
  llmModel: LLMModel,
  options?: {
    concurrency?: number
    onQuizComplete?: (completed: number, total: number) => void
  }
): Promise<QuizGenerationOutput> {
  const batches = buildQuizBatches(pages, config)
  const quizzes: Quiz[] = []
  const concurrency = options?.concurrency ?? 1
  let completed = 0

  await processWithConcurrency(
    batches.map((batch, index) => ({ batch, index })),
    concurrency,
    async ({ batch, index }) => {
      const quiz = await generateQuiz(batch, index, config, llmModel)
      quizzes.push(quiz)
      completed++
      options?.onQuizComplete?.(completed, batches.length)
    }
  )

  // Sort by index since parallel execution may complete out of order
  quizzes.sort((a, b) => a.quizIndex - b.quizIndex)

  return {
    generatedAt: new Date().toISOString(),
    language: config.language,
    pagesPerQuiz: config.pagesPerQuiz,
    quizzes,
  }
}
