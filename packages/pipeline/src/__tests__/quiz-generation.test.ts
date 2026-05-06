import { describe, expect, it, vi } from "vitest"
import type { AppConfig, PageSectioningOutput, WebRenderingOutput } from "@adt/types"
import type {
  GenerateObjectOptions,
  GenerateObjectResult,
  LLMModel,
} from "@adt/llm"
import {
  extractTextFromHtml,
  isContentPage,
  buildQuizBatches,
  buildQuizGenerationConfig,
  generateQuiz,
  generateQuizForSelection,
  generateAllQuizzes,
} from "../quiz-generation.js"
import type { QuizPageInput, QuizConfig, QuizBatch } from "../quiz-generation.js"

type FakeQuizResponse = {
  activity_type?: string
  reasoning: string
  question: string
  options?: Array<{ text: string; explanation: string }>
  answer_index?: number
  statements?: Array<{ text: string; answer: boolean }>
  blanks?: Array<{ prompt: string; answer: string }>
  pairs?: Array<{ item: string; match: string }>
}

function makeFakeLLMModel(
  response: FakeQuizResponse,
  onCall?: (options: GenerateObjectOptions) => void
): LLMModel {
  return {
    generateObject: async <T>(options: GenerateObjectOptions) => {
      onCall?.(options)
      return {
        object: response as T,
        usage: { inputTokens: 10, outputTokens: 10 },
      } as GenerateObjectResult<T>
    },
  }
}

function makeFakeLLMSequence(
  responses: FakeQuizResponse[],
  onCall?: (options: GenerateObjectOptions) => void
): LLMModel {
  let index = 0
  return {
    generateObject: async <T>(options: GenerateObjectOptions) => {
      onCall?.(options)
      const response = responses[index++] ?? responses[responses.length - 1]
      return {
        object: response as T,
        usage: { inputTokens: 10, outputTokens: 10 },
      } as GenerateObjectResult<T>
    },
  }
}

const validQuizResponse = {
  reasoning: "The text discusses photosynthesis.",
  question: "What do plants need for photosynthesis?",
  options: [
    { text: "1) Sunlight", explanation: "✅ Correct! Plants need sunlight." },
    { text: "2) Darkness", explanation: "❌ Not quite. Plants need light." },
    { text: "3) Sand", explanation: "❌ Not quite. Sand is not required." },
  ],
  answer_index: 0,
}

function makePageInput(
  pageId: string,
  html: string,
  isPruned = false,
  sectionType?: string
): QuizPageInput {
  return {
    pageId,
    rendering: {
      sections: [{ sectionIndex: 0, sectionType: sectionType ?? (isPruned ? "front_cover" : "text_only"), reasoning: "", html }],
    },
    sectioning: {
      reasoning: "",
      sections: [
        {
          sectionId: `${pageId}_sec001`,
          sectionType: sectionType ?? (isPruned ? "front_cover" : "text_only"),
          nodes: [],
          backgroundColor: "#ffffff",
          textColor: "#000000",
          pageNumber: null,
          isPruned,
        },
      ],
    },
  }
}

const DEFAULT_QUIZ_SECTION_TYPES = [
  "boxed_text",
  "text_only",
  "text_and_single_image",
  "text_and_images",
  "images_only",
]

/** When no quiz_section_types is in the config, the pipeline applies no section-type filter. */
const FALLBACK_QUIZ_SECTION_TYPES = undefined

describe("extractTextFromHtml", () => {
  it("strips HTML tags and returns plain text", () => {
    const html = "<section><h1>Hello</h1><p>World of <strong>plants</strong></p></section>"
    expect(extractTextFromHtml(html)).toBe("HelloWorld of plants")
  })

  it("returns empty string for empty HTML", () => {
    expect(extractTextFromHtml("")).toBe("")
  })

  it("handles nested elements", () => {
    const html = "<div><ul><li>Item 1</li><li>Item 2</li></ul></div>"
    expect(extractTextFromHtml(html)).toBe("Item 1Item 2")
  })
})

