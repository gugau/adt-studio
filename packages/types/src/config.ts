import { z } from "zod"
import { ImageFilters } from "./image-filtering.js"
import { SpeechConfig } from "./speech.js"
import { ReviewerValidationConfig } from "./reviewer-validation-config.js"

export const DEFAULT_LLM_MAX_RETRIES = 5

export const RateLimitConfig = z.object({
  requests_per_minute: z.number().int().min(1),
})
export type RateLimitConfig = z.infer<typeof RateLimitConfig>

export const StepConfig = z.object({
  prompt: z.string().optional(),
  model: z.string().optional(),
  max_retries: z.number().int().min(0).optional(),
  timeout: z.number().int().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
})
export type StepConfig = z.infer<typeof StepConfig>

export const QuizGenerationConfig = StepConfig.extend({
  pages_per_quiz: z.number().int().min(1).optional(),
  quiz_section_types: z.array(z.string()).optional(),
})
export type QuizGenerationConfig = z.infer<typeof QuizGenerationConfig>

export const SectioningMode = z.enum(["section", "page", "dynamic"])
export type SectioningMode = z.infer<typeof SectioningMode>

export const PageSectioningConfig = StepConfig.extend({
  mode: SectioningMode.optional(),
})
export type PageSectioningConfig = z.infer<typeof PageSectioningConfig>

export const BookFormat = z.enum(["web", "webpub"])
export type BookFormat = z.infer<typeof BookFormat>

export const LayoutType = z.enum(["textbook", "storybook", "reference", "custom"])
export type LayoutType = z.infer<typeof LayoutType>

export const PresetName = z.enum(["textbook", "storybook", "reference"])
export type PresetName = z.infer<typeof PresetName>

export const StyleguideName = z.string().regex(/^[a-zA-Z0-9_-]+$/)
export type StyleguideName = z.infer<typeof StyleguideName>

export const RenderType = z.enum(["llm", "template", "activity"])
export type RenderType = z.infer<typeof RenderType>

export const VisualRefinementStrategyConfig = z.object({
  enabled: z.boolean().optional(),
  max_iterations: z.number().int().min(1).max(50).optional(),
  prompt: z.string().optional(),
  timeout: z.number().int().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
})
export type VisualRefinementStrategyConfig = z.infer<typeof VisualRefinementStrategyConfig>

export const RenderStrategyConfig = z
  .object({
    render_type: RenderType,
    config: z
      .object({
        // llm / activity render type
        prompt: z.string().optional(),
        model: z.string().optional(),
        max_retries: z.number().int().min(0).optional(),
        timeout: z.number().int().min(1).optional(),
        temperature: z.number().min(0).max(2).optional(),
        // activity render type — answer generation prompt
        answer_prompt: z.string().optional(),
        // template render type
        template: z.string().optional(),
        // visual refinement — screenshot-based LLM feedback loop
        visual_refinement: VisualRefinementStrategyConfig.optional(),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.render_type !== "activity" && value.config?.answer_prompt !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "answer_prompt is only supported for render_type: activity",
        path: ["config", "answer_prompt"],
      })
    }
  })
export type RenderStrategyConfig = z.infer<typeof RenderStrategyConfig>

export const AccessibilityAssessmentConfig = z.object({
  run_only_tags: z.array(z.string().min(1)).min(1).optional(),
  disabled_rules: z.array(z.string().min(1)).optional(),
})
export type AccessibilityAssessmentConfig = z.infer<typeof AccessibilityAssessmentConfig>

