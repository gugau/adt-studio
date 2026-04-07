import {
  type PageStructuringOutput,
  type ContentNodeData,
  type LLMContentNode,
  type PageStructuringRefinementLLMOutput,
  buildPageStructuringLLMSchema,
  buildPageStructuringRefinementLLMSchema,
  type TypeDef,
  type AppConfig,
  DEFAULT_LLM_MAX_RETRIES,
} from "@adt/types"
import type { LLMModel, ValidationResult } from "@adt/llm"

const PAGE_STRUCTURING_REFINEMENT_PROMPT = "page_structuring_refinement"
const PAGE_STRUCTURING_MAX_REFINEMENTS = 3
const PAGE_STRUCTURING_MAX_TOKENS = 16384

export interface StructureConfig {
  textTypes: TypeDef[]
  imageTypes: TypeDef[]
  containerTypes: TypeDef[]
  prunedTextTypes: string[]
  promptName: string
  modelId: string
  maxRetries: number
}

export interface PageInput {
  pageId: string
  pageNumber: number
  text: string
  imageBase64: string
  /** Extracted images available for placement in the content tree. */
  images: Array<{ imageId: string; imageBase64: string }>
}

interface RawPageStructuringResult {
  reasoning: string
  nodes: LLMContentNode[]
}

/**
 * Structure the content of a single page into a tree. Pure function — no side effects.
 * The caller handles concurrency, storage writes, and progress.
 */
export async function structurePage(
  page: PageInput,
  config: StructureConfig,
  llmModel: LLMModel
): Promise<PageStructuringOutput> {
  if (config.textTypes.length === 0) {
    throw new Error("No text types configured")
  }
  if (config.containerTypes.length === 0) {
    throw new Error("No container types configured")
  }

  const imageIds = page.images.map((img) => img.imageId)
  const baseContext = buildPageStructuringContext(page, config, imageIds)
  const validate = (raw: unknown) =>
    validatePageStructuring(raw, config.textTypes, config.imageTypes, config.containerTypes, imageIds)

  const result = await llmModel.generateObject<RawPageStructuringResult>({
    schema: buildPageStructuringLLMSchema(),
    prompt: config.promptName,
    context: baseContext,
    validate,
    maxRetries: config.maxRetries,
    maxTokens: PAGE_STRUCTURING_MAX_TOKENS,
    log: {
      taskType: "page-structuring",
      pageId: page.pageId,
      promptName: config.promptName,
    },
  })

  let candidate: RawPageStructuringResult = result.object
  const priorReviewNotes: string[] = []

  for (let iteration = 1; iteration <= PAGE_STRUCTURING_MAX_REFINEMENTS; iteration++) {
    const refinement = await runPageStructuringRefinementPass({
      page,
      config,
      llmModel,
      candidate,
      imageIds,
      iteration,
      priorReviewNotes,
      validate,
      baseContext,
    })
    candidate = {
      reasoning: refinement.reasoning,
      nodes: refinement.nodes,
    }
    if (refinement.approved) break
    priorReviewNotes.push(refinement.reasoning)
  }

  return {
    reasoning: candidate.reasoning,
    nodes: finalizePageStructuringNodes(page.pageId, candidate.nodes, config.prunedTextTypes),
  }
}

function buildPageStructuringContext(
  page: PageInput,
  config: StructureConfig,
  imageIds: string[]
): Record<string, unknown> {
  return {
    page: {
      pageNumber: page.pageNumber,
      text: page.text,
      imageBase64: page.imageBase64,
      images: page.images,
    },
    text_types: config.textTypes,
    image_types: config.imageTypes,
    container_types: config.containerTypes,
    image_ids: imageIds,
  }
}

function finalizePageStructuringNodes(
  pageId: string,
  llmNodes: LLMContentNode[],
  prunedTextTypes: string[]
): ContentNodeData[] {
  const prunedSet = new Set(prunedTextTypes)
  let nodeCounter = 0

  function assignIds(nodes: LLMContentNode[]): ContentNodeData[] {
    return nodes.map((node) => {
      nodeCounter++
      const nodeId = `${pageId}_nd${String(nodeCounter).padStart(3, "0")}`

      if (node.children && node.children.length > 0) {
        return {
          nodeId,
          nodeType: node.node_type,
          children: assignIds(node.children),
          isPruned: false,
        }
      }

      const finalized: ContentNodeData = {
        nodeId,
        nodeType: node.node_type,
        isPruned: prunedSet.has(node.node_type),
      }
      if (node.text != null) finalized.text = node.text
      if (node.image_id != null) finalized.imageId = node.image_id
      return finalized
    })
  }

  return assignIds(llmNodes)
}