describe("isContentPage", () => {
  it("returns true when at least one section is not pruned", () => {
    const sectioning: PageSectioningOutput = {
      reasoning: "",
      sections: [
        { sectionId: "pg_sec001", sectionType: "front_cover", nodes: [], backgroundColor: "#fff", textColor: "#000", pageNumber: null, isPruned: true },
        { sectionId: "pg_sec002", sectionType: "text_only", nodes: [], backgroundColor: "#fff", textColor: "#000", pageNumber: null, isPruned: false },
      ],
    }
    expect(isContentPage(sectioning)).toBe(true)
  })

  it("returns false when all sections are pruned", () => {
    const sectioning: PageSectioningOutput = {
      reasoning: "",
      sections: [
        { sectionId: "pg_sec001", sectionType: "front_cover", nodes: [], backgroundColor: "#fff", textColor: "#000", pageNumber: null, isPruned: true },
      ],
    }
    expect(isContentPage(sectioning)).toBe(false)
  })

  it("filters by section type when quizSectionTypes provided", () => {
    const sectioning: PageSectioningOutput = {
      reasoning: "",
      sections: [
        { sectionId: "pg_sec001", sectionType: "activity_multiple_choice", nodes: [], backgroundColor: "#fff", textColor: "#000", pageNumber: null, isPruned: false },
      ],
    }
    expect(isContentPage(sectioning, ["text_only", "text_and_images"])).toBe(false)
    expect(isContentPage(sectioning, ["activity_multiple_choice"])).toBe(true)
  })

  it("treats undefined quizSectionTypes as no filter", () => {
    const sectioning: PageSectioningOutput = {
      reasoning: "",
      sections: [
        { sectionId: "pg_sec001", sectionType: "activity_multiple_choice", nodes: [], backgroundColor: "#fff", textColor: "#000", pageNumber: null, isPruned: false },
      ],
    }
    expect(isContentPage(sectioning, undefined)).toBe(true)
  })

  it("treats empty quizSectionTypes as matching no sections", () => {
    const sectioning: PageSectioningOutput = {
      reasoning: "",
      sections: [
        { sectionId: "pg_sec001", sectionType: "activity_multiple_choice", nodes: [], backgroundColor: "#fff", textColor: "#000", pageNumber: null, isPruned: false },
      ],
    }
    expect(isContentPage(sectioning, [])).toBe(false)
  })

  it("still excludes pruned sections even when type matches", () => {
    const sectioning: PageSectioningOutput = {
      reasoning: "",
      sections: [
        { sectionId: "pg_sec001", sectionType: "text_only", nodes: [], backgroundColor: "#fff", textColor: "#000", pageNumber: null, isPruned: true },
      ],
    }
    expect(isContentPage(sectioning, ["text_only"])).toBe(false)
  })
})

function autoConfig(overrides: Partial<QuizConfig> = {}): QuizConfig {
  return {
    language: "en",
    pagesPerQuiz: 3,
    promptName: "quiz_generation",
    modelId: "openai:gpt-5.4",
    maxRetries: 0,
    timeoutMs: 90_000,
    ...overrides,
  }
}

