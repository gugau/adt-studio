import type {
  TextClassificationOutput,
  ImageClassificationOutput,
  PageSectioningOutput,
  SectionPart,
  SectionTextPart,
  AppConfig,
  TypeDef,
  SectioningMode,
  SectionGroupPartType,
  LLMSectionPart,
  LLMPartGroup,
  LLMPartGroupItem,
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
  textClassification: TextClassificationOutput
  imageClassification: ImageClassificationOutput
  images: Array<{ imageId: string; imageBase64: string }>
}

export interface TextEntrySummary {
  textId: string
  textType: string
  text: string
}

export interface GroupSummary {
  groupId: string
  groupType: string
  texts: TextEntrySummary[]
}

/**
 * Build group summaries from text classification, exposing individual text
 * entries with pre-assigned IDs so the LLM can reference either whole groups
 * or individual text entries. Pruned groups and pruned text entries are excluded.
 */
export function buildGroupSummaries(
  textClassification: TextClassificationOutput
): GroupSummary[] {
  return textClassification.groups
    .map((g) => {
      if (g.isPruned) return null
      // Assign IDs based on index within the full group (including pruned)
      // then filter to only unpruned entries for the LLM
      const textsWithIds = g.texts.map((t, idx) => ({
        textId: `${g.groupId}_tx${String(idx + 1).padStart(3, "0")}`,
        textType: t.textType,
        text: t.text,
        isPruned: t.isPruned,
      }))
      const unprunedTexts = textsWithIds.filter((t) => !t.isPruned)
      if (unprunedTexts.length === 0) return null

      return {
        groupId: g.groupId,
        groupType: g.groupType,
        texts: unprunedTexts.map(({ textId, textType, text }) => ({
          textId,
          textType,
          text,
        })),
      }
    })
    .filter((g): g is NonNullable<typeof g> => g !== null)
}

// ---------------------------------------------------------------------------
// Post-processing: restructure flat parts into groups for activity sections
// ---------------------------------------------------------------------------

/**
 * Restructure flat parts into nested groups for activity sections.
 * - Extracts `activity_option` entries from text_groups into `option` groups
 * - Wraps consecutive options in an `option_group`
 * - Splits mixed text_groups (question text + options) into separate parts
 * Non-activity sections are returned unchanged.
 */
