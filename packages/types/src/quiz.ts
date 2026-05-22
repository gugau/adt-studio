import { z } from "zod"

export const QuizActivityType = z.enum([
  "multiple_choice",
  "multiple_select",
  "true_false",
  "fill_in_the_blank",
  "open_ended",
  "drag_and_drop",
  "sorting",
])
export type QuizActivityType = z.infer<typeof QuizActivityType>

export const ActivityTemplateStyle = z.enum([
  "worksheet_rows",
  "practice_cards",
  "quick_check",
  "guided_steps",
  "clean_workbook",
  "card_practice",
  "compact_review",
])
export type ActivityTemplateStyle = z.infer<typeof ActivityTemplateStyle>

export const ActivityGenerationMode = z.enum([
  "template_single_page",
  "template_multi_step",
  "ai_generated_layout",
])
export type ActivityGenerationMode = z.infer<typeof ActivityGenerationMode>

export const ActivityTemplate = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(80),
  style: ActivityTemplateStyle.default("worksheet_rows"),
  generationMode: ActivityGenerationMode.default("template_single_page"),
  instructions: z.string().max(1000).optional(),
})
export type ActivityTemplate = z.infer<typeof ActivityTemplate>

export const QuizImageAsset = z.object({
  imageId: z.string().min(1),
  alt: z.string().optional(),
})
export type QuizImageAsset = z.infer<typeof QuizImageAsset>

export const QuizOption = z.object({
  text: z.string(),
  explanation: z.string(),
  image: QuizImageAsset.optional(),
})
export type QuizOption = z.infer<typeof QuizOption>

export const QuizStatement = z.object({
  text: z.string(),
  answer: z.boolean(),
})
export type QuizStatement = z.infer<typeof QuizStatement>

export const QuizBlank = z.object({
  prompt: z.string(),
  answer: z.string(),
  explanation: z.string().optional(),
})
export type QuizBlank = z.infer<typeof QuizBlank>

export const QuizMatchPair = z.object({
  item: z.string(),
  match: z.string(),
  itemImage: QuizImageAsset.optional(),
  matchImage: QuizImageAsset.optional(),
  explanation: z.string().optional(),
})
export type QuizMatchPair = z.infer<typeof QuizMatchPair>

export const QuizSortingCategory = z.object({
  label: z.string(),
})
export type QuizSortingCategory = z.infer<typeof QuizSortingCategory>

export const QuizSortingItem = z.object({
  item: z.string(),
  category: z.string(),
  image: QuizImageAsset.optional(),
  explanation: z.string().optional(),
})
export type QuizSortingItem = z.infer<typeof QuizSortingItem>

const QuizQuestionFields = z.object({
  activityType: QuizActivityType.default("multiple_choice"),
  question: z.string(),
  options: z.array(QuizOption).optional(),
  answerIndex: z.number().int().min(0).optional(),
  answerIndexes: z.array(z.number().int().min(0)).optional(),
  statements: z.array(QuizStatement).optional(),
  blanks: z.array(QuizBlank).optional(),
  pairs: z.array(QuizMatchPair).optional(),
  categories: z.array(QuizSortingCategory).optional(),
  sortingItems: z.array(QuizSortingItem).optional(),
  sampleAnswer: z.string().optional(),
  guidance: z.string().optional(),
  responseCharacterLimit: z.number().int().min(1).optional(),
  reasoning: z.string(),
})

function countBlankMarkers(text: string): number {
  return (text.match(/____/g) ?? []).length
}