describe("buildQuizBatches (auto mode)", () => {
  it("groups content pages into batches and uses last page as afterPageId", () => {
    const pages = [
      makePageInput("pg001", "<p>Page 1</p>"),
      makePageInput("pg002", "<p>Page 2</p>"),
      makePageInput("pg003", "<p>Page 3</p>"),
      makePageInput("pg004", "<p>Page 4</p>"),
      makePageInput("pg005", "<p>Page 5</p>"),
    ]

    const batches = buildQuizBatches(pages, autoConfig({ pagesPerQuiz: 2 }))
    expect(batches).toHaveLength(3)
    expect(batches[0].pages.map((p) => p.pageId)).toEqual(["pg001", "pg002"])
    expect(batches[0].afterPageId).toBe("pg002")
    expect(batches[2].pages.map((p) => p.pageId)).toEqual(["pg005"])
    expect(batches[2].afterPageId).toBe("pg005")
  })

  it("skips non-content pages", () => {
    const pages = [
      makePageInput("pg001", "<p>Cover</p>", true),
      makePageInput("pg002", "<p>Content 1</p>"),
      makePageInput("pg003", "<p>Credits</p>", true),
      makePageInput("pg004", "<p>Content 2</p>"),
      makePageInput("pg005", "<p>Content 3</p>"),
    ]

    const batches = buildQuizBatches(pages, autoConfig({ pagesPerQuiz: 3 }))
    expect(batches).toHaveLength(1)
    expect(batches[0].pages.map((p) => p.pageId)).toEqual(["pg002", "pg004", "pg005"])
  })

  it("returns empty array when no content pages", () => {
    const pages = [makePageInput("pg001", "<p>Cover</p>", true)]
    expect(buildQuizBatches(pages, autoConfig())).toEqual([])
  })

  it("filters pages by quiz section types", () => {
    const pages = [
      makePageInput("pg001", "<p>Text</p>", false, "text_only"),
      makePageInput("pg002", "<p>Activity</p>", false, "activity_multiple_choice"),
      makePageInput("pg003", "<p>More text</p>", false, "text_and_images"),
    ]

    const batches = buildQuizBatches(
      pages,
      autoConfig({ pagesPerQuiz: 2, quizSectionTypes: ["text_only", "text_and_images"] })
    )
    expect(batches).toHaveLength(1)
    expect(batches[0].pages.map((p) => p.pageId)).toEqual(["pg001", "pg003"])
  })
})

