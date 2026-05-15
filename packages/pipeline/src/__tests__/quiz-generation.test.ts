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
  answer_indexes?: number[]
  statements?: Array<{ text: string; answer: boolean }>
  blanks?: Array<{ prompt: string; answer: string }>
  sample_answer?: string
  guidance?: string
  pairs?: Array<{ item: string; match: string }>
  categories?: Array<{ label: string }>
  items?: Array<{ item: string; category: string }>
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
    expect(extractTextFromHtml(html)).toBe("Hello\nWorld of plants")
  })

  it("returns empty string for empty HTML", () => {
    expect(extractTextFromHtml("")).toBe("")
  })

  it("handles nested elements", () => {
    const html = "<div><ul><li>Item 1</li><li>Item 2</li></ul></div>"
    expect(extractTextFromHtml(html)).toBe("Item 1\nItem 2")
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
      multipleChoiceOptionCount: 4,
      openEndedCharacterLimit: 250,
      matchingPairCount: 6,
      sortingItemCount: 6,
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
        multiple_choice_option_count: 5,
        open_ended_character_limit: 500,
        matching_pair_count: 4,
        sorting_item_count: 5,
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
      multipleChoiceOptionCount: 5,
      openEndedCharacterLimit: 500,
      matchingPairCount: 4,
      sortingItemCount: 5,
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
    expect(capturedOptions?.context?.open_ended_character_limit).toBe(250)
    expect(capturedOptions?.context?.matching_pair_count).toBe(6)
    expect(capturedOptions?.context?.sorting_item_count).toBe(6)
    expect(capturedOptions?.context?.question_number).toBe(1)
    expect(capturedOptions?.context?.questions_per_quiz).toBe(1)
  })

  it("passes reusable activity template into prompt context and stores it on the quiz", async () => {
    let capturedOptions: GenerateObjectOptions | null = null
    const template = {
      id: "custom-1",
      name: "My workbook style",
      style: "worksheet_rows" as const,
      generationMode: "template_single_page" as const,
      instructions: "Keep every activity compact and table-like.",
    }
    const llmModel = makeFakeLLMModel(validQuizResponse, (options) => {
      capturedOptions = options
    })

    const quiz = await generateQuiz(
      { pages: [makePageInput("pg001", "<p>Plants use sunlight.</p>")], afterPageId: "pg001" },
      0,
      autoConfig(),
      llmModel,
      { activityType: "multiple_choice", template }
    )

    expect(capturedOptions?.context?.activity_template).toEqual({
      name: "My workbook style",
      style: "worksheet_rows",
      generation_mode: "template_single_page",
      instructions: "Keep every activity compact and table-like.",
    })
    expect(quiz.template).toEqual(template)
  })

  it("requests and validates configured four multiple-choice options", async () => {
    let capturedOptions: GenerateObjectOptions | null = null
    const template = {
      id: "practice-cards",
      name: "Practice cards",
      style: "practice_cards" as const,
      generationMode: "template_single_page" as const,
    }
    const response: FakeQuizResponse = {
      reasoning: "The page describes what Karma eats.",
      activity_type: "multiple_choice",
      question: "What did Karma like to eat?",
      options: [
        { text: "1) Tree leaves", explanation: "Correct." },
        { text: "2) Bananas", explanation: "No." },
        { text: "3) Big red chillies", explanation: "No." },
        { text: "4) Mangoes", explanation: "No." },
      ],
      answer_index: 0,
    }
    const llmModel: LLMModel = {
      generateObject: async <T>(options: GenerateObjectOptions) => {
        capturedOptions = options
        const invalid = options.validate?.({
          ...response,
          options: response.options?.slice(0, 3),
        })
        const valid = options.validate?.(response)
        expect(invalid?.valid).toBe(false)
        expect(invalid?.errors.join(" ")).toContain("exactly 4 options")
        expect(valid?.valid).toBe(true)
        return {
          object: response as T,
          usage: { inputTokens: 10, outputTokens: 10 },
        } as GenerateObjectResult<T>
      },
    }

    const randomSpy = vi
      .spyOn(Math, "random")
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.99)
    const quiz = await generateQuiz(
      { pages: [makePageInput("pg001", "<p>Karma liked tree leaves.</p>")], afterPageId: "pg001" },
      0,
      autoConfig(),
      llmModel,
      { activityType: "multiple_choice", template }
    )
    randomSpy.mockRestore()

    expect(capturedOptions?.context?.multiple_choice_option_count).toBe(4)
    expect(quiz.options).toHaveLength(4)
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

  it("renumbers non-ASCII and dotted option prefixes", async () => {
    const response: FakeQuizResponse = {
      reasoning: "The page describes what plants need.",
      activity_type: "multiple_choice",
      question: "What do plants need?",
      options: [
        { text: "১) Sunlight", explanation: "Correct." },
        { text: "2. Darkness", explanation: "No." },
        { text: "٣) Sand", explanation: "No." },
        { text: "4) Ice", explanation: "No." },
      ],
      answer_index: 0,
    }
    const randomSpy = vi
      .spyOn(Math, "random")
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.99)

    const quiz = await generateQuiz(
      { pages: [makePageInput("pg001", "<p>Plants need sunlight.</p>")], afterPageId: "pg001" },
      0,
      autoConfig(),
      makeFakeLLMModel(response),
      { activityType: "multiple_choice" }
    )
    randomSpy.mockRestore()

    expect(quiz.options?.map((option) => option.text)).toEqual([
      "1) Sunlight",
      "2) Darkness",
      "3) Sand",
      "4) Ice",
    ])
  })

  it("generates multiple-select questions with multiple answer indexes", async () => {
    const response: FakeQuizResponse = {
      reasoning: "The page names plant parts.",
      activity_type: "multiple_select",
      question: "Which are parts of a plant?",
      options: [
        { text: "1) Root", explanation: "Correct." },
        { text: "2) Cloud", explanation: "No." },
        { text: "3) Stem", explanation: "Correct." },
        { text: "4) Stone", explanation: "No." },
      ],
      answer_indexes: [0, 2],
    }
    const llmModel = makeFakeLLMModel(response)
    const randomSpy = vi
      .spyOn(Math, "random")
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.99)

    const quiz = await generateQuiz(
      { pages: [makePageInput("pg001", "<p>Root and stem are plant parts.</p>")], afterPageId: "pg001" },
      0,
      autoConfig(),
      llmModel,
      { activityType: "multiple_select" }
    )
    randomSpy.mockRestore()

    expect(quiz.activityType).toBe("multiple_select")
    expect(quiz.answerIndexes).toEqual([0, 2])
  })

  it("generates sorting questions with categories and sortable items", async () => {
    const response: FakeQuizResponse = {
      reasoning: "The page contrasts animals and plants.",
      activity_type: "sorting",
      question: "Sort the items.",
      categories: [{ label: "Animals" }, { label: "Plants" }],
      items: [
        { item: "Elephant", category: "Animals" },
        { item: "Bamboo", category: "Plants" },
      ],
    }
    const llmModel = makeFakeLLMModel(response)

    const quiz = await generateQuiz(
      { pages: [makePageInput("pg001", "<p>Elephant is an animal. Bamboo is a plant.</p>")], afterPageId: "pg001" },
      0,
      autoConfig(),
      llmModel,
      { activityType: "sorting" }
    )

    expect(quiz.activityType).toBe("sorting")
    expect(quiz.categories).toEqual([{ label: "Animals" }, { label: "Plants" }])
    expect(quiz.sortingItems).toEqual([
      { item: "Elephant", category: "Animals" },
      { item: "Bamboo", category: "Plants" },
    ])
  })

  it("validates configured matching and sorting item limits", async () => {
    const matchingResponse: FakeQuizResponse = {
      reasoning: "The page lists animal facts.",
      activity_type: "drag_and_drop",
      question: "Match the pairs.",
      pairs: [
        { item: "Elephant", match: "Animal" },
        { item: "Bamboo", match: "Plant" },
        { item: "River", match: "Water" },
        { item: "Sun", match: "Light" },
      ],
    }
    let matchingOptions: GenerateObjectOptions | null = null
    await generateQuiz(
      { pages: [makePageInput("pg001", "<p>Content</p>")], afterPageId: "pg001" },
      0,
      autoConfig({ matchingPairCount: 3 }),
      makeFakeLLMModel(matchingResponse, (options) => {
        matchingOptions = options
      }),
      { activityType: "drag_and_drop" }
    )
    expect(matchingOptions?.context?.matching_pair_count).toBe(3)
    expect(matchingOptions?.validate?.(matchingResponse, {})?.errors.join(" ")).toContain("2-3 pairs")

    const sortingResponse: FakeQuizResponse = {
      reasoning: "The page contrasts animals and plants.",
      activity_type: "sorting",
      question: "Sort the items.",
      categories: [{ label: "Animals" }, { label: "Plants" }],
      items: [
        { item: "Elephant", category: "Animals" },
        { item: "Tiger", category: "Animals" },
        { item: "Bamboo", category: "Plants" },
        { item: "Mango", category: "Plants" },
      ],
    }
    let sortingOptions: GenerateObjectOptions | null = null
    await generateQuiz(
      { pages: [makePageInput("pg001", "<p>Content</p>")], afterPageId: "pg001" },
      0,
      autoConfig({ sortingItemCount: 3 }),
      makeFakeLLMModel(sortingResponse, (options) => {
        sortingOptions = options
      }),
      { activityType: "sorting" }
    )
    expect(sortingOptions?.context?.sorting_item_count).toBe(3)
    expect(sortingOptions?.validate?.(sortingResponse, {})?.errors.join(" ")).toContain("2-3 items")
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
    expect(validation?.errors[0]).toContain("exactly 4 options")
  })

  it("generates open-ended questions for learner-written answers", async () => {
    const response: FakeQuizResponse = {
      reasoning: "The page invites a personal explanation.",
      activity_type: "open_ended",
      question: "Why do you think Karma asked for help?",
      sample_answer: "Karma needed help because she could not solve the problem alone.",
      guidance: "Look for a reason tied to the story event.",
    }
    let capturedOptions: GenerateObjectOptions | null = null
    const llmModel = makeFakeLLMModel(response, (options) => {
      capturedOptions = options
    })

    const quiz = await generateQuiz(
      { pages: [makePageInput("pg001", "<p>Karma asked a friend for help.</p>")], afterPageId: "pg001" },
      0,
      autoConfig(),
      llmModel,
      { activityType: "open_ended" }
    )

    expect(capturedOptions?.context?.activity_type).toBe("open_ended")
    expect(capturedOptions?.context?.open_ended_character_limit).toBe(250)
    expect(quiz.activityType).toBe("open_ended")
    expect(quiz.question).toBe("Why do you think Karma asked for help?")
    expect(quiz.sampleAnswer).toBe("Karma needed help because she could not solve the problem alone.")
    expect(quiz.guidance).toBe("Look for a reason tied to the story event.")
    expect(quiz.responseCharacterLimit).toBe(250)
  })

  it("generates true/false questions with statements", async () => {
    const response: FakeQuizResponse = {
      reasoning: "The text states what plants need.",
      activity_type: "true_false",
      question: "Decide whether each statement is true.",
      statements: [
        { text: "Plants need sunlight.", answer: true },
        { text: "Plants grow best in complete darkness.", answer: false },
      ],
    }

    const quiz = await generateQuiz(
      { pages: [makePageInput("pg001", "<p>Plants need sunlight.</p>")], afterPageId: "pg001" },
      0,
      autoConfig(),
      makeFakeLLMModel(response),
      { activityType: "true_false" }
    )

    expect(quiz.activityType).toBe("true_false")
    expect(quiz.statements).toEqual(response.statements)
  })

  it("generates fill-in-the-blank questions and rejects question prompts", async () => {
    const response: FakeQuizResponse = {
      reasoning: "The sentence can be completed from the page.",
      activity_type: "fill_in_the_blank",
      question: "Fill in the blank.",
      blanks: [{ prompt: "Plants use ____ to make food.", answer: "sunlight" }],
    }
    let capturedOptions: GenerateObjectOptions | null = null

    const quiz = await generateQuiz(
      { pages: [makePageInput("pg001", "<p>Plants use sunlight to make food.</p>")], afterPageId: "pg001" },
      0,
      autoConfig(),
      makeFakeLLMModel(response, (options) => {
        capturedOptions = options
      }),
      { activityType: "fill_in_the_blank" }
    )

    expect(quiz.activityType).toBe("fill_in_the_blank")
    expect(quiz.blanks).toEqual(response.blanks)

    const validation = capturedOptions?.validate?.(
      { ...response, blanks: [{ prompt: "What do plants use ____?", answer: "sunlight" }] },
      {}
    )
    expect(validation?.valid).toBe(false)
    expect(validation?.errors.join(" ")).toContain("cloze sentence")
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

  it("preserves responseCharacterLimit for multi-question open-ended selections", async () => {
    const response: FakeQuizResponse = {
      activity_type: "open_ended",
      reasoning: "r",
      question: "Why?",
      sample_answer: "Because.",
      guidance: "g",
    }
    const llmModel = makeFakeLLMSequence([
      response,
      { ...response, question: "Why2?" },
    ])

    const quiz = await generateQuizForSelection(
      { pages: [makePageInput("pg001", "<p>x</p>")], afterPageId: "pg001" },
      0,
      autoConfig({ openEndedCharacterLimit: 500 }),
      llmModel,
      { activityType: "open_ended", questionsPerQuiz: 2 }
    )

    expect(quiz.responseCharacterLimit).toBe(500)
    expect(quiz.questions?.every((q) => q.responseCharacterLimit === 500)).toBe(true)
  })

  it("validation catches duplicate generated questions across sub-questions", async () => {
    const capturedValidations: Array<GenerateObjectOptions["validate"]> = []
    const duplicateResponse = {
      ...validQuizResponse,
      activity_type: "multiple_choice",
      question: "Which part of a plant takes in water?",
    }
    const llmModel = makeFakeLLMSequence(
      [duplicateResponse, duplicateResponse],
      (options) => {
        capturedValidations.push(options.validate)
      }
    )

    await generateQuizForSelection(
      { pages: [makePageInput("pg001", "<p>Roots take in water.</p>")], afterPageId: "pg001" },
      0,
      autoConfig({ pagesPerQuiz: 1 }),
      llmModel,
      { activityType: "multiple_choice", questionsPerQuiz: 2 }
    )

    const validation = capturedValidations[1]?.(duplicateResponse, {})
    expect(validation?.valid).toBe(false)
    expect(validation?.errors.join(" ")).toContain("duplicates a previous question")
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