function validateQuizQuestionShape(
  q: z.infer<typeof QuizQuestionFields>,
  ctx: z.RefinementCtx
): void {
  if (q.activityType === "multiple_choice") {
    if (!q.options || q.options.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "multiple_choice quizzes must include at least 2 options",
        path: ["options"],
      })
    }
    if (
      q.answerIndex === undefined ||
      q.answerIndex < 0 ||
      !q.options ||
      q.answerIndex >= q.options.length
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "multiple_choice quizzes must include a valid answerIndex",
        path: ["answerIndex"],
      })
    }
  }

  if (q.activityType === "multiple_select") {
    if (!q.options || q.options.length < 3 || q.options.length > 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "multiple_select quizzes must include 3 to 6 options",
        path: ["options"],
      })
    }
    const answerIndexes = q.answerIndexes ?? []
    const uniqueAnswerIndexes = new Set(answerIndexes)
    if (answerIndexes.length < 2 || uniqueAnswerIndexes.size !== answerIndexes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "multiple_select quizzes must include at least 2 unique answerIndexes",
        path: ["answerIndexes"],
      })
    }
    if (!q.options || answerIndexes.some((index) => index >= q.options!.length)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "multiple_select quizzes must include valid answerIndexes",
        path: ["answerIndexes"],
      })
    }
  }

  if (q.activityType === "true_false") {
    if (!q.statements || q.statements.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "true_false quizzes must include at least 1 statement",
        path: ["statements"],
      })
    }
  }

  if (q.activityType === "fill_in_the_blank") {
    if (!q.blanks || q.blanks.length < 1 || q.blanks.length > 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fill_in_the_blank quizzes must include 1 to 5 blanks",
        path: ["blanks"],
      })
    }
    q.blanks?.forEach((blank, index) => {
      if (countBlankMarkers(blank.prompt) !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "fill_in_the_blank prompts must include exactly one ____ marker",
          path: ["blanks", index, "prompt"],
        })
      }
    })
  }

  if (q.activityType === "open_ended") {
    if (!q.question.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "open_ended quizzes must include a prompt",
        path: ["question"],
      })
    }
  }

  if (q.activityType === "drag_and_drop") {
    if (!q.pairs || q.pairs.length < 2 || q.pairs.length > 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "drag_and_drop quizzes must include 2 to 6 pairs",
        path: ["pairs"],
      })
    }
    const seen = new Set<string>()
    q.pairs?.forEach((pair, index) => {
      const key = `${pair.item.trim().toLowerCase()}\u0000${pair.match.trim().toLowerCase()}`
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "drag_and_drop pairs must be unique",
          path: ["pairs", index],
        })
      }
      seen.add(key)
    })
  }

  if (q.activityType === "sorting") {
    if (!q.categories || q.categories.length < 2 || q.categories.length > 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "sorting quizzes must include 2 to 5 categories",
        path: ["categories"],
      })
    }
    if (!q.sortingItems || q.sortingItems.length < 2 || q.sortingItems.length > 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "sorting quizzes must include 2 to 10 items",
        path: ["sortingItems"],
      })
    }

    const categoryKeys = new Set<string>()
    q.categories?.forEach((category, index) => {
      const key = category.label.trim().toLowerCase()
      if (!key) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "sorting category labels must not be empty",
          path: ["categories", index, "label"],
        })
      }
      if (categoryKeys.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "sorting category labels must be unique",
          path: ["categories", index, "label"],
        })
      }
      categoryKeys.add(key)
    })

    const itemKeys = new Set<string>()
    q.sortingItems?.forEach((item, index) => {
      const itemKey = item.item.trim().toLowerCase()
      if (!itemKey) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "sorting item text must not be empty",
          path: ["sortingItems", index, "item"],
        })
      }
      if (itemKeys.has(itemKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "sorting item text must be unique",
          path: ["sortingItems", index, "item"],
        })
      }
      itemKeys.add(itemKey)
      if (!categoryKeys.has(item.category.trim().toLowerCase())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "sorting item category must match one of the category labels",
          path: ["sortingItems", index, "category"],
        })
      }
    })
  }
}

export const QuizQuestion = QuizQuestionFields.superRefine(validateQuizQuestionShape)
export type QuizQuestion = z.infer<typeof QuizQuestion>

export const Quiz = QuizQuestionFields.extend({
  quizIndex: z.number().int(),
  afterPageId: z.string(),
  pageIds: z.array(z.string()),
  isPruned: z.boolean().default(false),
  template: ActivityTemplate.optional(),
  questions: z.array(QuizQuestion).optional(),
  sourceTextbookActivityId: z.string().optional(),
}).superRefine(validateQuizQuestionShape)
export type Quiz = z.infer<typeof Quiz>

export const QuizGenerationOutput = z.object({
  generatedAt: z.string(),
  language: z.string(),
  pagesPerQuiz: z.number().int(),
  quizzes: z.array(Quiz),
})
export type QuizGenerationOutput = z.infer<typeof QuizGenerationOutput>

const quizLLMBase = z.object({
  activity_type: QuizActivityType,
  reasoning: z.string(),
  question: z.string(),
})

export const multipleChoiceQuizLLMSchema = quizLLMBase.extend({
  activity_type: z.literal("multiple_choice"),
  options: z.array(
    z.object({
      text: z.string(),
      explanation: z.string(),
    })
  ),
  answer_index: z.number().int(),
})

export const multipleSelectQuizLLMSchema = quizLLMBase.extend({
  activity_type: z.literal("multiple_select"),
  options: z.array(
    z.object({
      text: z.string(),
      explanation: z.string(),
    })
  ),
  answer_indexes: z.array(z.number().int()),
})