describe("buildQuizBatches (custom groups mode)", () => {
  it("creates one batch per group with all selected pages in a single quiz", () => {
    const pages = [
      makePageInput("pg001", "<p>Page 1</p>"),
      makePageInput("pg002", "<p>Page 2</p>"),
      makePageInput("pg003", "<p>Page 3</p>"),
      makePageInput("pg004", "<p>Page 4</p>"),
      makePageInput("pg005", "<p>Page 5</p>"),
      makePageInput("pg006", "<p>Page 6</p>"),
      makePageInput("pg007", "<p>Page 7</p>"),
    ]

    const batches = buildQuizBatches(
      pages,
      autoConfig({
        quizGroups: [
          { source_page_ids: ["pg001", "pg002", "pg003", "pg004", "pg005", "pg006", "pg007"] },
        ],
      })
    )
    expect(batches).toHaveLength(1)
    expect(batches[0].pages).toHaveLength(7)
    // afterPageId defaults to the last source page
    expect(batches[0].afterPageId).toBe("pg007")
  })

  it("creates a separate batch for each group", () => {
    const pages = [
      makePageInput("pg001", "<p>Page 1</p>"),
      makePageInput("pg002", "<p>Page 2</p>"),
      makePageInput("pg003", "<p>Page 3</p>"),
      makePageInput("pg004", "<p>Page 4</p>"),
    ]

    const batches = buildQuizBatches(
      pages,
      autoConfig({
        quizGroups: [
          { source_page_ids: ["pg001", "pg002"] },
          { source_page_ids: ["pg003", "pg004"] },
        ],
      })
    )
    expect(batches).toHaveLength(2)
    expect(batches[0].afterPageId).toBe("pg002")
    expect(batches[1].afterPageId).toBe("pg004")
  })

  it("resolves insert_after: 'end' to the last page in the book", () => {
    const pages = [
      makePageInput("pg001", "<p>Page 1</p>"),
      makePageInput("pg002", "<p>Page 2</p>"),
      makePageInput("pg003", "<p>Page 3</p>"),
      makePageInput("pg099", "<p>Last</p>"),
    ]

    const batches = buildQuizBatches(
      pages,
      autoConfig({
        quizGroups: [
          { source_page_ids: ["pg001", "pg002"], insert_after: "end" },
          { source_page_ids: ["pg003"], insert_after: "end" },
        ],
      })
    )
    expect(batches).toHaveLength(2)
    expect(batches[0].afterPageId).toBe("pg099")
    expect(batches[1].afterPageId).toBe("pg099")
  })

  it("uses an explicit page id for insert_after when provided", () => {
    const pages = [
      makePageInput("pg001", "<p>Page 1</p>"),
      makePageInput("pg002", "<p>Page 2</p>"),
      makePageInput("pg003", "<p>Page 3</p>"),
    ]

    const batches = buildQuizBatches(
      pages,
      autoConfig({
        quizGroups: [
          { source_page_ids: ["pg001"], insert_after: "pg003" },
        ],
      })
    )
    expect(batches[0].afterPageId).toBe("pg003")
  })

  it("drops unknown page ids and skips groups that resolve to nothing", () => {
    const pages = [makePageInput("pg001", "<p>Page 1</p>")]

    const batches = buildQuizBatches(
      pages,
      autoConfig({
        quizGroups: [
          { source_page_ids: ["pg001", "ghost"] },
          { source_page_ids: ["only-ghost"] },
        ],
      })
    )
    expect(batches).toHaveLength(1)
    expect(batches[0].pages.map((p) => p.pageId)).toEqual(["pg001"])
  })

  it("does not apply section-type or pruned filters to user-picked pages", () => {
    const pages = [
      makePageInput("pg001", "<p>Cover</p>", true),
      makePageInput("pg002", "<p>Activity</p>", false, "activity_multiple_choice"),
    ]

    const batches = buildQuizBatches(
      pages,
      autoConfig({
        quizSectionTypes: ["text_only"],
        quizGroups: [{ source_page_ids: ["pg001", "pg002"] }],
      })
    )
    expect(batches).toHaveLength(1)
    expect(batches[0].pages.map((p) => p.pageId)).toEqual(["pg001", "pg002"])
  })

  it("uses custom mode and returns no batches when quizGroups is explicitly empty", () => {
    const pages = [
      makePageInput("pg001", "<p>Page 1</p>"),
      makePageInput("pg002", "<p>Page 2</p>"),
    ]
    const batches = buildQuizBatches(pages, autoConfig({ pagesPerQuiz: 2, quizGroups: [] }))
    expect(batches).toEqual([])
  })
})

