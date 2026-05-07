import { z } from "zod"

export const QuizActivityType = z.enum([
  "multiple_choice",
  "true_false",
  "fill_in_the_blank",
  "drag_and_drop",
])
export type QuizActivityType = z.infer<typeof QuizActivityType>

export const QuizOption = z.object({
  text: z.string(),
  explanation: z.string(),
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
  explanation: z.string().optional(),
})
export type QuizMatchPair = z.infer<typeof QuizMatchPair>

const QuizQuestionFields = z.object({
  activityType: QuizActivityType.default("multiple_choice"),
  question: z.string(),
  options: z.array(QuizOption).optional(),
  answerIndex: z.number().int().min(0).optional(),
  statements: z.array(QuizStatement).optional(),
  blanks: z.array(QuizBlank).optional(),
  pairs: z.array(QuizMatchPair).optional(),
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
}

export const QuizQuestion = QuizQuestionFields.superRefine(validateQuizQuestionShape)
export type QuizQuestion = z.infer<typeof QuizQuestion>

export const Quiz = QuizQuestionFields.extend({
  quizIndex: z.number().int(),
  afterPageId: z.string(),
  pageIds: z.array(z.string()),
  isPruned: z.boolean().default(false),
  questions: z.array(QuizQuestion).optional(),
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

export const dragAndDropQuizLLMSchema = quizLLMBase.extend({
  activity_type: z.literal("drag_and_drop"),
  pairs: z.array(
    z.object({
      item: z.string(),
      match: z.string(),
    })
  ),
})

/** Schema for what the LLM returns (simpler than the stored Quiz type). */
export const quizLLMSchema = multipleChoiceQuizLLMSchema

export function getQuizLLMSchema(activityType: QuizActivityType) {
  switch (activityType) {
    case "true_false":
      return trueFalseQuizLLMSchema
    case "fill_in_the_blank":
      return fillInTheBlankQuizLLMSchema
    case "drag_and_drop":
      return dragAndDropQuizLLMSchema
    case "multiple_choice":
    default:
      return multipleChoiceQuizLLMSchema
  }
}

export const QuizGenerationRequest = z.object({
  pageIds: z.array(z.string()).min(1),
  activityType: QuizActivityType,
  questionsPerQuiz: z.number().int().min(1).max(20).optional(),
  replaceExistingForPages: z.boolean().optional(),
})
export type QuizGenerationRequest = z.infer<typeof QuizGenerationRequest>
