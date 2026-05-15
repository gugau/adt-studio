import { z } from "zod"
import { parseDocument } from "htmlparser2"
import type {
  AppConfig,
  WebRenderingOutput,
  PageSectioningOutput,
  QuizGenerationOutput,
  Quiz,
  QuizGroup,
  QuizActivityType,
  QuizQuestion,
  ActivityTemplate,
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
  activityTemplate?: ActivityTemplate
  multipleChoiceOptionCount?: number
  openEndedCharacterLimit?: number
  matchingPairCount?: number
  sortingItemCount?: number
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
  const stripped = text.replace(/^\s*[\p{N}]+[\.)]\s*/u, "").trim()
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

function shuffleQuizOptionsWithAnswerIndexes(
  options: Array<{ text: string; explanation: string }>,
  answerIndexes: number[],
  rng: () => number = Math.random
): { options: Array<{ text: string; explanation: string }>; answerIndexes: number[] } {
  const correctIndexes = new Set(answerIndexes)
  const withCorrect = options.map((option, index) => ({
    option,
    isCorrect: correctIndexes.has(index),
  }))
  const shuffled = withCorrect.slice()

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const newAnswerIndexes = shuffled
    .map((entry, index) => (entry.isCorrect ? index : -1))
    .filter((index) => index >= 0)
  const renumbered = shuffled.map((entry, index) => ({
    text: renumberOptionText(entry.option.text, index),
    explanation: entry.option.explanation,
  }))

  return { options: renumbered, answerIndexes: newAnswerIndexes }
}

export const QUIZ_ACTIVITY_LABELS: Record<QuizActivityType, string> = {
  multiple_choice: "Multiple choice",
  multiple_select: "Multiple select",
  true_false: "True or false",
  fill_in_the_blank: "Fill in the blanks",
  open_ended: "Open ended",
  drag_and_drop: "Matching pairs",
  sorting: "Sorting",
}

function getMultipleChoiceOptionCount(count: number): number {
  if (!Number.isFinite(count)) return 4
  return Math.min(6, Math.max(2, Math.trunc(count)))
}

function getOpenEndedCharacterLimit(count: number | undefined): number {
  if (count === undefined || !Number.isFinite(count)) return 250
  return Math.min(2000, Math.max(50, Math.trunc(count)))
}

function getActivityItemLimit(count: number | undefined): number {
  if (count === undefined || !Number.isFinite(count)) return 6
  return Math.min(6, Math.max(2, Math.trunc(count)))
}

