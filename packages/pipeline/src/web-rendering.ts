import {
  type PageSectioningOutput,
  type ContentNodeData,
  type AppConfig,
  type SectionRendering,
  type WebRenderingOutput,
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
  /** Total number of sections on this page (so the reviewer knows this section covers only 1/N of the page). */
  sectionCount: number
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
    } else if (part.type === "content_node") {
      flattenContentNode(part.node, images, parts)
    }
  }

  return parts
}

/**
 * Recursively flatten a ContentNodeData subtree into render-ready SectionParts.
 * Text leaves become group parts, image leaves become image parts.
 * Consecutive text-leaf children of a container are merged into a single
 * group (keyed by the container's structure) so that e.g. a "group"/paragraph
 * container with multiple sentence leaves is rendered as one paragraph rather
 * than one block per sentence.
 */
function flattenContentNode(
  node: ContentNodeData,
  images: Map<string, { base64: string; width?: number; height?: number }>,
  parts: SectionPart[]
): void {
  if (node.isPruned) return

  // Text leaf
  if (node.text != null && node.role) {
    parts.push({
      type: "group",
      groupId: node.nodeId,
      groupType: node.role,
      texts: [{ textId: node.nodeId, textType: node.role, text: node.text }],
    })
    return
  }

  // Image leaf
  if (node.imageId && !node.children?.length) {
    const imgData = images.get(node.imageId)
    if (imgData) {
      parts.push({
        type: "image",
        imageId: node.imageId,
        imageBase64: imgData.base64,
        width: imgData.width,
        height: imgData.height,
      })
    }
    return
  }

  // Container — walk children, buffering runs of text leaves into one group
  // tagged with this container's structure so the renderer sees a paragraph
  // (or whatever the container represents), not a sequence of lone sentences.
  if (!node.children) return

  let buffer: TextInput[] = []
  const flush = () => {
    if (buffer.length === 0) return
    parts.push({
      type: "group",
      groupId: node.nodeId,
      groupType: node.structure ?? "group",
      texts: buffer,
    })
    buffer = []
  }

  for (const child of node.children) {
    if (child.isPruned) continue
    const isTextLeaf =
      child.text != null && child.role && !child.children?.length
    if (isTextLeaf) {
      buffer.push({ textId: child.nodeId, textType: child.role!, text: child.text! })
    } else {
      flush()
      flattenContentNode(child, images, parts)
    }
  }
  flush()
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
      sectionCount: input.sectioning.sections.length,
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