describe("buildQuizGenerationConfig", () => {
  it("builds config with defaults", () => {
    const appConfig: AppConfig = {
      role_types: { section_text: "Body text" },
      structure_types: { paragraph: "Paragraph" },
    }
    const config = buildQuizGenerationConfig(appConfig, "en")
    expect(config).toEqual({
      language: "en",
      pagesPerQuiz: 3,
      quizSectionTypes: FALLBACK_QUIZ_SECTION_TYPES,
      quizGroups: undefined,
      activityType: "multiple_choice",
      promptName: "quiz_generation",
      modelId: "openai:gpt-5.4",
      maxRetries: 5,
      timeoutMs: 90_000,
    })
  })

  it("uses editing_language over detected language", () => {
    const appConfig: AppConfig = {
      role_types: { section_text: "Body text" },
      structure_types: { paragraph: "Paragraph" },
      editing_language: "fr",
    }
    const config = buildQuizGenerationConfig(appConfig, "en")
    expect(config?.language).toBe("fr")
  })

  it("uses quiz_generation config overrides", () => {
    const appConfig: AppConfig = {
      role_types: { section_text: "Body text" },
      structure_types: { paragraph: "Paragraph" },
      quiz_generation: {
        pages_per_quiz: 5,
        model: "openai:gpt-4.1",
        prompt: "custom_quiz",
        max_retries: 4,
        timeout: 120,
        quiz_section_types: ["text_only"],
      },
    }
    const config = buildQuizGenerationConfig(appConfig, "en")
    expect(config).toEqual({
      language: "en",
      pagesPerQuiz: 5,
      quizSectionTypes: ["text_only"],
      quizGroups: undefined,
      activityType: "multiple_choice",
      promptName: "custom_quiz",
      modelId: "openai:gpt-4.1",
      maxRetries: 4,
      timeoutMs: 120_000,
    })
  })

  it("threads quiz_groups into config", () => {
    const appConfig: AppConfig = {
      role_types: { section_text: "Body text" },
      structure_types: { paragraph: "Paragraph" },
      quiz_generation: {
        quiz_groups: [
          { source_page_ids: ["pg002", "pg007"], insert_after: "end" },
        ],
      },
    }
    const config = buildQuizGenerationConfig(appConfig, "en")
    expect(config?.quizGroups).toEqual([
      { source_page_ids: ["pg002", "pg007"], insert_after: "end" },
    ])
  })

  it("returns null when no language available", () => {
    const appConfig: AppConfig = {
      role_types: { section_text: "Body text" },
      structure_types: { paragraph: "Paragraph" },
    }
    expect(buildQuizGenerationConfig(appConfig, null)).toBeNull()
  })
})

describe("generateQuiz", () => {
  it("passes correct prompt and context to LLM", async () => {
    let capturedOptions: GenerateObjectOptions | null = null
    const llmModel = makeFakeLLMModel(validQuizResponse, (options) => {
      capturedOptions = options
    })

    const batch: QuizBatch = {
      pages: [
        makePageInput("pg001", "<p>Photosynthesis is the process...</p>"),
        makePageInput("pg002", "<p>Plants use sunlight...</p>"),
      ],
      afterPageId: "pg002",
    }

    const config = {
      language: "en",
      pagesPerQuiz: 2,
      quizSectionTypes: DEFAULT_QUIZ_SECTION_TYPES,
      promptName: "quiz_generation",
      modelId: "openai:gpt-5.4",
      maxRetries: 2,
      timeoutMs: 90_000,
    }

    const randomSpy = vi
      .spyOn(Math, "random")
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.99)
    const quiz = await generateQuiz(batch, 0, config, llmModel)
    randomSpy.mockRestore()

    expect(capturedOptions?.prompt).toBe("quiz_generation")
    expect(capturedOptions?.context?.language_code).toBe("en")
    expect(capturedOptions?.context?.language).toBe("English")
    const pageTexts = capturedOptions?.context?.page_texts as Array<{
      pageId: string
      text: string
    }>
    expect(pageTexts).toHaveLength(2)
    expect(pageTexts[0].pageId).toBe("pg001")
    expect(pageTexts[0].text).toContain("Photosynthesis")
    expect(capturedOptions?.context?.individual_pages).toEqual(pageTexts)

    expect(quiz.quizIndex).toBe(0)
    expect(quiz.afterPageId).toBe("pg002")
    expect(quiz.pageIds).toEqual(["pg001", "pg002"])
    expect(quiz.question).toBe(validQuizResponse.question)
    expect(quiz.options).toEqual(validQuizResponse.options)
    expect(quiz.answerIndex).toBe(0)
    expect(capturedOptions?.context?.activity_type).toBe("multiple_choice")
    expect(capturedOptions?.context?.question_number).toBe(1)
    expect(capturedOptions?.context?.questions_per_quiz).toBe(1)
  })

  it("shuffles options and renumbers answer labels", async () => {
    const llmModel = makeFakeLLMModel(validQuizResponse)

    const batch: QuizBatch = {
      pages: [makePageInput("pg001", "<p>Content</p>")],
      afterPageId: "pg001",
    }
    const config = {
      language: "en",
      pagesPerQuiz: 1,
      quizSectionTypes: DEFAULT_QUIZ_SECTION_TYPES,
      promptName: "quiz_generation",
      modelId: "openai:gpt-5.4",
      maxRetries: 0,
      timeoutMs: 90_000,
    }

    const randomSpy = vi
      .spyOn(Math, "random")
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0.0)
    const quiz = await generateQuiz(batch, 0, config, llmModel)
    randomSpy.mockRestore()

    expect(quiz.options.map((opt) => opt.text)).toEqual([
      "1) Darkness",
      "2) Sunlight",
      "3) Sand",
    ])
    expect(quiz.options[0].explanation).toBe(
      "❌ Not quite. Plants need light."
    )
    expect(quiz.answerIndex).toBe(1)
  })

  it("validation catches wrong option count", async () => {
    const badResponse = {
      ...validQuizResponse,
      options: [validQuizResponse.options[0]],
    }
    let capturedOptions: GenerateObjectOptions | null = null
    const llmModel = makeFakeLLMModel(badResponse, (options) => {
      capturedOptions = options
    })

    const batch: QuizBatch = {
      pages: [makePageInput("pg001", "<p>Content</p>")],
      afterPageId: "pg001",
    }
    const config = {
      language: "en",
      pagesPerQuiz: 1,
      quizSectionTypes: DEFAULT_QUIZ_SECTION_TYPES,
      promptName: "quiz_generation",
      modelId: "openai:gpt-5.4",
      maxRetries: 0,
      timeoutMs: 90_000,
    }

    await generateQuiz(batch, 0, config, llmModel)

    const validation = capturedOptions?.validate?.(badResponse, {})
    expect(validation?.valid).toBe(false)
    expect(validation?.errors[0]).toContain("at least 2 options")
  })
})

