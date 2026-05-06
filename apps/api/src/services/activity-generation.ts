/**
 * Generate or extract a templated activity from one or more pages.
 *
 * `source: "page"` means extract an activity that already exists in the page's
 * content (uses the extraction prompt); `source: "pages"` means synthesize one
 * from the pages' material (uses the generation prompt).
 *
 * Currently supports `templateType: "multiple_choice"` only — TF/FITB throw
 * a clear error until their prompts land.
 */
import path from "node:path"
import {
  ActivitiesOutput,
  type Activity,
  type ActivityTemplateType,
  type PageSectioningOutput,
  type WebRenderingOutput,
  readActivitiesFromNode,
} from "@adt/types"
import { createBookStorage } from "@adt/storage"
import { createLLMModel, createPromptEngine } from "@adt/llm"
import {
  buildQuizGenerationConfig,
  generateQuiz,
  loadBookConfig,
  type QuizPageInput,
} from "@adt/pipeline"

export interface GenerateActivitiesForPagesOptions {
  label: string
  booksDir: string
  promptsDir: string
  configPath?: string
  apiKey: string
  source: "page" | "pages"
  templateType: ActivityTemplateType
  pageIds: string[]
  count: number
}

export interface GenerateActivitiesForPagesResult {
  version: number
  activities: Activity[]
}

export async function generateActivitiesForPages(
  opts: GenerateActivitiesForPagesOptions,
): Promise<GenerateActivitiesForPagesResult> {
  if (opts.templateType !== "multiple_choice") {
    throw new Error(
      `Activity generation for templateType "${opts.templateType}" is not yet supported. Create the activity manually for now.`,
    )
  }

  const config = loadBookConfig(opts.label, opts.booksDir, opts.configPath)
  const cacheDir = path.join(path.resolve(opts.booksDir), opts.label, ".cache")
  const bookPromptsDir = path.join(path.resolve(opts.booksDir), opts.label, "prompts")
  const promptEngine = createPromptEngine([bookPromptsDir, opts.promptsDir])

  const storage = createBookStorage(opts.label, opts.booksDir)
  try {
    const metadataRow = storage.getLatestNodeData("metadata", "book")
    const metadata = metadataRow?.data as { language_code?: string | null } | null
    const detectedLanguage = metadata?.language_code ?? null

    const baseConfig = buildQuizGenerationConfig(config, detectedLanguage)
    if (!baseConfig) {
      throw new Error(
        "Cannot generate activities: book editing language is not set and no language was detected.",
      )
    }
    // Source distinguishes "extract" (page already contains the activity) vs
    // "generate" (synthesize from page content). Each uses a different prompt.
    const promptName =
      opts.source === "page" ? "activity_mc_extraction" : baseConfig.promptName
    const llmConfig = { ...baseConfig, promptName }

    const llmModel = createLLMModel({
      modelId: llmConfig.modelId,
      cacheDir,
      promptEngine,
      credentials: { openaiApiKey: opts.apiKey },
    })

    const pageInputs: QuizPageInput[] = []
    for (const pageId of opts.pageIds) {
      const renderingRow = storage.getLatestNodeData("web-rendering", pageId)
      const sectioningRow = storage.getLatestNodeData("page-sectioning", pageId)
      if (!renderingRow || !sectioningRow) {
        throw new Error(`Page ${pageId} is not yet rendered/sectioned`)
      }
      pageInputs.push({
        pageId,
        rendering: renderingRow.data as WebRenderingOutput,
        sectioning: sectioningRow.data as PageSectioningOutput,
      })
    }
    if (pageInputs.length === 0) {
      throw new Error("No pages provided")
    }

    const existingRow = storage.getLatestNodeData("quiz-generation", "book")
    const existing = existingRow ? readActivitiesFromNode(existingRow.data) : null
    const existingActivities = existing?.activities ?? []

    // For "extract from page", we run once per page; for "generate from pages",
    // we batch all pages into a single LLM call (existing behavior). `count`
    // bounds the loop so a misconfigured caller can't spawn unbounded calls.
    const newActivities: Activity[] = []
    if (opts.source === "page") {
      for (const page of pageInputs.slice(0, opts.count)) {
        const quiz = await generateQuiz([page], 0, llmConfig, llmModel)
        newActivities.push({
          activityId: nextActivityId([...existingActivities, ...newActivities]),
          afterPageId: quiz.afterPageId,
          pageIds: quiz.pageIds,
          generatedAt: new Date().toISOString(),
          templateType: "multiple_choice",
          question: quiz.question,
          options: quiz.options,
          answerIndex: quiz.answerIndex,
          reasoning: quiz.reasoning,
        })
      }
    } else {
      const quiz = await generateQuiz(pageInputs, 0, llmConfig, llmModel)
      newActivities.push({
        activityId: nextActivityId([...existingActivities, ...newActivities]),
        afterPageId: quiz.afterPageId,
        pageIds: quiz.pageIds,
        generatedAt: new Date().toISOString(),
        templateType: "multiple_choice",
        question: quiz.question,
        options: quiz.options,
        answerIndex: quiz.answerIndex,
        reasoning: quiz.reasoning,
      })
    }

    const updated = ActivitiesOutput.parse({
      generatedAt: new Date().toISOString(),
      language: llmConfig.language,
      activities: [...existingActivities, ...newActivities],
    })
    const version = storage.putNodeData("quiz-generation", "book", updated)
    return { version, activities: newActivities }
  } finally {
    storage.close()
  }
}

function nextActivityId(existing: Activity[]): string {
  let max = 0
  for (const a of existing) {
    const m = /^act(\d+)$/.exec(a.activityId)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `act${String(max + 1).padStart(3, "0")}`
}
