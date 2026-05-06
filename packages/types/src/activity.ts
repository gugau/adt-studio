import { z } from "zod"

/**
 * Templated activities. Each activity is one of three template types, distinguished
 * by `templateType`. The reader's JS dispatches by `data-template-type` attribute
 * to the matching module under `assets/adt/modules/activities/`.
 *
 * Activities are distinct from AI-laid-out activity sections (sections whose
 * `sectionType` starts with `activity_`) — those live in the storyboard
 * `web-rendering` output and are edited in the Storyboard stage.
 */

export const ActivityTemplateType = z.enum([
  "multiple_choice",
  "true_false",
  "fill_in_the_blank",
])
export type ActivityTemplateType = z.infer<typeof ActivityTemplateType>

// ── Multiple choice ─────────────────────────────────────────────────────────

export const MultipleChoiceOption = z.object({
  text: z.string(),
  explanation: z.string(),
})
export type MultipleChoiceOption = z.infer<typeof MultipleChoiceOption>

export const MultipleChoiceData = z.object({
  templateType: z.literal("multiple_choice"),
  question: z.string(),
  options: z.array(MultipleChoiceOption).min(2).max(6),
  answerIndex: z.number().int().min(0),
  reasoning: z.string().default(""),
})
export type MultipleChoiceData = z.infer<typeof MultipleChoiceData>

// ── True / false ────────────────────────────────────────────────────────────

export const TrueFalseStatement = z.object({
  text: z.string(),
  isTrue: z.boolean(),
  explanation: z.string().default(""),
})
export type TrueFalseStatement = z.infer<typeof TrueFalseStatement>

export const TrueFalseData = z.object({
  templateType: z.literal("true_false"),
  prompt: z.string().default(""),
  statements: z.array(TrueFalseStatement).min(1),
})
export type TrueFalseData = z.infer<typeof TrueFalseData>

// ── Fill in the blank ───────────────────────────────────────────────────────

/**
 * Sentences use bracket syntax for blanks: `The capital is [Paris|paris]`.
 * Anything inside `[...]` separated by `|` is an accepted answer. The first
 * token is the canonical answer; subsequent tokens are also accepted.
 */
export const FillInTheBlankSentence = z.object({
  text: z.string(),
  hint: z.string().default(""),
})
export type FillInTheBlankSentence = z.infer<typeof FillInTheBlankSentence>

export const FillInTheBlankData = z.object({
  templateType: z.literal("fill_in_the_blank"),
  prompt: z.string().default(""),
  sentences: z.array(FillInTheBlankSentence).min(1),
})
export type FillInTheBlankData = z.infer<typeof FillInTheBlankData>

// ── Discriminated union ─────────────────────────────────────────────────────

export const ActivityData = z.discriminatedUnion("templateType", [
  MultipleChoiceData,
  TrueFalseData,
  FillInTheBlankData,
])
export type ActivityData = z.infer<typeof ActivityData>

// ── Persisted shape ─────────────────────────────────────────────────────────

const ActivityCommon = z.object({
  activityId: z.string(),
  afterPageId: z.string(),
  pageIds: z.array(z.string()).default([]),
  generatedAt: z.string().default(""),
})

/**
 * One persisted activity. Combines the common placement/identity fields with
 * the template-specific data. We avoid `intersection` here because Zod can't
 * keep `discriminatedUnion` discrimination through one — instead we attach
 * the common fields onto each branch via `merge`.
 */
export const Activity = z.discriminatedUnion("templateType", [
  MultipleChoiceData.merge(ActivityCommon),
  TrueFalseData.merge(ActivityCommon),
  FillInTheBlankData.merge(ActivityCommon),
])
export type Activity = z.infer<typeof Activity>

export const ActivitiesOutput = z.object({
  generatedAt: z.string(),
  language: z.string(),
  activities: z.array(Activity),
})
export type ActivitiesOutput = z.infer<typeof ActivitiesOutput>

// ── LLM schemas (per template type) ─────────────────────────────────────────

/** Schema the LLM returns when generating/extracting a multiple-choice activity. */
export const multipleChoiceLLMSchema = z.object({
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
export type MultipleChoiceLLMOutput = z.infer<typeof multipleChoiceLLMSchema>
