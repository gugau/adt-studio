import {
  type PageSectioningOutput,
  type AppConfig,
  type SectionRendering,
  type WebRenderingOutput,
  webRenderingLLMSchema,
  DEFAULT_LLM_MAX_RETRIES,
} from "@adt/types"
import type { LLMModel } from "@adt/llm"
import { renderSectionLlm, type VisualRefinementDeps } from "./render-llm.js"
import { renderSectionTemplate, type TemplateEngine } from "./render-template.js"

export interface TextInput {
  textId: string
  textType: string
  text: string
}

export interface ImageInput {
  imageId: string
  imageBase64: string
  width?: number
  height?: number
}

export type SectionPart =
  | { type: "group"; groupId: string; groupType: string; texts: TextInput[] }
  | { type: "image"; imageId: string; imageBase64: string; width?: number; height?: number }

export interface VisualRefinementConfig {
  enabled: boolean
  maxIterations: number
  promptName: string
  timeoutMs: number
  temperature: number
}

export interface RenderConfig {
  renderType: "llm" | "template" | "activity"
  // llm / activity fields
  promptName: string
  modelId: string
  maxRetries: number
  timeoutMs: number
  temperature: number
  // activity fields — answer generation prompt
  answerPromptName: string
  // template fields
  templateName: string
  // visual refinement — screenshot-based LLM feedback loop
  visualRefinement?: VisualRefinementConfig
}

export interface RenderSectionInput {
  label: string
  pageId: string
  pageImageBase64: string
  sectionIndex: number
  sectionId: string
  sectionType: string
  backgroundColor: string
  textColor: string
  parts: SectionPart[]
  styleguide?: string
  /** Optional user instructions appended to the LLM prompt during re-render */
  userPrompt?: string
}

export interface RenderPageInput {
  label: string
  pageId: string
  pageImageBase64: string
  sectioning: PageSectioningOutput
  images: Map<string, { base64: string; width?: number; height?: number }>
  styleguide?: string
  /** Optional user instructions appended to the LLM prompt during re-render */
  userPrompt?: string
}

export type ResolveLLMModel = LLMModel | ((modelId: string) => LLMModel)

function getLLMModel(
  resolver: ResolveLLMModel,
  modelId: string
): LLMModel {
  return typeof resolver === "function"
    ? resolver(modelId)
    : resolver
}

/**
 * Expand inline section parts into the render-ready SectionPart format.
 * Filters to non-pruned parts, expands text groups to TextInput while preserving text IDs,
 * and resolves image base64 from the images map.
 */
function expandParts(
  sectionParts: import("@adt/types").SectionPart[],
  images: Map<string, { base64: string; width?: number; height?: number }>
): SectionPart[] {
  const parts: SectionPart[] = []

  for (const part of sectionParts) {
    if (part.isPruned) continue

    if (part.type === "text_group") {
      const nonPruned = part.texts.filter((t) => !t.isPruned)
      const texts = nonPruned.map((t) => ({
        textId: t.textId,
        textType: t.textType,
        text: t.text,
      }))
      if (texts.length > 0) {
        parts.push({
          type: "group",
          groupId: part.groupId,
          groupType: part.groupType,
          texts,
        })
      }
    } else if (part.type === "image") {
      const imgData = images.get(part.imageId)
      if (imgData) {
        parts.push({ type: "image", imageId: part.imageId, imageBase64: imgData.base64, width: imgData.width, height: imgData.height })
      }
    }
  }

  return parts
}

/**
 * Render all sections for a page. Pure function — no side effects.
 * The caller handles concurrency, storage writes, and progress.
 *
 * Dispatches each section to the appropriate renderer based on config.renderType.
 */