function normalizeQuestionTitle(activityType: QuizActivityType, question: string): string {
  const trimmed = question.trim()
  if (trimmed) return trimmed
  switch (activityType) {
    case "multiple_select":
      return "Choose all that apply."
    case "true_false":
      return "True or false."
    case "fill_in_the_blank":
      return "Fill in the blanks."
    case "open_ended":
      return "Answer in your own words."
    case "drag_and_drop":
      return "Match the pairs."
    case "sorting":
      return "Sort the items."
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
    case "multiple_select":
      return [normalizeDuplicateText(question.question)]
    case "true_false":
      return (question.statements ?? []).map((s) => normalizeDuplicateText(s.text))
    case "fill_in_the_blank":
      return (question.blanks ?? []).map((b) => normalizeDuplicateText(b.prompt))
    case "open_ended":
      return [normalizeDuplicateText(question.question)]
    case "drag_and_drop":
      return (question.pairs ?? []).map((p) =>
        normalizeDuplicateText(`${p.item} → ${p.match}`)
      )
    case "sorting":
      return (question.sortingItems ?? []).map((item) =>
        normalizeDuplicateText(`${item.item} → ${item.category}`)
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
  answer_indexes?: number[]
  statements?: Array<{ text: string; answer: boolean }>
  blanks?: Array<{ prompt: string; answer: string }>
  sample_answer?: string
  guidance?: string
  pairs?: Array<{ item: string; match: string }>
  categories?: Array<{ label: string }>
  items?: Array<{ item: string; category: string }>
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

  if (activityType === "multiple_select") {
    const shuffled = shuffleQuizOptionsWithAnswerIndexes(raw.options ?? [], raw.answer_indexes ?? [])
    return {
      activityType,
      question: normalizeQuestionTitle(activityType, raw.question),
      options: shuffled.options,
      answerIndexes: shuffled.answerIndexes,
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

  if (activityType === "open_ended") {
    return {
      activityType,
      question: normalizeQuestionTitle(activityType, raw.question),
      sampleAnswer: raw.sample_answer,
      guidance: raw.guidance,
      reasoning: raw.reasoning,
    }
  }

  if (activityType === "sorting") {
    return {
      activityType,
      question: normalizeQuestionTitle(activityType, raw.question),
      categories: raw.categories ?? [],
      sortingItems: raw.items ?? [],
      reasoning: raw.reasoning,
    }
  }

  if (activityType === "drag_and_drop") {
    return {
      activityType,
      question: normalizeQuestionTitle(activityType, raw.question),
      pairs: raw.pairs ?? [],
      reasoning: raw.reasoning,
    }
  }

  const exhaustive: never = activityType
  throw new Error(`Unhandled activity type: ${exhaustive}`)
}

function quizFromQuestion(
  question: QuizQuestion,
  batch: QuizBatch,
  quizIndex: number,
  questions?: QuizQuestion[],
  template?: ActivityTemplate
): Quiz {
  return {
    ...question,
    quizIndex,
    afterPageId: batch.afterPageId,
    pageIds: batch.pages.map((p) => p.pageId),
    isPruned: false,
    ...(template ? { template } : {}),
    ...(questions ? { questions } : {}),
  }
}

function applyConfiguredQuestionLimits(question: QuizQuestion, config: QuizConfig): QuizQuestion {
  if (question.activityType !== "open_ended") return question
  return {
    ...question,
    responseCharacterLimit: getOpenEndedCharacterLimit(config.openEndedCharacterLimit),
  }
}

function validateQuizLLMResult(
  raw: QuizLLMResult,
  activityType: QuizActivityType,
  previousQuestions: QuizQuestion[],
  config: Pick<QuizConfig, "multipleChoiceOptionCount" | "matchingPairCount" | "sortingItemCount">
): string[] {
  const errors: string[] = []
  if (raw.activity_type !== undefined && raw.activity_type !== activityType) {
    errors.push(`activity_type must be "${activityType}", got "${raw.activity_type}"`)
  }
  const questionText = typeof raw.question === "string" ? raw.question : ""
  if (!questionText.trim()) {
    errors.push("Question/title is missing")
  }
  if (activityType !== "open_ended" && questionText.length > 200) {
    errors.push("Question/title exceeds 200 characters")
  }

  if (activityType === "multiple_choice") {
    const options = raw.options ?? []
    const expectedOptionCount = getMultipleChoiceOptionCount(config.multipleChoiceOptionCount ?? 4)
    if (options.length !== expectedOptionCount) {
      errors.push(`Multiple choice must provide exactly ${expectedOptionCount} options, got ${options.length}`)
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

  if (activityType === "multiple_select") {
    const options = raw.options ?? []
    if (options.length < 3 || options.length > 6) {
      errors.push(`Multiple select must provide 3-6 options, got ${options.length}`)
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
    const answerIndexes = raw.answer_indexes ?? []
    const uniqueAnswerIndexes = new Set(answerIndexes)
    if (answerIndexes.length < 2) {
      errors.push(`Multiple select must provide at least 2 correct answers, got ${answerIndexes.length}`)
    }
    if (uniqueAnswerIndexes.size !== answerIndexes.length) {
      errors.push("Multiple select answer_indexes must be unique")
    }
    for (const answerIndex of answerIndexes) {
      if (answerIndex < 0 || answerIndex >= options.length) {
        errors.push(`answer_index ${answerIndex} is out of range [0, ${options.length - 1}]`)
      }
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

  if (activityType === "open_ended") {
    if (questionText.length > 240) {
      errors.push("Open-ended prompt exceeds 240 characters")
    }
    if (raw.sample_answer && raw.sample_answer.length > 600) {
      errors.push("Open-ended sample answer exceeds 600 characters")
    }
    if (raw.guidance && raw.guidance.length > 400) {
      errors.push("Open-ended guidance exceeds 400 characters")
    }
  }

  if (activityType === "drag_and_drop") {
    const pairs = raw.pairs ?? []
    const maxPairs = getActivityItemLimit(config.matchingPairCount)
    if (pairs.length < 2 || pairs.length > maxPairs) {
      errors.push(`Drag/drop must provide 2-${maxPairs} pairs, got ${pairs.length}`)
    }
    const seen = new Set<string>()
    for (const pair of pairs) {
      const key = normalizeDuplicateText(`${pair.item} → ${pair.match}`)
      if (!pair.item.trim() || !pair.match.trim()) errors.push("Drag/drop pair item or match is missing")
      if (seen.has(key)) errors.push(`Duplicate drag/drop pair: "${pair.item}" / "${pair.match}"`)
      seen.add(key)
    }
  }

  if (activityType === "sorting") {
    const categories = raw.categories ?? []
    const items = raw.items ?? []
    const maxItems = getActivityItemLimit(config.sortingItemCount)
    if (categories.length < 2 || categories.length > 5) {
      errors.push(`Sorting must provide 2-5 categories, got ${categories.length}`)
    }
    if (items.length < 2 || items.length > maxItems) {
      errors.push(`Sorting must provide 2-${maxItems} items, got ${items.length}`)
    }
    const categoryLabels = new Set<string>()
    for (const category of categories) {
      const key = normalizeDuplicateText(category.label)
      if (!key) errors.push("Sorting category label is missing")
      if (categoryLabels.has(key)) errors.push(`Duplicate sorting category: "${category.label}"`)
      categoryLabels.add(key)
    }
    const itemLabels = new Set<string>()
    for (const item of items) {
      const itemKey = normalizeDuplicateText(item.item)
      const categoryKey = normalizeDuplicateText(item.category)
      if (!itemKey) errors.push("Sorting item text is missing")
      if (itemLabels.has(itemKey)) errors.push(`Duplicate sorting item: "${item.item}"`)
      itemLabels.add(itemKey)
      if (!categoryLabels.has(categoryKey)) {
        errors.push(`Sorting item category must match a provided category: "${item.category}"`)
      }
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
    multipleChoiceOptionCount: getMultipleChoiceOptionCount(
      appConfig.quiz_generation?.multiple_choice_option_count ?? 4
    ),
    openEndedCharacterLimit: getOpenEndedCharacterLimit(
      appConfig.quiz_generation?.open_ended_character_limit
    ),
    matchingPairCount: getActivityItemLimit(
      appConfig.quiz_generation?.matching_pair_count
    ),
    sortingItemCount: getActivityItemLimit(
      appConfig.quiz_generation?.sorting_item_count
    ),
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

type ParsedHtmlChild = ReturnType<typeof parseDocument>["children"][number]

const BLOCK_TEXT_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "caption",
  "dd",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
])

function isElementNode(node: ParsedHtmlChild): node is ParsedHtmlChild & { name: string } {
  return "name" in node && typeof node.name === "string"
}

function isBlockTextNode(node: ParsedHtmlChild): boolean {
  return isElementNode(node) && BLOCK_TEXT_TAGS.has(node.name.toLowerCase())
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/[ \t\f\v\r]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim()
}

function extractHtmlNodeText(node: ParsedHtmlChild): string {
  if ("type" in node && node.type === "text" && "data" in node && typeof node.data === "string") {
    return node.data.replace(/\s+/g, " ")
  }

  if (isElementNode(node) && node.name.toLowerCase() === "br") {
    return "\n"
  }

  if ("children" in node && Array.isArray(node.children)) {
    return extractHtmlChildrenText(node.children as ParsedHtmlChild[])
  }

  return ""
}

function extractHtmlChildrenText(children: readonly ParsedHtmlChild[]): string {
  const parts: string[] = []

  for (const child of children) {
    const text = extractHtmlNodeText(child)
    if (text === "\n") {
      parts.push("\n")
      continue
    }
    if (!text.trim()) continue
    if (isBlockTextNode(child)) {
      parts.push("\n", text.trim(), "\n")
    } else {
      parts.push(text)
    }
  }

  return normalizeExtractedText(parts.join(""))
}

/**
 * Extract plain text from rendered HTML while preserving word boundaries
 * between adjacent block elements.
 */
export function extractTextFromHtml(html: string): string {
  const doc = parseDocument(html)
  return extractHtmlChildrenText(doc.children)
}

function extractQuizPageText(page: QuizPageInput, quizSectionTypes?: string[]): string {
  const sectioningByIndex = new Map(
    page.sectioning.sections.map((section, sectionIndex) => [sectionIndex, section])
  )
  const html = page.rendering.sections
    .filter((section) => {
      const meta = sectioningByIndex.get(section.sectionIndex)
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
    template?: ActivityTemplate
    questionNumber?: number
    questionsPerQuiz?: number
    previousQuestions?: QuizQuestion[]
  }
): Promise<Quiz> {
  const activityType = options?.activityType ?? config.activityType ?? "multiple_choice"
  const template = options?.template ?? config.activityTemplate
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
      activity_template: template
        ? {
            name: template.name,
            style: template.style,
            generation_mode: template.generationMode,
            instructions: template.instructions ?? "",
          }
        : null,
      multiple_choice_option_count: getMultipleChoiceOptionCount(config.multipleChoiceOptionCount ?? 4),
      open_ended_character_limit: getOpenEndedCharacterLimit(config.openEndedCharacterLimit),
      matching_pair_count: getActivityItemLimit(config.matchingPairCount),
      sorting_item_count: getActivityItemLimit(config.sortingItemCount),
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
      const errors = validateQuizLLMResult(
        raw as QuizLLMResult,
        activityType,
        previousQuestions,
        config
      )
      return { valid: errors.length === 0, errors }
    },
    maxRetries: config.maxRetries,
    timeoutMs: config.timeoutMs,
    log: {
      taskType: "quiz-generation",
      promptName: config.promptName,
    },
  })

  const question = applyConfiguredQuestionLimits(quizQuestionFromLLM(result.object), config)
  return quizFromQuestion(question, batch, quizIndex, undefined, template)
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
    template?: ActivityTemplate
  }
): Promise<Quiz> {
  const questionsPerQuiz = Math.max(1, options.questionsPerQuiz ?? 1)
  if (questionsPerQuiz === 1) {
    return generateQuiz(batch, quizIndex, config, llmModel, {
      activityType: options.activityType,
      template: options.template,
      questionNumber: 1,
      questionsPerQuiz,
      previousQuestions: [],
    })
  }

  const questions: QuizQuestion[] = []
  for (let i = 0; i < questionsPerQuiz; i++) {
    const quiz = await generateQuiz(batch, quizIndex, config, llmModel, {
      activityType: options.activityType,
      template: options.template,
      questionNumber: i + 1,
      questionsPerQuiz,
      previousQuestions: questions,
    })
    questions.push({
      activityType: quiz.activityType,
      question: quiz.question,
      options: quiz.options,
      answerIndex: quiz.answerIndex,
      answerIndexes: quiz.answerIndexes,
      statements: quiz.statements,
      blanks: quiz.blanks,
      pairs: quiz.pairs,
      categories: quiz.categories,
      sortingItems: quiz.sortingItems,
      sampleAnswer: quiz.sampleAnswer,
      guidance: quiz.guidance,
      responseCharacterLimit: quiz.responseCharacterLimit,
      reasoning: quiz.reasoning,
    })
  }

  const parentQuestion = applyConfiguredQuestionLimits(questions[0], config)
  return quizFromQuestion(parentQuestion, batch, quizIndex, questions, options.template)
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
