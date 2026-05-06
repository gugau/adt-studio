import { z } from "zod"
import {
  ActivitiesOutput,
  type Activity,
  type ActivitiesOutput as ActivitiesOutputT,
} from "./activity.js"

/**
 * Legacy quiz schema, kept so existing books (whose `quiz-generation` node was
 * written before activities were introduced) can still be read. New code uses
 * `Activity` / `ActivitiesOutput` from `./activity.js`.
 */

export const QuizOption = z.object({
  text: z.string(),
  explanation: z.string(),
})
export type QuizOption = z.infer<typeof QuizOption>

export const Quiz = z.object({
  quizIndex: z.number().int(),
  afterPageId: z.string(),
  pageIds: z.array(z.string()),
  question: z.string(),
  options: z.array(QuizOption).length(3),
  answerIndex: z.number().int().min(0).max(2),
  reasoning: z.string(),
})
export type Quiz = z.infer<typeof Quiz>

export const QuizGenerationOutput = z.object({
  generatedAt: z.string(),
  language: z.string(),
  pagesPerQuiz: z.number().int(),
  quizzes: z.array(Quiz),
})
export type QuizGenerationOutput = z.infer<typeof QuizGenerationOutput>

/** Schema for what the LLM returns (simpler than the stored Quiz type). */
export const quizLLMSchema = z.object({
  reasoning: z.string(),
  question: z.string(),
  options: z.array(
    z.object({
      text: z.string(),
      explanation: z.string(),
    })
  ),
  answer_index: z.number().int(),
})

/**
 * Lenient legacy quiz schema for upgrade-on-read. Tolerates option counts
 * other than 3 (early fixtures and partial generations). The strict
 * `QuizGenerationOutput` schema is kept above for explicit validation paths.
 */
const LegacyQuizForRead = z.object({
  generatedAt: z.string().default(""),
  language: z.string().default("en"),
  quizzes: z
    .array(
      z.object({
        quizIndex: z.number().int().default(0),
        afterPageId: z.string().default(""),
        pageIds: z.array(z.string()).default([]),
        question: z.string().default(""),
        options: z.array(QuizOption).default([]),
        answerIndex: z.number().int().default(0),
        reasoning: z.string().default(""),
      }),
    )
    .default([]),
})

/**
 * Read activity data from a stored `quiz-generation` node, transparently
 * upgrading legacy quiz output to the new ActivitiesOutput shape. Returns
 * null if the data is neither shape.
 */
export function readActivitiesFromNode(raw: unknown): ActivitiesOutputT | null {
  const newParsed = ActivitiesOutput.safeParse(raw)
  if (newParsed.success) return newParsed.data

  const legacy = LegacyQuizForRead.safeParse(raw)
  if (!legacy.success) return null

  // Legacy data keeps `qzNNN` ids so existing books' page URLs are stable.
  const activities: Activity[] = legacy.data.quizzes.map((q, i) => ({
    activityId: `qz${String((q.quizIndex ?? i) + 1).padStart(3, "0")}`,
    afterPageId: q.afterPageId,
    pageIds: q.pageIds,
    generatedAt: legacy.data.generatedAt,
    templateType: "multiple_choice" as const,
    question: q.question,
    options: q.options.length > 0 ? q.options : [{ text: "", explanation: "" }, { text: "", explanation: "" }],
    answerIndex: q.answerIndex,
    reasoning: q.reasoning,
  }))

  return {
    generatedAt: legacy.data.generatedAt,
    language: legacy.data.language,
    activities,
  }
}