describe("generateQuizForSelection", () => {
  it("calls the LLM once per requested question and returns one parent quiz", async () => {
    const contexts: Array<Record<string, unknown>> = []
    let callCount = 0
    const llmModel = makeFakeLLMSequence(
      [
        {
          ...validQuizResponse,
          activity_type: "multiple_choice",
          question: "Which process helps plants make food?",
        },
        {
          ...validQuizResponse,
          activity_type: "multiple_choice",
          question: "Which energy source supports photosynthesis?",
        },
        {
          ...validQuizResponse,
          activity_type: "multiple_choice",
          question: "What do roots usually absorb from soil?",
        },
      ],
      (options) => {
        callCount++
        contexts.push(options.context as Record<string, unknown>)
      }
    )

    const batch: QuizBatch = {
      pages: [
        makePageInput("pg001", "<p>Plants make food through photosynthesis.</p>"),
        makePageInput("pg002", "<p>Roots absorb water from the soil.</p>"),
      ],
      afterPageId: "pg002",
    }
    const config = autoConfig({ pagesPerQuiz: 2 })

    const quiz = await generateQuizForSelection(batch, 0, config, llmModel, {
      activityType: "multiple_choice",
      questionsPerQuiz: 3,
    })

    expect(callCount).toBe(3)
    expect(quiz.quizIndex).toBe(0)
    expect(quiz.pageIds).toEqual(["pg001", "pg002"])
    expect(quiz.afterPageId).toBe("pg002")
    expect(quiz.questions).toHaveLength(3)
    expect(quiz.question).toBe("Which process helps plants make food?")
    expect(quiz.questions?.map((q) => q.question)).toEqual([
      "Which process helps plants make food?",
      "Which energy source supports photosynthesis?",
      "What do roots usually absorb from soil?",
    ])
  })

  it("passes question numbering and previous question text into prompt context", async () => {
    const contexts: Array<Record<string, unknown>> = []
    const llmModel = makeFakeLLMSequence(
      [
        {
          ...validQuizResponse,
          activity_type: "multiple_choice",
          question: "Which part of a plant takes in water?",
        },
        {
          ...validQuizResponse,
          activity_type: "multiple_choice",
          question: "Which part of a plant makes seeds?",
        },
        {
          ...validQuizResponse,
          activity_type: "multiple_choice",
          question: "Which part of a plant holds it upright?",
        },
      ],
      (options) => {
        contexts.push(options.context as Record<string, unknown>)
      }
    )

    const batch: QuizBatch = {
      pages: [makePageInput("pg001", "<p>Roots, flowers, and stems are plant parts.</p>")],
      afterPageId: "pg001",
    }

    await generateQuizForSelection(batch, 0, autoConfig({ pagesPerQuiz: 1 }), llmModel, {
      activityType: "multiple_choice",
      questionsPerQuiz: 3,
    })

    expect(contexts.map((context) => context.question_number)).toEqual([1, 2, 3])
    expect(contexts.map((context) => context.questions_per_quiz)).toEqual([3, 3, 3])
    expect(contexts[0].previous_questions).toEqual([])
    expect(contexts[1].previous_questions).toEqual([
      {
        activity_type: "multiple_choice",
        duplicate_keys: ["which part of a plant takes in water?"],
        question: "Which part of a plant takes in water?",
        question_number: 1,
      },
    ])
    expect(contexts[2].previous_questions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          question: "Which part of a plant makes seeds?",
        }),
      ])
    )
  })
})

