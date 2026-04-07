import {
  type PageStructuringOutput,
  type ContentNodeData,
  type LLMContentNode,
  buildPageStructuringLLMSchema,
  type TypeDef,
  type AppConfig,
  DEFAULT_LLM_MAX_RETRIES,
} from "@adt/types"
import type { LLMModel, ValidationResult } from "@adt/llm"

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

  const schema = buildPageStructuringLLMSchema()

  const imageIds = page.images.map((img) => img.imageId)

  const result = await llmModel.generateObject<{
    reasoning: string
    nodes: LLMContentNode[]
  }>({
    schema,
    prompt: config.promptName,
    context: {
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
    },
    validate: (raw: unknown) =>
      validatePageStructuring(raw, config.textTypes, config.imageTypes, config.containerTypes, imageIds),
    maxRetries: config.maxRetries,
    maxTokens: 16384,
    log: {
      taskType: "page-structuring",
      pageId: page.pageId,
      promptName: config.promptName,
    },
  })

  // Post-process: assign nodeIds and mark pruned entries
  const prunedSet = new Set(config.prunedTextTypes)
  let nodeCounter = 0

  function assignIds(llmNodes: LLMContentNode[]): ContentNodeData[] {
    return llmNodes.map((n) => {
      nodeCounter++
      const nodeId = `${page.pageId}_nd${String(nodeCounter).padStart(3, "0")}`

      if (n.children && n.children.length > 0) {
        // Container node
        return {
          nodeId,
          nodeType: n.node_type,
          children: assignIds(n.children),
          isPruned: false,
        }
      }

      // Leaf node (text or image)
      const node: ContentNodeData = {
        nodeId,
        nodeType: n.node_type,
        isPruned: prunedSet.has(n.node_type),
      }
      if (n.text != null) node.text = n.text
      if (n.image_id != null) node.imageId = n.image_id
      return node
    })
  }

  const nodes = assignIds(result.object.nodes)

  return {
    reasoning: result.object.reasoning,
    nodes,
  }
}

function validatePageStructuring(
  result: unknown,
  textTypes: TypeDef[],
  imageTypes: TypeDef[],
  containerTypes: TypeDef[],
  validImageIds: string[]
): ValidationResult {
  const r = result as { nodes: LLMContentNode[] }
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

  walkNodes(r.nodes, "nodes")
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
