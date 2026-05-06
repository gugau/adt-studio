import { z } from "zod"
import { parseDocument, DomUtils } from "htmlparser2"
import type {
  AppConfig,
  WebRenderingOutput,
  PageSectioningOutput,
  QuizGenerationOutput,
  Quiz,
  QuizGroup,
  QuizActivityType,
  QuizQuestion,
} from "@adt/types"
import { getQuizLLMSchema, DEFAULT_LLM_MAX_RETRIES } from "@adt/types"
import type { LLMModel, ValidationResult } from "@adt/llm"
import { processWithConcurrency } from "./concurrency.js"
import { buildLanguageContext, normalizeLocale } from "./language-context.js"

export interface QuizConfig {
  language: string
  pagesPerQuiz: number
  quizSectionTypes?: string[]
  /** When provided, replaces auto-batching: one quiz per group with explicit placement. */
  quizGroups?: QuizGroup[]
  activityType?: QuizActivityType
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

export const QUIZ_ACTIVITY_LABELS: Record<QuizActivityType, string> = {
  multiple_choice: "Multiple choice",
  true_false: "True or false",
  fill_in_the_blank: "Fill in the blanks",
  drag_and_drop: "Drag and drop matching",
}

function normalizeQuestionTitle(activityType: QuizActivityType, question: string): string {
  const trimmed = question.trim()
  if (trimmed) return trimmed
  switch (activityType) {
    case "true_false":
      return "True or false."
    case "fill_in_the_blank":
      return "Fill in the blanks."
    case "drag_and_drop":
      return "Match the pairs."
    case "multiple_choice":
    default:
      return "Quiz."
  }
}

function blankMarkerCount(text: string): number {
  return (text.match(/____/g) ?? []).length
}

function normalizeDuplicateText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ")
}

function questionDuplicateKeys(question: QuizQuestion): string[] {
  switch (question.activityType) {
    case "true_false":
      return (question.statements ?? []).map((s) => normalizeDuplicateText(s.text))
    case "fill_in_the_blank":
      return (question.blanks ?? []).map((b) => normalizeDuplicateText(b.prompt))
    case "drag_and_drop":
      return (question.pairs ?? []).map((p) =>
        normalizeDuplicateText(`${p.item} → ${p.match}`)
      )
    case "multiple_choice":
    default:
      return [normalizeDuplicateText(question.question)]
  }
}

function hasDuplicateQuestion(question: QuizQuestion, previousQuestions: QuizQuestion[]): boolean {
  const previous = new Set(previousQuestions.flatMap(questionDuplicateKeys))
  return questionDuplicateKeys(question).some((key) => previous.has(key))
}

type QuizLLMResult = {
  activity_type?: QuizActivityType
  reasoning: string
  question: string
  options?: Array<{ text: string; explanation: string }>
  answer_index?: number
  statements?: Array<{ text: string; answer: boolean }>
  blanks?: Array<{ prompt: string; answer: string }>
  pairs?: Array<{ item: string; match: string }>
}

function quizQuestionFromLLM(raw: QuizLLMResult): QuizQuestion {
  const activityType = raw.activity_type ?? "multiple_choice"
  if (activityType === "multiple_choice") {
    const shuffled = shuffleQuizOptions(raw.options ?? [], raw.answer_index ?? 0)
    return {
      activityType,
      question: normalizeQuestionTitle(activityType, raw.question),
      options: shuffled.options,
      answerIndex: shuffled.answerIndex,
      reasoning: raw.reasoning,
    }
  }

  if (activityType === "true_false") {
    return {
      activityType,
      question: normalizeQuestionTitle(activityType, raw.question),
      statements: raw.statements ?? [],
      reasoning: raw.reasoning,
    }
  }

  if (activityType === "fill_in_the_blank") {
    return {
      activityType,
      question: normalizeQuestionTitle(activityType, raw.question),
      blanks: raw.blanks ?? [],
      reasoning: raw.reasoning,
    }
  }

  return {
    activityType,
    question: normalizeQuestionTitle(activityType, raw.question),
    pairs: raw.pairs ?? [],
    reasoning: raw.reasoning,
  }
}

