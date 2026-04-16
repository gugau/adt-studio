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
  containerTypes: TypeDef[]
  prunedTextTypes: string[]
  promptName: string
  modelId: string
  maxRetries: number
  /** Max self-review refinement passes. Defaults to PAGE_STRUCTURING_MAX_REFINEMENTS (3). Set to 0 to skip refinement. */
  maxRefinements?: number
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
    validatePageStructuring(raw, config.textTypes, config.containerTypes, imageIds)

  const result = await llmModel.generateObject<RawPageStructuringResult>({
    schema: buildPageStructuringLLMSchema(),
    mode: "json",
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

  const maxRefinements = config.maxRefinements ?? PAGE_STRUCTURING_MAX_REFINEMENTS
  for (let iteration = 1; iteration <= maxRefinements; iteration++) {
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

      const hasChildren = node.children != null && node.children.length > 0

      if (hasChildren) {
        const container: ContentNodeData = {
          nodeId,
          structure: node.structure!,
          children: assignIds(node.children!),
          isPruned: false,
        }
        return container
      }

      const finalized: ContentNodeData = {
        nodeId,
        role: node.role!,
        isPruned: prunedSet.has(node.role!),
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
    mode: "json",
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
  containerTypes: TypeDef[],
  validImageIds: string[]
): ValidationResult {
  const r = result as { nodes: LLMContentNode[] }
  return validatePageStructuringNodes(
    r.nodes,
    textTypes,
    containerTypes,
    validImageIds
  )
}

function validatePageStructuringNodes(
  nodes: LLMContentNode[],
  textTypes: TypeDef[],
  containerTypes: TypeDef[],
  validImageIds: string[]
): ValidationResult {
  const textTypeKeys = new Set(textTypes.map((t) => t.key))
  const containerTypeKeys = new Set(containerTypes.map((t) => t.key))
  const imageIdSet = new Set(validImageIds)

  const errors: string[] = []

  let tooDeep = false

  function walkNodes(nodes: LLMContentNode[], path: string, depth: number) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      const nodePath = `${path}[${i}]`

      const hasChildren = node.children != null && node.children.length > 0
      const hasText = node.text != null
      const hasImage = node.image_id != null
      const hasStructure = node.structure != null
      const hasRole = node.role != null

      // Detect nodes that look like failed containers — the LLM wanted to nest
      // deeper but couldn't.
      if (!hasChildren && hasStructure && !hasText && !hasImage) {
        tooDeep = true
        errors.push(
          `${nodePath}: Node has structure "${node.structure}" but no children, text, or image_id. The tree is nested too deeply — simplify by removing unnecessary intermediate containers or flattening content.`
        )
        continue
      }

      if (hasChildren) {
        // Container node: must have structure, no role, no image_id.
        if (!hasStructure) {
          errors.push(
            `${nodePath}: Container node (has children) is missing "structure". Set structure to one of: ${[...containerTypeKeys].join(", ")}`
          )
        } else if (!containerTypeKeys.has(node.structure!)) {
          errors.push(
            `${nodePath}: Invalid structure "${node.structure}". Must be one of: ${[...containerTypeKeys].join(", ")}`
          )
        }
        if (hasRole) {
          errors.push(
            `${nodePath}: Container node should not have "role" — use "structure" for containers and "role" for leaves.`
          )
        }
        if (hasImage) {
          errors.push(
            `${nodePath}: Container node should not have "image_id". Use an image leaf child (role: "image") inside the container instead.`
          )
        }
      } else if (hasText) {
        // Text leaf: must have role from text types, no structure
        if (!hasRole) {
          errors.push(
            `${nodePath}: Text leaf node is missing "role". Set role to one of: ${[...textTypeKeys].join(", ")}`
          )
        } else if (!textTypeKeys.has(node.role!)) {
          errors.push(
            `${nodePath}: Invalid role "${node.role}" for text leaf. Must be one of: ${[...textTypeKeys].join(", ")}`
          )
        }
        if (hasStructure) {
          errors.push(
            `${nodePath}: Text leaf should not have "structure" — use "role" for leaves and "structure" for containers.`
          )
        }
      } else {
        // Node doesn't fit container or text-leaf pattern
        if (hasRole && !textTypeKeys.has(node.role!)) {
          errors.push(
            `${nodePath}: Invalid role "${node.role}". Must be one of: ${[...textTypeKeys].join(", ")}`
          )
        }
        if (hasImage && !imageIdSet.has(node.image_id!)) {
          errors.push(
            `${nodePath}: Invalid image_id "${node.image_id}". Must be one of: ${validImageIds.join(", ")}`
          )
        }
        if (!hasRole && !hasStructure) {
          errors.push(
            `${nodePath}: Node has no structure, role, text, or image_id. Every node must be either a container (structure + children) or a leaf (role + text).`
          )
        }
      }

      // Leaf nodes should not have both text and image
      if (hasText && hasImage) {
        errors.push(
          `${nodePath}: Node has both text and image_id. Use an "image_group" container with an image leaf child and text children instead.`
        )
      }

      // Recurse into children
      if (hasChildren) {
        walkNodes(node.children!, `${nodePath}.children`, depth + 1)
      }
    }
  }

  walkNodes(nodes, "nodes", 0)

  if (tooDeep) {
    errors.push(
      "IMPORTANT: Your tree nesting is too deep. Reduce nesting by removing unnecessary intermediate containers. Not every visual grouping needs its own container — flatten where possible."
    )
  }

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
  const containerTypes: TypeDef[] = Object.entries(appConfig.container_types ?? {}).map(
    ([key, description]) => ({ key, description })
  )

  return {
    textTypes,
    containerTypes,
    prunedTextTypes: appConfig.pruned_text_types ?? [],
    promptName: appConfig.page_structuring?.prompt ?? "page_structuring",
    modelId: appConfig.page_structuring?.model ?? "openai:gpt-5.4",
    maxRetries: appConfig.page_structuring?.max_retries ?? DEFAULT_LLM_MAX_RETRIES,
  }
}
