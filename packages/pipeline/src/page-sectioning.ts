import type {
  TextClassificationOutput,
  ImageClassificationOutput,
  PageSectioningOutput,
  PageStructuringOutput,
  ContentNodeData,
  SectionPart,
  AppConfig,
  TypeDef,
  SectioningMode,
} from "@adt/types"
import {
  buildPageSectioningLLMSchema,
  DEFAULT_LLM_MAX_RETRIES,
} from "@adt/types"
import type { LLMModel, ValidationResult } from "@adt/llm"

export interface SectioningConfig {
  sectionTypes: TypeDef[]
  prunedSectionTypes: string[]
  promptName: string
  modelId: string
  maxRetries: number
  mode: SectioningMode
}

export interface SectionPageInput {
  pageId: string
  pageNumber: number
  pageImageBase64: string
  textClassification?: TextClassificationOutput
  contentTree?: PageStructuringOutput
  imageClassification: ImageClassificationOutput
  images: Array<{ imageId: string; imageBase64: string }>
}

/**
 * Build concise group summaries from text classification, excluding pruned text entries.
 * Groups with no unpruned texts are omitted entirely.
 */
export function buildGroupSummaries(
  textClassification: TextClassificationOutput
): Array<{ groupId: string; groupType: string; text: string }> {
  return textClassification.groups
    .map((g) => {
      if (g.isPruned) return null
      const unprunedTexts = g.texts.filter((t) => !t.isPruned)
      if (unprunedTexts.length === 0) return null

      return {
        groupId: g.groupId,
        groupType: g.groupType,
        text: unprunedTexts.map((t) => t.text).join(" "),
      }
    })
    .filter((g): g is NonNullable<typeof g> => g !== null)
}

/**
 * Recursively find a node by ID in a content tree.
 */
export function findNodeById(
  nodes: ContentNodeData[],
  id: string
): ContentNodeData | undefined {
  for (const node of nodes) {
    if (node.nodeId === id) return node
    if (node.children) {
      const found = findNodeById(node.children, id)
      if (found) return found
    }
  }
  return undefined
}

/**
 * Collect text from a content tree node for LLM summarisation.
 */
function collectNodeText(node: ContentNodeData): string {
  if (node.isPruned) return ""
  if (node.text != null) return node.text
  if (node.children) {
    return node.children
      .filter((c) => !c.isPruned)
      .map(collectNodeText)
      .filter(Boolean)
      .join(" ")
  }
  return ""
}

/**
 * Build concise node summaries from a content tree for the LLM.
 * Only top-level nodes are emitted as assignable parts.
 * Pruned nodes are omitted.
 */
export function buildNodeSummaries(
  contentTree: PageStructuringOutput
): Array<{ nodeId: string; nodeType: string; text: string }> {
  return contentTree.nodes
    .filter((n) => !n.isPruned)
    .map((node) => ({
      nodeId: node.nodeId,
      nodeType: node.structure ?? node.role ?? "unknown",
      text: collectNodeText(node),
    }))
    .filter((s) => s.text.length > 0 || s.nodeType !== "unknown")
}

/**
 * Section a page into semantic groups. Pure function — no side effects.
 * The caller handles concurrency, storage writes, and progress.
 */