function quizFromQuestion(
  question: QuizQuestion,
  batch: QuizBatch,
  quizIndex: number,
  questions?: QuizQuestion[]
): Quiz {
  return {
    ...question,
    quizIndex,
    afterPageId: batch.afterPageId,
    pageIds: batch.pages.map((p) => p.pageId),
    isPruned: false,
    ...(questions ? { questions } : {}),
  }
}

function validateQuizLLMResult(
  raw: QuizLLMResult,
  activityType: QuizActivityType,
  previousQuestions: QuizQuestion[]
): string[] {
  const errors: string[] = []
  if (raw.activity_type !== undefined && raw.activity_type !== activityType) {
    errors.push(`activity_type must be "${activityType}", got "${raw.activity_type}"`)
  }
  const questionText = typeof raw.question === "string" ? raw.question : ""
  if (!questionText.trim()) {
    errors.push("Question/title is missing")
  }
  if (questionText.length > 200) {
    errors.push("Question/title exceeds 200 characters")
  }

  if (activityType === "multiple_choice") {
    const options = raw.options ?? []
    if (options.length < 2) {
      errors.push(`Must provide at least 2 options, got ${options.length}`)
    }
    for (const opt of options) {
      if (opt.text.length > 80)
        errors.push(
          `Option text exceeds 80 characters: "${opt.text.slice(0, 30)}..."`
        )
      if (opt.explanation.length > 400)
        errors.push("Explanation exceeds 400 characters")
      if (!opt.text) errors.push("Option text is missing")
      if (!opt.explanation) errors.push("Option explanation is missing")
    }
    const answerIndex = raw.answer_index ?? -1
    if (answerIndex < 0 || answerIndex >= options.length) {
      errors.push(`answer_index ${answerIndex} is out of range [0, ${options.length - 1}]`)
    }
  }

  if (activityType === "true_false") {
    const statements = raw.statements ?? []
    if (statements.length < 1) {
      errors.push(`True/false must provide at least 1 statement, got ${statements.length}`)
    }
    for (const statement of statements) {
      if (!statement.text.trim()) errors.push("True/false statement is missing")
    }
  }

  if (activityType === "fill_in_the_blank") {
    const blanks = raw.blanks ?? []
    if (blanks.length < 1 || blanks.length > 5) {
      errors.push(`Fill-in-the-blank must provide 1-5 blanks, got ${blanks.length}`)
    }
    for (const blank of blanks) {
      if (blankMarkerCount(blank.prompt) !== 1) {
        errors.push(`Blank prompt must contain exactly one ____ marker: "${blank.prompt}"`)
      }
      if (/[?？]\s*$/u.test(blank.prompt.trim())) {
        errors.push("Blank prompt must be a cloze sentence, not a question")
      }
      if (!blank.answer.trim()) errors.push("Blank answer is missing")
    }
  }

  if (activityType === "drag_and_drop") {
    const pairs = raw.pairs ?? []
    if (pairs.length < 2 || pairs.length > 6) {
      errors.push(`Drag/drop must provide 2-6 pairs, got ${pairs.length}`)
    }
    const seen = new Set<string>()
    for (const pair of pairs) {
      const key = normalizeDuplicateText(`${pair.item} → ${pair.match}`)
      if (!pair.item.trim() || !pair.match.trim()) errors.push("Drag/drop pair item or match is missing")
      if (seen.has(key)) errors.push(`Duplicate drag/drop pair: "${pair.item}" / "${pair.match}"`)
      seen.add(key)
    }
  }

  const question = quizQuestionFromLLM({
    ...raw,
    question: questionText,
    reasoning: raw.reasoning ?? "",
  })
  if (hasDuplicateQuestion(question, previousQuestions)) {
    errors.push("Generated question duplicates a previous question in this quiz")
  }
  return errors
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
    activityType: "multiple_choice",
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

function extractQuizPageText(page: QuizPageInput, quizSectionTypes?: string[]): string {
  const html = page.rendering.sections
    .filter((section) => {
      const meta = page.sectioning.sections[section.sectionIndex]
      if (meta?.isPruned) return false
      if (quizSectionTypes === undefined) return true
      return meta ? quizSectionTypes.includes(meta.sectionType) : quizSectionTypes.includes(section.sectionType)
    })
    .map((section) => section.html)
    .join("\n")
  return extractTextFromHtml(html)
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
 * Auto-batch eligible content pages into groups of N. Used when
 * user-defined quiz groups are not provided. Each batch's afterPageId is the
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
 * over auto-batching when the config explicitly provides `quizGroups`,
 * including an empty array.
 */
export function buildQuizBatches(
  pages: QuizPageInput[],
  config: QuizConfig
): QuizBatch[] {
  if (config.quizGroups !== undefined) {
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
  llmModel: LLMModel,
  options?: {
    activityType?: QuizActivityType
    questionNumber?: number
    questionsPerQuiz?: number
    previousQuestions?: QuizQuestion[]
  }
): Promise<Quiz> {
  const activityType = options?.activityType ?? config.activityType ?? "multiple_choice"
  const questionNumber = options?.questionNumber ?? 1
  const questionsPerQuiz = options?.questionsPerQuiz ?? 1
  const previousQuestions = options?.previousQuestions ?? []
  const pageTexts = batch.pages.map((page) => ({
    pageId: page.pageId,
    text: extractQuizPageText(page, config.quizSectionTypes),
  }))

  const result = await llmModel.generateObject<QuizLLMResult>({
    schema: getQuizLLMSchema(activityType),
    prompt: config.promptName,
    context: {
      ...buildLanguageContext(config.language),
      page_texts: pageTexts,
      individual_pages: pageTexts,
      activity_type: activityType,
      activity_type_label: QUIZ_ACTIVITY_LABELS[activityType],
      question_number: questionNumber,
      questions_per_quiz: questionsPerQuiz,
      previous_questions: previousQuestions.map((question, index) => ({
        question_number: index + 1,
        activity_type: question.activityType,
        question: question.question,
        duplicate_keys: questionDuplicateKeys(question),
      })),
    },
    validate: (raw: unknown): ValidationResult => {
      const errors = validateQuizLLMResult(raw as QuizLLMResult, activityType, previousQuestions)
      return { valid: errors.length === 0, errors }
    },
    maxRetries: config.maxRetries,
    timeoutMs: config.timeoutMs,
    log: {
      taskType: "quiz-generation",
      promptName: config.promptName,
    },
  })

  const question = quizQuestionFromLLM(result.object)
  return quizFromQuestion(question, batch, quizIndex)
}

/**
 * Generate one quiz/activity for an explicit page selection. When
 * questionsPerQuiz > 1, each LLM call creates one nested question and the
 * returned Quiz remains a single parent activity.
 */
export async function generateQuizForSelection(
  batch: QuizBatch,
  quizIndex: number,
  config: QuizConfig,
  llmModel: LLMModel,
  options: {
    activityType: QuizActivityType
    questionsPerQuiz?: number
  }
): Promise<Quiz> {
  const questionsPerQuiz = Math.max(1, options.questionsPerQuiz ?? 1)
  if (questionsPerQuiz === 1) {
    return generateQuiz(batch, quizIndex, config, llmModel, {
      activityType: options.activityType,
      questionNumber: 1,
      questionsPerQuiz,
      previousQuestions: [],
    })
  }

  const questions: QuizQuestion[] = []
  for (let i = 0; i < questionsPerQuiz; i++) {
    const quiz = await generateQuiz(batch, quizIndex, config, llmModel, {
      activityType: options.activityType,
      questionNumber: i + 1,
      questionsPerQuiz,
      previousQuestions: questions,
    })
    questions.push({
      activityType: quiz.activityType,
      question: quiz.question,
      options: quiz.options,
      answerIndex: quiz.answerIndex,
      statements: quiz.statements,
      blanks: quiz.blanks,
      pairs: quiz.pairs,
      reasoning: quiz.reasoning,
    })
  }

  return quizFromQuestion(questions[0], batch, quizIndex, questions)
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
