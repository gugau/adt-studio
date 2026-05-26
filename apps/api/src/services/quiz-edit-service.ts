import path from "node:path"
import { createBookStorage } from "@adt/storage"
import { createLLMModel, createPromptEngine } from "@adt/llm"
import type { ValidationResult } from "@adt/llm"
import {
  loadBookConfig,
  buildLanguageContext,
  buildQuizGenerationConfig,
  extractTextFromHtml,
  shuffleQuizOptions,
} from "@adt/pipeline"
import {
  Quiz,
  QuizGenerationOutput,
  WebRenderingOutput,
  quizLLMSchema,
} from "@adt/types"

export interface AiEditQuizOptions {
  label: string
  quizIndex: number
  instruction: string
  /** Pending state from the frontend — overlays the stored quiz before editing */
  currentQuiz?: Quiz
  booksDir: string
  promptsDir: string
  configPath?: string
  apiKey: string
}

export interface AiEditQuizResult {
  quiz: Quiz
  reasoning: string
}

export async function aiEditQuiz(
  options: AiEditQuizOptions,
): Promise<AiEditQuizResult> {
  const {
    label,
    quizIndex,
    instruction,
    currentQuiz,
    booksDir,
    promptsDir,
    configPath,
    apiKey,
  } = options

  const previousKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = apiKey

  const storage = createBookStorage(label, booksDir)

  try {
    const quizRow = storage.getLatestNodeData("quiz-generation", "book")
    if (!quizRow) {
      throw new Error("Book has no quizzes — generate quizzes before editing")
    }
    const quizParsed = QuizGenerationOutput.safeParse(quizRow.data)
    if (!quizParsed.success) {
      throw new Error("Stored quiz data is invalid")
    }
    const storedQuiz = quizParsed.data.quizzes.find(
      (q) => q.quizIndex === quizIndex,
    )
    if (!storedQuiz) {
      throw new Error(`Quiz ${quizIndex} not found`)
    }

    const baseQuiz: Quiz = currentQuiz ?? storedQuiz

    const pageTexts = baseQuiz.pageIds.map((pageId) => {
      const renderingRow = storage.getLatestNodeData("web-rendering", pageId)
      if (!renderingRow) return { pageId, text: "" }
      const renderingParsed = WebRenderingOutput.safeParse(renderingRow.data)
      if (!renderingParsed.success) return { pageId, text: "" }
      const combinedHtml = renderingParsed.data.sections
        .map((s) => s.html)
        .join("\n")
      return { pageId, text: extractTextFromHtml(combinedHtml) }
    })

    const appConfig = loadBookConfig(label, booksDir, configPath)
    const quizConfig = buildQuizGenerationConfig(
      appConfig,
      quizParsed.data.language,
    )
    if (!quizConfig) {
      throw new Error("Unable to resolve quiz generation language")
    }

    const cacheDir = path.join(path.resolve(booksDir), label, ".cache")
    const bookPromptsDir = path.join(path.resolve(booksDir), label, "prompts")
    const promptEngine = createPromptEngine([bookPromptsDir, promptsDir])
    const model = createLLMModel({
      modelId: quizConfig.modelId,
      cacheDir,
      promptEngine,
      onLog: (entry) => storage.appendLlmLog(entry),
    })

    const result = await model.generateObject<{
      reasoning: string
      question: string
      options: Array<{ text: string; explanation: string }>
      answer_index: number
    }>({
      schema: quizLLMSchema,
      prompt: "quiz_edit",
      context: {
        ...buildLanguageContext(quizConfig.language),
        current_quiz: {
          question: baseQuiz.question,
          options: baseQuiz.options,
          answer_index: baseQuiz.answerIndex,
          reasoning: baseQuiz.reasoning,
        },
        instruction,
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
              `Option text exceeds 80 characters: "${opt.text.slice(0, 30)}..."`,
            )
          if (opt.explanation.length > 400)
            errors.push("Explanation exceeds 400 characters")
          if (!opt.text) errors.push("Option text is missing")
          if (!opt.explanation) errors.push("Option explanation is missing")
        }
        if (r.answer_index < 0 || r.answer_index >= r.options.length) {
          errors.push(
            `answer_index ${r.answer_index} is out of range [0, ${r.options.length - 1}]`,
          )
        }
        return { valid: errors.length === 0, errors }
      },
      maxRetries: quizConfig.maxRetries,
      timeoutMs: quizConfig.timeoutMs,
      log: {
        taskType: "quiz-generation",
        promptName: "quiz_edit",
      },
    })

    const shuffled = shuffleQuizOptions(
      result.object.options,
      result.object.answer_index,
    )

    return {
      quiz: {
        quizIndex: baseQuiz.quizIndex,
        afterPageId: baseQuiz.afterPageId,
        pageIds: baseQuiz.pageIds,
        question: result.object.question,
        options: shuffled.options,
        answerIndex: shuffled.answerIndex,
        reasoning: result.object.reasoning,
      },
      reasoning: result.object.reasoning,
    }
  } finally {
    storage.close()
    if (previousKey !== undefined) {
      process.env.OPENAI_API_KEY = previousKey
    } else {
      delete process.env.OPENAI_API_KEY
    }
  }
}