export async function sectionPage(
  input: SectionPageInput,
  config: SectioningConfig,
  llmModel: LLMModel
): Promise<PageSectioningOutput> {
  const useTree = !!input.contentTree
  const textClassification = input.textClassification

  // Build summaries based on input format
  const groupSummaries = textClassification ? buildGroupSummaries(textClassification) : []
  const nodeSummaries = input.contentTree ? buildNodeSummaries(input.contentTree) : []

  // Filter to un-pruned images
  const prunedImageIds = new Set(
    input.imageClassification.images
      .filter((img) => img.isPruned)
      .map((img) => img.imageId)
  )
  const unprunedImages = input.images.filter(
    (img) => !prunedImageIds.has(img.imageId)
  )

  // Build valid part IDs for the schema
  const validPartIds = useTree
    ? [
        ...nodeSummaries.map((n) => n.nodeId),
        ...unprunedImages.map((img) => img.imageId),
      ]
    : [
        ...groupSummaries.map((g) => g.groupId),
        ...unprunedImages.map((img) => img.imageId),
      ]

  // If no parts to section, return empty result
  if (validPartIds.length === 0) {
    return { reasoning: "No content to section", sections: [] }
  }

  const sectionTypeKeys = config.sectionTypes.map((s) => s.key)
  if (sectionTypeKeys.length === 0) {
    throw new Error("No section types configured")
  }

  const schema = buildPageSectioningLLMSchema()

  // Build LLM context — use nodes when tree is available, otherwise groups
  const llmContext: Record<string, unknown> = {
    sectioning_mode: config.mode,
    page: { imageBase64: input.pageImageBase64 },
    images: unprunedImages.map((img) => ({
      image_id: img.imageId,
      imageBase64: img.imageBase64,
    })),
    section_types: config.sectionTypes,
  }

  if (useTree) {
    llmContext.nodes = nodeSummaries.map((n) => ({
      node_id: n.nodeId,
      node_type: n.nodeType,
      text: n.text,
    }))
  } else {
    llmContext.groups = groupSummaries.map((g) => ({
      group_id: g.groupId,
      group_type: g.groupType,
      text: g.text,
    }))
  }

  const result = await llmModel.generateObject<{
    reasoning: string
    sections: Array<{
      section_type: string
      part_ids: string[]
      background_color: string
      text_color: string
      page_number: number | null
    }>
  }>({
    schema,
    prompt: config.promptName,
    context: llmContext,
    validate: validatePageSectioning,
    maxRetries: config.maxRetries,
    maxTokens: 16384,
    log: {
      taskType: "page-sectioning",
      pageId: input.pageId,
      promptName: config.promptName,
    },
  })

  // Build lookup maps for expanding part_ids into inline parts
  const imageClassMap = new Map(
    input.imageClassification.images.map((img) => [img.imageId, img])
  )

  // Track which parts get assigned to a section
  const assignedPartIds = new Set<string>()

  // Post-process: mark pruned sections, expand part_ids to inline parts
  const prunedSet = new Set(config.prunedSectionTypes)

  if (useTree) {
    // Tree-based flow: expand part_ids to SectionContentNodePart
    const treeNodes = input.contentTree!.nodes

    const sections = result.object.sections.map((s, idx) => {
      const sectionId = `${input.pageId}_sec${String(idx + 1).padStart(3, "0")}`
      const parts: SectionPart[] = s.part_ids.map((partId) => {
        assignedPartIds.add(partId)

        // Check if this is a node ID
        const node = findNodeById(treeNodes, partId)
        if (node) {
          return {
            type: "content_node" as const,
            nodeId: node.nodeId,
            node,
            isPruned: node.isPruned,
          }
        }

        // Otherwise it's an image ID
        const imgClass = imageClassMap.get(partId)
        return {
          type: "image" as const,
          imageId: partId,
          isPruned: false,
          ...(imgClass?.reason ? { reason: imgClass.reason } : {}),
        }
      })

      return {
        sectionId,
        sectionType: s.section_type,
        parts,
        backgroundColor: s.background_color,
        textColor: s.text_color,
        pageNumber: s.page_number,
        isPruned: prunedSet.has(s.section_type),
      }
    })

    // Handle image segmentation for tree path
    handleImageSegmentation(sections, input.imageClassification.images, imageClassMap, assignedPartIds)

    // Collect unassigned nodes
    const unassignedParts: SectionPart[] = []
    for (const node of treeNodes) {
      if (!assignedPartIds.has(node.nodeId)) {
        unassignedParts.push({
          type: "content_node" as const,
          nodeId: node.nodeId,
          node,
          isPruned: true,
        })
      }
    }
    for (const img of input.imageClassification.images) {
      if (!assignedPartIds.has(img.imageId)) {
        unassignedParts.push({
          type: "image",
          imageId: img.imageId,
          isPruned: img.isPruned,
          ...(img.reason ? { reason: img.reason } : {}),
        })
      }
    }

    if (unassignedParts.length > 0 && sections.length > 0) {
      const targetSection =
        [...sections].reverse().find((s) => !s.isPruned) ?? sections[0]
      targetSection.parts.push(...unassignedParts)
    }

    return { reasoning: result.object.reasoning, sections }
  }

  // Legacy flat flow: expand part_ids to SectionTextPart/SectionImagePart
  const groupMap = new Map(
    textClassification!.groups.map((g) => [g.groupId, g])
  )

  const sections = result.object.sections.map((s, idx) => {
    const sectionId = `${input.pageId}_sec${String(idx + 1).padStart(3, "0")}`
    const parts: SectionPart[] = s.part_ids.map((partId) => {
      assignedPartIds.add(partId)

      const group = groupMap.get(partId)
      if (group) {
        return {
          type: "text_group" as const,
          groupId: group.groupId,
          groupType: group.groupType,
          texts: group.texts.map((t, tIdx) => ({
            textId: `${group.groupId}_tx${String(tIdx + 1).padStart(3, "0")}`,
            textType: t.textType,
            text: t.text,
            isPruned: t.isPruned,
          })),
          isPruned: group.isPruned,
        }
      }

      const imgClass = imageClassMap.get(partId)
      return {
        type: "image" as const,
        imageId: partId,
        isPruned: false,
        ...(imgClass?.reason ? { reason: imgClass.reason } : {}),
      }
    })

    return {
      sectionId,
      sectionType: s.section_type,
      parts,
      backgroundColor: s.background_color,
      textColor: s.text_color,
      pageNumber: s.page_number,
      isPruned: prunedSet.has(s.section_type),
    }
  })

  // Handle image segmentation for legacy path
  handleImageSegmentation(sections, input.imageClassification.images, imageClassMap, assignedPartIds)

  // Collect unassigned parts and add them to the last non-pruned section
  const unassignedParts: SectionPart[] = []

  for (const group of textClassification!.groups) {
    if (!assignedPartIds.has(group.groupId)) {
      unassignedParts.push({
        type: "text_group",
        groupId: group.groupId,
        groupType: group.groupType,
        texts: group.texts.map((t, tIdx) => ({
          textId: `${group.groupId}_tx${String(tIdx + 1).padStart(3, "0")}`,
          textType: t.textType,
          text: t.text,
          isPruned: t.isPruned,
        })),
        isPruned: true,
      })
    }
  }

  for (const img of input.imageClassification.images) {
    if (!assignedPartIds.has(img.imageId)) {
      unassignedParts.push({
        type: "image",
        imageId: img.imageId,
        isPruned: img.isPruned,
        ...(img.reason ? { reason: img.reason } : {}),
      })
    }
  }

  if (unassignedParts.length > 0 && sections.length > 0) {
    const targetSection =
      [...sections].reverse().find((s) => !s.isPruned) ?? sections[0]
    targetSection.parts.push(...unassignedParts)
  }

  return {
    reasoning: result.object.reasoning,
    sections,
  }
}