describe("generateAllQuizzes", () => {
  it("generates correct number of quizzes", async () => {
    let callCount = 0
    const llmModel = makeFakeLLMModel(validQuizResponse, () => {
      callCount++
    })

    const pages = [
      makePageInput("pg001", "<p>Page 1</p>"),
      makePageInput("pg002", "<p>Page 2</p>"),
      makePageInput("pg003", "<p>Page 3</p>"),
      makePageInput("pg004", "<p>Page 4</p>"),
      makePageInput("pg005", "<p>Page 5</p>"),
    ]

    const config = {
      language: "en",
      pagesPerQuiz: 2,
      quizSectionTypes: DEFAULT_QUIZ_SECTION_TYPES,
      promptName: "quiz_generation",
      modelId: "openai:gpt-5.4",
      maxRetries: 2,
      timeoutMs: 90_000,
    }

    const result = await generateAllQuizzes(pages, config, llmModel)

    expect(result.quizzes).toHaveLength(3)
    expect(result.language).toBe("en")
    expect(result.pagesPerQuiz).toBe(2)
    expect(result.generatedAt).toBeTruthy()
    expect(callCount).toBe(3)

    expect(result.quizzes[0].quizIndex).toBe(0)
    expect(result.quizzes[1].quizIndex).toBe(1)
    expect(result.quizzes[2].quizIndex).toBe(2)
  })

  it("emits one quiz per group with explicit afterPageId", async () => {
    const llmModel = makeFakeLLMModel(validQuizResponse)
    const pages = [
      makePageInput("pg001", "<p>Page 1</p>"),
      makePageInput("pg002", "<p>Page 2</p>"),
      makePageInput("pg003", "<p>Page 3</p>"),
      makePageInput("pg004", "<p>Page 4</p>"),
      makePageInput("pg099", "<p>Last</p>"),
    ]

    const config: QuizConfig = autoConfig({
      quizGroups: [
        { source_page_ids: ["pg001", "pg002", "pg003"] },
        { source_page_ids: ["pg004"], insert_after: "end" },
      ],
    })

    const result = await generateAllQuizzes(pages, config, llmModel)

    expect(result.quizzes).toHaveLength(2)
    expect(result.quizzes[0].pageIds).toEqual(["pg001", "pg002", "pg003"])
    expect(result.quizzes[0].afterPageId).toBe("pg003")
    expect(result.quizzes[1].pageIds).toEqual(["pg004"])
    expect(result.quizzes[1].afterPageId).toBe("pg099")
  })
})