export const trueFalseQuizLLMSchema = quizLLMBase.extend({
  activity_type: z.literal("true_false"),
  statements: z.array(
    z.object({
      text: z.string(),
      answer: z.boolean(),
    })
  ),
})

export const fillInTheBlankQuizLLMSchema = quizLLMBase.extend({
  activity_type: z.literal("fill_in_the_blank"),
  blanks: z.array(
    z.object({
      prompt: z.string(),
      answer: z.string(),
    })
  ),
})

export const openEndedQuizLLMSchema = quizLLMBase.extend({
  activity_type: z.literal("open_ended"),
  sample_answer: z.string(),
  guidance: z.string(),
})

export const dragAndDropQuizLLMSchema = quizLLMBase.extend({
  activity_type: z.literal("drag_and_drop"),
  pairs: z.array(
    z.object({
      item: z.string(),
      match: z.string(),
    })
  ),
})

export const sortingQuizLLMSchema = quizLLMBase.extend({
  activity_type: z.literal("sorting"),
  categories: z.array(
    z.object({
      label: z.string(),
    })
  ),
  items: z.array(
    z.object({
      item: z.string(),
      category: z.string(),
    })
  ),
})

/** Schema for what the LLM returns (simpler than the stored Quiz type). */
export const quizLLMSchema = multipleChoiceQuizLLMSchema

export function getQuizLLMSchema(activityType: QuizActivityType) {
  switch (activityType) {
    case "multiple_select":
      return multipleSelectQuizLLMSchema
    case "true_false":
      return trueFalseQuizLLMSchema
    case "fill_in_the_blank":
      return fillInTheBlankQuizLLMSchema
    case "open_ended":
      return openEndedQuizLLMSchema
    case "drag_and_drop":
      return dragAndDropQuizLLMSchema
    case "sorting":
      return sortingQuizLLMSchema
    case "multiple_choice":
    default:
      return multipleChoiceQuizLLMSchema
  }
}

export const QuizGenerationRequest = z.object({
  pageIds: z.array(z.string()).min(1),
  activityType: QuizActivityType,
  template: ActivityTemplate.optional(),
  insertAfterPageId: z.string().optional(),
  questionsPerQuiz: z.number().int().min(1).max(20).optional(),
  replaceExistingForPages: z.boolean().optional(),
  replaceQuizIndex: z.number().int().min(0).optional(),
})
export type QuizGenerationRequest = z.infer<typeof QuizGenerationRequest>

export const TextbookActivity = z.object({
  id: z.string(),
  pageId: z.string(),
  pageNumber: z.number().int(),
  sectionId: z.string(),
  sectionIndex: z.number().int().min(0),
  sectionType: z.string(),
  textPreview: z.string(),
  textBlockCount: z.number().int().min(0),
  imageCount: z.number().int().min(0),
  answerCount: z.number().int().min(0),
  hasRendering: z.boolean(),
  override: z.lazy(() => TextbookActivityOverride).optional(),
})
export type TextbookActivity = z.infer<typeof TextbookActivity>

export const TextbookActivityOverride = z.object({
  id: z.string(),
  sourcePageId: z.string(),
  sourceSectionId: z.string(),
  activityType: QuizActivityType,
  template: ActivityTemplate,
  questions: z.array(QuizQuestion).min(1),
  assignedPageIds: z.array(z.string()).min(1),
  insertAfterPageId: z.string(),
  questionsPerQuiz: z.number().int().min(1).max(20),
  replaceExistingForPages: z.boolean().default(false),
  hidden: z.boolean().default(false),
  updatedAt: z.string(),
})
export type TextbookActivityOverride = z.infer<typeof TextbookActivityOverride>

export const TextbookActivityOverrideInput = TextbookActivityOverride.omit({
  id: true,
  updatedAt: true,
}).extend({
  id: z.string().optional(),
  updatedAt: z.string().optional(),
})
export type TextbookActivityOverrideInput = z.infer<typeof TextbookActivityOverrideInput>

export const TextbookActivitiesResponse = z.object({
  activities: z.array(TextbookActivity),
  orphanedOverrideIds: z.array(z.string()).optional(),
})
export type TextbookActivitiesResponse = z.infer<typeof TextbookActivitiesResponse>

export const TextbookActivityOverrideResponse = z.object({
  override: TextbookActivityOverride.nullable(),
  version: z.number().int(),
})
export type TextbookActivityOverrideResponse = z.infer<typeof TextbookActivityOverrideResponse>