export const AppConfig = z
  .object({
    // Current canonical keys
    text_types: z.record(z.string(), z.string()).optional(),
    image_types: z.record(z.string(), z.string()).optional(),
    container_types: z.record(z.string(), z.string()).optional(),
    pruned_text_types: z.array(z.string()).optional(),
    page_structuring: StepConfig.optional(),
    // Legacy keys (accepted for backward compat, migrated automatically)
    text_group_types: z.record(z.string(), z.string()).optional(),
    leaf_types: z.record(z.string(), z.string()).optional(),
    pruned_leaf_types: z.array(z.string()).optional(),
    text_classification: StepConfig.optional(),
    // Shared keys
    section_types: z.record(z.string(), z.string()).optional(),
    pruned_section_types: z.array(z.string()).optional(),
    disabled_section_types: z.array(z.string()).optional(),
    translation: StepConfig.optional(),
    metadata: StepConfig.optional(),
    book_summary: StepConfig.optional(),
    page_sectioning: PageSectioningConfig.optional(),
    quiz_generation: QuizGenerationConfig.optional(),
    default_render_strategy: z.string().optional(),
    render_strategies: z.record(z.string(), RenderStrategyConfig).optional(),
    section_render_strategies: z.record(z.string(), z.string()).optional(),
    image_filters: ImageFilters.optional(),
    image_meaningfulness: StepConfig.optional(),
    glossary: StepConfig.optional(),
    toc_generation: StepConfig.optional(),
    concurrency: z.number().int().min(1).optional(),
    rate_limit: RateLimitConfig.optional(),
    editing_language: z.string().optional(),
    output_languages: z.array(z.string()).optional(),
    book_format: z.array(BookFormat).optional(),
    image_captioning: StepConfig.optional(),
    image_segmentation: StepConfig.extend({
      min_side: z.number().int().min(0).optional(),
    }).optional(),
    image_cropping: StepConfig.optional(),
    layout_type: LayoutType.optional(),
    spread_mode: z.boolean().optional(),
    vector_text_grouping: z.boolean().optional(),
    apply_body_background: z.boolean().optional(),
    start_page: z.number().int().min(1).optional(),
    end_page: z.number().int().min(1).optional(),
    speech: SpeechConfig.optional(),
    styleguide: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional(),
    accessibility_assessment: AccessibilityAssessmentConfig.optional(),
    reviewer_validation: ReviewerValidationConfig.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.start_page !== undefined &&
      value.end_page !== undefined &&
      value.end_page < value.start_page
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_page"],
        message: "end_page must be greater than or equal to start_page",
      })
    }
  })
export type AppConfig = z.infer<typeof AppConfig>

export interface TypeDef {
  key: string
  description: string
}

/**
 * Known image type keys — used to split mixed leaf_types/text_types maps
 * into separate text_types and image_types during config migration.
 */
const KNOWN_IMAGE_TYPE_KEYS = new Set(["image"])

/**
 * Migrate legacy config keys to their current equivalents.
 * Call before parsing with AppConfig to support all config generations.
 *
 * Three generations:
 * - Gen 1: text_types (mixed text+image), text_group_types, pruned_text_types, text_classification
 * - Gen 2: leaf_types (mixed text+image), container_types, pruned_leaf_types, page_structuring
 * - Gen 3: text_types (text only), image_types, container_types, pruned_text_types, page_structuring
 *
 * Gen 3 keys take precedence if present alongside older keys.
 */
export function migrateAppConfig(raw: Record<string, unknown>): Record<string, unknown> {
  const migrated = { ...raw }

  // Step 1: Normalize container types (Gen 1 → current)
  if ("text_group_types" in migrated && !("container_types" in migrated)) {
    migrated.container_types = migrated.text_group_types
  }

  // Step 2: Normalize step config (Gen 1/2 → current)
  if ("text_classification" in migrated && !("page_structuring" in migrated)) {
    migrated.page_structuring = migrated.text_classification
  }

  // Step 3: Split mixed type maps into text_types + image_types
  // Only run if image_types is not already present (Gen 3 takes precedence)
  if (!("image_types" in migrated)) {
    // Find the source map: Gen 2 leaf_types or Gen 1 text_types
    const sourceKey = "leaf_types" in migrated ? "leaf_types" : "text_types" in migrated ? "text_types" : null
    if (sourceKey) {
      const source = migrated[sourceKey] as Record<string, string> | undefined
      if (source && typeof source === "object") {
        const textOnly: Record<string, string> = {}
        const imageOnly: Record<string, string> = {}
        for (const [key, desc] of Object.entries(source)) {
          if (KNOWN_IMAGE_TYPE_KEYS.has(key)) {
            imageOnly[key] = desc
          } else {
            textOnly[key] = desc
          }
        }
        // Only set text_types if it wasn't already the source (avoid clobbering Gen 3 text_types)
        if (sourceKey === "leaf_types") {
          if (!("text_types" in migrated)) {
            migrated.text_types = textOnly
          }
        } else {
          // sourceKey === "text_types" — replace with text-only version
          migrated.text_types = textOnly
        }
        if (Object.keys(imageOnly).length > 0) {
          migrated.image_types = imageOnly
        }
      }
    }
  }

  // Step 4: Normalize pruned types (Gen 2 → current)
  if ("pruned_leaf_types" in migrated && !("pruned_text_types" in migrated)) {
    migrated.pruned_text_types = migrated.pruned_leaf_types
  }

  return migrated
}