export function structureActivityParts(sectionType: string, parts: SectionPart[]): SectionPart[] {
  if (!sectionType.startsWith("activity_")) return parts

  const result: SectionPart[] = []
  const pendingOptions: SectionGroupPartType[] = []

  const flushOptions = () => {
    if (pendingOptions.length === 0) return
    // Use the first option's ID to derive the option_group ID
    const firstOptId = pendingOptions[0].groupId
    const grpId = firstOptId.replace(/_opt$/, "_optgrp")
    result.push({
      type: "group",
      groupId: grpId,
      groupType: "option_group",
      parts: [...pendingOptions],
      isPruned: false,
    })
    pendingOptions.length = 0
  }

  const makeOption = (entry: SectionTextPart["texts"][number], sourceGroupType: string): SectionGroupPartType => ({
    type: "group",
    groupId: `${entry.textId}_opt`,
    groupType: "option",
    parts: [{
      type: "text_group" as const,
      groupId: `${entry.textId}_tg`,
      groupType: sourceGroupType,
      texts: [entry],
      isPruned: false,
    }],
    isPruned: entry.isPruned,
  })

  for (const part of parts) {
    if (part.type !== "text_group") {
      // Images and existing groups pass through; flush pending options first
      flushOptions()
      result.push(part)
      continue
    }

    const nonPrunedEntries = part.texts.filter((t) => !t.isPruned)
    const optionEntries = nonPrunedEntries.filter((t) => t.textType === "activity_option")
    const nonOptionEntries = part.texts.filter((t) => t.textType !== "activity_option" || t.isPruned)

    if (optionEntries.length === 0) {
      // No options — keep text_group as-is
      flushOptions()
      result.push(part)
    } else if (nonOptionEntries.filter((t) => !t.isPruned).length === 0) {
      // ALL non-pruned entries are options — each becomes an option group
      for (const entry of optionEntries) {
        pendingOptions.push(makeOption(entry, part.groupType))
      }
    } else {
      // MIXED — split: non-option entries stay in the text_group, options become groups
      flushOptions()
      result.push({
        ...part,
        texts: nonOptionEntries,
      })
      for (const entry of optionEntries) {
        pendingOptions.push(makeOption(entry, part.groupType))
      }
    }
  }

  flushOptions()
  return result
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
  // Build group summaries with individual text entry IDs
  const groupSummaries = buildGroupSummaries(input.textClassification)

  // Filter to un-pruned images
  const prunedImageIds = new Set(
    input.imageClassification.images
      .filter((img) => img.isPruned)
      .map((img) => img.imageId)
  )
  const unprunedImages = input.images.filter(
    (img) => !prunedImageIds.has(img.imageId)
  )

  // Build valid part IDs: group IDs, individual text entry IDs, and image IDs
  const validPartIds = new Set([
    ...groupSummaries.map((g) => g.groupId),
    ...groupSummaries.flatMap((g) => g.texts.map((t) => t.textId)),
    ...unprunedImages.map((img) => img.imageId),
  ])

  // If no parts to section, return empty result
  if (validPartIds.size === 0) {
    return { reasoning: "No content to section", sections: [] }
  }

  const sectionTypeKeys = config.sectionTypes.map((s) => s.key)
  if (sectionTypeKeys.length === 0) {
    throw new Error("No section types configured")
  }

  const schema = buildPageSectioningLLMSchema()

  const result = await llmModel.generateObject<{
    reasoning: string
    sections: Array<{
      section_type: string
      parts: LLMSectionPart[]
      background_color: string
      text_color: string
      page_number: number | null
    }>
  }>({
    schema,
    prompt: config.promptName,
    context: {
      sectioning_mode: config.mode,
      page: { imageBase64: input.pageImageBase64 },
      images: unprunedImages.map((img) => ({
        image_id: img.imageId,
        imageBase64: img.imageBase64,
      })),
      groups: groupSummaries.map((g) => ({
        group_id: g.groupId,
        group_type: g.groupType,
        texts: g.texts.map((t) => ({
          text_id: t.textId,
          text_type: t.textType,
          text: t.text,
        })),
      })),
      section_types: config.sectionTypes,
    },
    validate: validatePageSectioning,
    maxRetries: config.maxRetries,
    maxTokens: 16384,
    log: {
      taskType: "page-sectioning",
      pageId: input.pageId,
      promptName: config.promptName,
    },
  })

  // Build lookup maps for expanding IDs into inline parts
  const groupMap = new Map(
    input.textClassification.groups.map((g) => [g.groupId, g])
  )
  // Map individual text entry IDs → { group, textIndex }
  const textEntryMap = new Map<string, { groupId: string; textIdx: number }>()
  for (const g of input.textClassification.groups) {
    for (let i = 0; i < g.texts.length; i++) {
      const textId = `${g.groupId}_tx${String(i + 1).padStart(3, "0")}`
      textEntryMap.set(textId, { groupId: g.groupId, textIdx: i })
    }
  }
  const imageClassMap = new Map(
    input.imageClassification.images.map((img) => [img.imageId, img])
  )

  // Track which groups/text entries/images get assigned
  const assignedGroupIds = new Set<string>()
  const assignedTextEntryIds = new Set<string>()
  const assignedImageIds = new Set<string>()

  /** Expand a single string ID to a SectionPart */
  const expandStringId = (id: string): SectionPart | null => {
    // Check if it's a group ID
    const group = groupMap.get(id)
    if (group) {
      assignedGroupIds.add(id)
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

    // Check if it's an individual text entry ID
    const entry = textEntryMap.get(id)
    if (entry) {
      assignedTextEntryIds.add(id)
      assignedGroupIds.add(entry.groupId) // mark parent group as covered
      const g = groupMap.get(entry.groupId)!
      const t = g.texts[entry.textIdx]
      return {
        type: "text_group" as const,
        groupId: `${id}_tg`,
        groupType: g.groupType,
        texts: [{
          textId: id,
          textType: t.textType,
          text: t.text,
          isPruned: t.isPruned,
        }],
        isPruned: t.isPruned,
      }
    }

    // Must be an image ID
    assignedImageIds.add(id)
    const imgClass = imageClassMap.get(id)
    return {
      type: "image" as const,
      imageId: id,
      isPruned: false,
      ...(imgClass?.reason ? { reason: imgClass.reason } : {}),
    }
  }

  /** Expand an LLMPartGroupItem to SectionPart(s) */
  const expandGroupItem = (item: LLMPartGroupItem): SectionPart[] => {
    if (typeof item === "string") {
      const part = expandStringId(item)
      return part ? [part] : []
    }
    // Leaf group: { group_type, items: string[] }
    const childParts: SectionPart[] = []
    for (const childId of item.items) {
      const part = expandStringId(childId)
      if (part) childParts.push(part)
    }
    if (childParts.length === 0) return []
    return [{
      type: "group" as const,
      groupId: `${item.items[0]}_grp`,
      groupType: item.group_type,
      parts: childParts,
      isPruned: false,
    }]
  }

  /** Expand an LLMSectionPart to SectionPart(s) */
  const expandLLMPart = (llmPart: LLMSectionPart, sectionId: string, partIdx: number): SectionPart[] => {
    if (typeof llmPart === "string") {
      const part = expandStringId(llmPart)
      return part ? [part] : []
    }
    // PartGroup: { group_type, items: (string | LeafGroup)[] }
    const childParts: SectionPart[] = []
    for (const item of llmPart.items) {
      childParts.push(...expandGroupItem(item))
    }
    if (childParts.length === 0) return []
    return [{
      type: "group" as const,
      groupId: `${sectionId}_grp${String(partIdx + 1).padStart(3, "0")}`,
      groupType: llmPart.group_type,
      parts: childParts,
      isPruned: false,
    }]
  }

  // Post-process: mark pruned sections, expand parts to inline SectionParts
  const prunedSet = new Set(config.prunedSectionTypes)

  const sections = result.object.sections.map((s, idx) => {
    const sectionId = `${input.pageId}_sec${String(idx + 1).padStart(3, "0")}`
    const parts: SectionPart[] = []
    for (let i = 0; i < s.parts.length; i++) {
      parts.push(...expandLLMPart(s.parts[i], sectionId, i))
    }

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

  // Build a map from segmented source image → ordered segment image IDs.
  // Segmented images have IDs like "{sourceId}_seg{NNN}_v{N}".
  const segmentsBySource = new Map<string, string[]>()
  for (const img of input.imageClassification.images) {
    const segMatch = img.imageId.match(/^(.+)_seg\d{3}_v\d+$/)
    if (segMatch) {
      const sourceId = segMatch[1]
      if (!segmentsBySource.has(sourceId)) segmentsBySource.set(sourceId, [])
      segmentsBySource.get(sourceId)!.push(img.imageId)
    }
  }

  // Replace segmented originals in-place with their segments (recursive).
  const expandSegments = (parts: SectionPart[]): SectionPart[] => {
    const result: SectionPart[] = []
    for (const part of parts) {
      if (part.type === "group") {
        result.push({ ...part, parts: expandSegments(part.parts) })
      } else if (part.type === "image" && segmentsBySource.has(part.imageId)) {
        const segIds = segmentsBySource.get(part.imageId)!
        for (const segId of segIds) {
          const segClass = imageClassMap.get(segId)
          result.push({
            type: "image",
            imageId: segId,
            isPruned: segClass?.isPruned ?? false,
            ...(segClass?.reason ? { reason: segClass.reason } : {}),
          })
          assignedImageIds.add(segId)
        }
        result.push({ ...part, isPruned: true, reason: "segmented" })
      } else {
        result.push(part)
      }
    }
    return result
  }

  for (const section of sections) {
    section.parts = expandSegments(section.parts)
  }

  // Collect unassigned parts and add them to the last non-pruned section
  const unassignedParts: SectionPart[] = []

  for (const group of input.textClassification.groups) {
    if (!assignedGroupIds.has(group.groupId)) {
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
    if (!assignedImageIds.has(img.imageId)) {
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

function validatePageSectioning(
  result: unknown,
  context: Record<string, unknown>
): ValidationResult {
  const r = result as {
    sections: Array<{ section_type: string; parts: LLMSectionPart[] }>
  }
  const sectionTypes = context.section_types as TypeDef[]
  const groups = context.groups as Array<{
    group_id: string
    texts: Array<{ text_id: string }>
  }>
  const images = context.images as Array<{ image_id: string }>

  const sectionTypeKeys = new Set(sectionTypes.map((s) => s.key))
  // Valid IDs include group IDs, individual text entry IDs, and image IDs
  const validPartIds = new Set([
    ...groups.map((g) => g.group_id),
    ...groups.flatMap((g) => g.texts.map((t) => t.text_id)),
    ...images.map((img) => img.image_id),
  ])
  // Group-or-image IDs only (for checking assignment coverage)
  const topLevelIds = new Set([
    ...groups.map((g) => g.group_id),
    ...images.map((img) => img.image_id),
  ])
  // Map text entry IDs → parent group ID
  const textToGroup = new Map<string, string>()
  for (const g of groups) {
    for (const t of g.texts) {
      textToGroup.set(t.text_id, g.group_id)
    }
  }

  const errors: string[] = []
  const assignedTopLevelIds = new Set<string>()

  /** Recursively collect and validate all string IDs from an LLMSectionPart tree */
  const collectIds = (part: LLMSectionPart): void => {
    if (typeof part === "string") {
      if (!validPartIds.has(part)) {
        errors.push(
          `Invalid part ID "${part}". Must be one of: ${[...validPartIds].join(", ")}`
        )
      }
      // Track top-level coverage
      if (topLevelIds.has(part)) {
        assignedTopLevelIds.add(part)
      }
      const parentGroup = textToGroup.get(part)
      if (parentGroup) {
        assignedTopLevelIds.add(parentGroup)
      }
    } else {
      // PartGroup or LeafGroup
      for (const item of part.items) {
        if (typeof item === "string") {
          collectIds(item)
        } else {
          // Nested leaf group
          for (const leafId of item.items) {
            collectIds(leafId)
          }
        }
      }
    }
  }

  for (const section of r.sections) {
    if (!sectionTypeKeys.has(section.section_type)) {
      errors.push(
        `Invalid section_type "${section.section_type}". Must be one of: ${sectionTypes.map((s) => s.key).join(", ")}`
      )
    }
    for (const part of section.parts) {
      collectIds(part)
    }
  }

  // Ensure all top-level groups and images are covered
  const unassigned = [...topLevelIds].filter((id) => !assignedTopLevelIds.has(id))
  if (unassigned.length > 0) {
    errors.push(
      `Every group and image must be assigned to a section. Unassigned: ${unassigned.join(", ")}`
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
    prunedSectionTypes: appConfig.pruned_section_types ?? [],
    promptName: appConfig.page_sectioning?.prompt ?? "page_sectioning",
    modelId: appConfig.page_sectioning?.model ?? "openai:gpt-5.4",
    maxRetries:
      appConfig.page_sectioning?.max_retries ?? DEFAULT_LLM_MAX_RETRIES,
    mode: appConfig.page_sectioning?.mode ?? "dynamic",
  }
}