/**
 * Extract segmented images and replace originals in-place within sections.
 */
function handleImageSegmentation(
  sections: Array<{ parts: SectionPart[] }>,
  allImages: Array<{ imageId: string; isPruned: boolean; reason?: string }>,
  imageClassMap: Map<string, { imageId: string; isPruned: boolean; reason?: string }>,
  assignedPartIds: Set<string>
): void {
  const segmentsBySource = new Map<string, string[]>()
  for (const img of allImages) {
    const segMatch = img.imageId.match(/^(.+)_seg\d{3}_v\d+$/)
    if (segMatch) {
      const sourceId = segMatch[1]
      if (!segmentsBySource.has(sourceId)) segmentsBySource.set(sourceId, [])
      segmentsBySource.get(sourceId)!.push(img.imageId)
    }
  }

  for (const section of sections) {
    const expandedParts: SectionPart[] = []
    for (const part of section.parts) {
      if (part.type === "image" && segmentsBySource.has(part.imageId)) {
        const segIds = segmentsBySource.get(part.imageId)!
        for (const segId of segIds) {
          const segClass = imageClassMap.get(segId)
          expandedParts.push({
            type: "image",
            imageId: segId,
            isPruned: segClass?.isPruned ?? false,
            ...(segClass?.reason ? { reason: segClass.reason } : {}),
          })
          assignedPartIds.add(segId)
        }
        expandedParts.push({ ...part, isPruned: true, reason: "segmented" })
      } else {
        expandedParts.push(part)
      }
    }
    section.parts = expandedParts
  }
}

function validatePageSectioning(
  result: unknown,
  context: Record<string, unknown>
): ValidationResult {
  const r = result as {
    sections: Array<{ section_type: string; part_ids: string[] }>
  }
  const sectionTypes = context.section_types as TypeDef[]
  const groups = (context.groups as Array<{ group_id: string }>) ?? []
  const nodes = (context.nodes as Array<{ node_id: string }>) ?? []
  const images = context.images as Array<{ image_id: string }>

  const sectionTypeKeys = new Set(sectionTypes.map((s) => s.key))
  const validPartIds = new Set([
    ...groups.map((g) => g.group_id),
    ...nodes.map((n) => n.node_id),
    ...images.map((img) => img.image_id),
  ])

  const errors: string[] = []
  const assignedIds = new Set<string>()
  for (const section of r.sections) {
    if (!sectionTypeKeys.has(section.section_type)) {
      errors.push(
        `Invalid section_type "${section.section_type}". Must be one of: ${sectionTypes.map((s) => s.key).join(", ")}`
      )
    }
    for (const partId of section.part_ids) {
      if (!validPartIds.has(partId)) {
        errors.push(
          `Invalid part_id "${partId}". Must be one of: ${[...validPartIds].join(", ")}`
        )
      }
      assignedIds.add(partId)
    }
  }

  // Ensure all parts are assigned to at least one section
  const unassigned = [...validPartIds].filter((id) => !assignedIds.has(id))
  if (unassigned.length > 0) {
    errors.push(
      `Every part must be assigned to a section. Unassigned part_ids: ${unassigned.join(", ")}`
    )
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Build SectioningConfig from AppConfig.
 */
export function buildSectioningConfig(appConfig: AppConfig): SectioningConfig {
  const disabledSet = new Set(appConfig.disabled_section_types ?? [])
  const sectionTypes: TypeDef[] = Object.entries(
    appConfig.section_types ?? {}
  )
    .filter(([key]) => !disabledSet.has(key))
    .map(([key, description]) => ({ key, description }))

  return {
    sectionTypes,
    prunedSectionTypes: [...(appConfig.pruned_section_types ?? [])],
    promptName: appConfig.page_sectioning?.prompt ?? "page_sectioning",
    modelId: appConfig.page_sectioning?.model ?? "openai:gpt-5.4",
    maxRetries:
      appConfig.page_sectioning?.max_retries ?? DEFAULT_LLM_MAX_RETRIES,
    mode: appConfig.page_sectioning?.mode ?? "dynamic",
  }
}