async function runPageStructuringRefinementPass(options: {
  page: PageInput
  config: StructureConfig
  llmModel: LLMModel
  candidate: RawPageStructuringResult
  imageIds: string[]
  iteration: number
  priorReviewNotes: string[]
  validate: (raw: unknown) => ValidationResult
  baseContext: Record<string, unknown>
}): Promise<PageStructuringRefinementLLMOutput> {
  const {
    page,
    config,
    llmModel,
    candidate,
    iteration,
    priorReviewNotes,
    validate,
    baseContext,
  } = options

  const result = await llmModel.generateObject<PageStructuringRefinementLLMOutput>({
    schema: buildPageStructuringRefinementLLMSchema(),
    prompt: PAGE_STRUCTURING_REFINEMENT_PROMPT,
    context: {
      ...baseContext,
      current_candidate_reasoning: candidate.reasoning,
      current_candidate_json: JSON.stringify(candidate, null, 2),
      refinement_iteration: iteration,
      max_refinement_iterations: PAGE_STRUCTURING_MAX_REFINEMENTS,
      prior_review_notes: priorReviewNotes,
    },
    validate,
    maxRetries: config.maxRetries,
    maxTokens: PAGE_STRUCTURING_MAX_TOKENS,
    log: {
      taskType: "page-structuring",
      pageId: page.pageId,
      promptName: PAGE_STRUCTURING_REFINEMENT_PROMPT,
    },
  })

  return result.object
}

function validatePageStructuring(
  result: unknown,
  textTypes: TypeDef[],
  imageTypes: TypeDef[],
  containerTypes: TypeDef[],
  validImageIds: string[]
): ValidationResult {
  const r = result as { nodes: LLMContentNode[] }
  return validatePageStructuringNodes(
    r.nodes,
    textTypes,
    imageTypes,
    containerTypes,
    validImageIds
  )
}

function validatePageStructuringNodes(
  nodes: LLMContentNode[],
  textTypes: TypeDef[],
  imageTypes: TypeDef[],
  containerTypes: TypeDef[],
  validImageIds: string[]
): ValidationResult {
  const textTypeKeys = new Set(textTypes.map((t) => t.key))
  const imageTypeKeys = new Set(imageTypes.map((t) => t.key))
  const containerTypeKeys = new Set(containerTypes.map((t) => t.key))
  const allTypeKeys = new Set([...textTypeKeys, ...imageTypeKeys, ...containerTypeKeys])
  const imageIdSet = new Set(validImageIds)

  const errors: string[] = []

  function walkNodes(nodes: LLMContentNode[], path: string) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      const nodePath = `${path}[${i}]`

      if (!allTypeKeys.has(node.node_type)) {
        errors.push(
          `${nodePath}: Invalid node_type "${node.node_type}". Must be one of: ${[...allTypeKeys].join(", ")}`
        )
      }

      const hasChildren = node.children != null && node.children.length > 0
      const hasText = node.text != null
      const hasImage = node.image_id != null

      // Container nodes must use container types
      if (hasChildren && !containerTypeKeys.has(node.node_type)) {
        errors.push(
          `${nodePath}: node_type "${node.node_type}" has children but is not a container type. Container types: ${[...containerTypeKeys].join(", ")}`
        )
      }

      // Text nodes must use text types
      if (hasText && !textTypeKeys.has(node.node_type)) {
        errors.push(
          `${nodePath}: node_type "${node.node_type}" has text but is not a text type. Text types: ${[...textTypeKeys].join(", ")}`
        )
      }

      // Image nodes must use image types
      if (hasImage && !imageTypeKeys.has(node.node_type)) {
        errors.push(
          `${nodePath}: node_type "${node.node_type}" has image_id but is not an image type. Image types: ${[...imageTypeKeys].join(", ")}`
        )
      }

      // Leaf nodes should not have both text and image
      if (hasText && hasImage) {
        errors.push(
          `${nodePath}: Node has both text and image_id. A leaf node should have one or the other.`
        )
      }

      // Validate image IDs
      if (hasImage && !imageIdSet.has(node.image_id!)) {
        errors.push(
          `${nodePath}: Invalid image_id "${node.image_id}". Must be one of: ${validImageIds.join(", ")}`
        )
      }

      // Recurse into children
      if (hasChildren) {
        walkNodes(node.children!, `${nodePath}.children`)
      }
    }
  }

  walkNodes(nodes, "nodes")
  return { valid: errors.length === 0, errors }
}

/**
 * Build StructureConfig from AppConfig.
 * Assumes migrateAppConfig has already been called (normalizes legacy keys).
 */
export function buildStructureConfig(appConfig: AppConfig): StructureConfig {
  const textTypes: TypeDef[] = Object.entries(appConfig.text_types ?? {}).map(
    ([key, description]) => ({ key, description })
  )
  const imageTypes: TypeDef[] = Object.entries(appConfig.image_types ?? {}).map(
    ([key, description]) => ({ key, description })
  )
  const containerTypes: TypeDef[] = Object.entries(appConfig.container_types ?? {}).map(
    ([key, description]) => ({ key, description })
  )

  return {
    textTypes,
    imageTypes,
    containerTypes,
    prunedTextTypes: appConfig.pruned_text_types ?? [],
    promptName: appConfig.page_structuring?.prompt ?? "page_structuring",
    modelId: appConfig.page_structuring?.model ?? "openai:gpt-5.4",
    maxRetries: appConfig.page_structuring?.max_retries ?? DEFAULT_LLM_MAX_RETRIES,
  }
}