export async function renderPage(
  input: RenderPageInput,
  resolveConfig: (sectionType: string) => RenderConfig,
  llmModel: ResolveLLMModel,
  templateEngine?: TemplateEngine,
  visualRefinement?: VisualRefinementDeps,
): Promise<WebRenderingOutput> {
  const sections: SectionRendering[] = []

  for (let i = 0; i < input.sectioning.sections.length; i++) {
    const section = input.sectioning.sections[i]

    // Skip pruned sections
    if (section.isPruned) continue

    // Expand inline parts to render-ready format
    const parts = expandParts(section.parts, input.images)

    // Skip sections with no content
    if (parts.length === 0) continue

    const config = resolveConfig(section.sectionType)

    const sectionInput: RenderSectionInput = {
      label: input.label,
      pageId: input.pageId,
      pageImageBase64: input.pageImageBase64,
      sectionIndex: i,
      sectionId: section.sectionId,
      sectionType: section.sectionType,
      backgroundColor: section.backgroundColor,
      textColor: section.textColor,
      parts,
      styleguide: input.styleguide,
      userPrompt: input.userPrompt,
    }

    let rendering: SectionRendering
    if (config.renderType === "template") {
      if (!templateEngine) {
        throw new Error(
          "Template engine required for template render type"
        )
      }
      rendering = await renderSectionTemplate(
        sectionInput,
        config,
        templateEngine
      )
    } else {
      // Both "llm" and "activity" use the LLM renderer.
      // Activity-specific behaviour (looser validation, answer generation)
      // is driven by config fields (renderType, answerPromptName).
      rendering = await renderSectionLlm(
        sectionInput,
        config,
        getLLMModel(llmModel, config.modelId),
        visualRefinement,
      )
    }

    sections.push(rendering)
  }

  // --- Activity consistency pass ---
  // When a page has 2+ activity sections of the same type, the LLM may produce
  // visually inconsistent HTML across them.  Use the first rendered section of
  // each activity type as the "reference style" and rewrite subsequent ones to
  // match its structure/classes while preserving their own content.
  const CONSISTENCY_PROMPT = "activity_multiple_choice_consistency"
  const activityTypes = new Set(
    sections
      .filter((s) => s.sectionType.startsWith("activity_"))
      .map((s) => s.sectionType)
  )

  for (const actType of activityTypes) {
    const group = sections.filter((s) => s.sectionType === actType)
    if (group.length < 2) continue

    const referenceHtml = group[0].html
    const config = resolveConfig(actType)

    for (let g = 1; g < group.length; g++) {
      const target = group[g]
      try {
        const result = await getLLMModel(llmModel, config.modelId).generateObject<{
          reasoning: string
          content: string
        }>({
          schema: webRenderingLLMSchema,
          prompt: CONSISTENCY_PROMPT,
          context: {
            reference_html: referenceHtml,
            target_html: target.html,
          },
          maxRetries: config.maxRetries,
          maxTokens: 16384,
          temperature: 0.1,
          timeoutMs: config.timeoutMs,
          log: {
            taskType: "activity-consistency",
            pageId: input.pageId,
            promptName: CONSISTENCY_PROMPT,
          },
        })
        target.html = result.object.content
      } catch (err) {
        // If consistency pass fails, keep the original HTML — it's better than nothing
        console.warn(
          `Activity consistency pass failed for section ${target.sectionIndex}: ${err}`
        )
      }
    }
  }

  return { sections }
}

const DEFAULT_RENDER_CONFIG = {
  prompt: "web_generation_html",
  model: "openai:gpt-5.4",
  max_retries: DEFAULT_LLM_MAX_RETRIES,
  timeout: 180,
  temperature: 0.3,
}

const DEFAULT_VISUAL_REFINEMENT = {
  prompt: "visual_review",
  max_iterations: 5,
  timeout: 180,
  temperature: 0.3,
}

/**
 * Build a resolver that returns a RenderConfig for a given section type.
 *
 * Resolution order:
 *   1. section_render_strategies[sectionType] → named strategy in render_strategies
 *   2. default_render_strategy → named strategy in render_strategies
 *   3. Hard-coded defaults
 *
 */
export function buildRenderStrategyResolver(
  appConfig: AppConfig
): (sectionType: string) => RenderConfig {
  const strategies = appConfig.render_strategies ?? {}
  const sectionMapping = appConfig.section_render_strategies ?? {}
  const defaultName = appConfig.default_render_strategy

  return (sectionType: string): RenderConfig => {
    const sectionStrategyName = sectionMapping[sectionType]
    const sectionStrategy = sectionStrategyName
      ? strategies[sectionStrategyName]
      : undefined
    const defaultStrategy = defaultName
      ? strategies[defaultName]
      : undefined
    const strategy = sectionStrategy ?? defaultStrategy
    const cfg = strategy?.config

    const vr = cfg?.visual_refinement

    return {
      renderType: strategy?.render_type ?? "llm",
      promptName: cfg?.prompt ?? DEFAULT_RENDER_CONFIG.prompt,
      modelId: cfg?.model ?? DEFAULT_RENDER_CONFIG.model,
      maxRetries: cfg?.max_retries ?? DEFAULT_RENDER_CONFIG.max_retries,
      timeoutMs: (cfg?.timeout ?? DEFAULT_RENDER_CONFIG.timeout) * 1000,
      temperature: cfg?.temperature ?? DEFAULT_RENDER_CONFIG.temperature,
      answerPromptName: cfg?.answer_prompt ?? "",
      templateName: cfg?.template ?? "",
      ...(vr?.enabled && {
        visualRefinement: {
          enabled: true,
          maxIterations: vr.max_iterations ?? DEFAULT_VISUAL_REFINEMENT.max_iterations,
          promptName: vr.prompt ?? DEFAULT_VISUAL_REFINEMENT.prompt,
          timeoutMs: (vr.timeout ?? DEFAULT_VISUAL_REFINEMENT.timeout) * 1000,
          temperature: vr.temperature ?? DEFAULT_VISUAL_REFINEMENT.temperature,
        },
      }),
    }
  }
}
