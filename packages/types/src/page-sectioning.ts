import { z } from "zod"

export const SectionTextEntry = z.object({
  textId: z.string(),
  textType: z.string(),
  text: z.string(),
  isPruned: z.boolean(),
})
export type SectionTextEntry = z.infer<typeof SectionTextEntry>

export const SectionTextPart = z.object({
  type: z.literal("text_group"),
  groupId: z.string(),
  groupType: z.string(),
  texts: z.array(SectionTextEntry),
  isPruned: z.boolean(),
})
export type SectionTextPart = z.infer<typeof SectionTextPart>

export const SectionImagePart = z.object({
  type: z.literal("image"),
  imageId: z.string(),
  isPruned: z.boolean(),
  reason: z.string().optional(),
})
export type SectionImagePart = z.infer<typeof SectionImagePart>

/**
 * A recursive group that nests other parts (text_group, image, or nested groups).
 * Used to express structural roles within activity sections (e.g., question, option)
 * and layout grouping in content sections.
 */
export const SectionGroupPart: z.ZodType<SectionGroupPartType> = z.object({
  type: z.literal("group"),
  groupId: z.string(),
  groupType: z.string(),
  parts: z.lazy(() => z.array(SectionPart)),
  isPruned: z.boolean(),
  answer: z.string().optional(),
  reasoning: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export type SectionGroupPartType = {
  type: "group"
  groupId: string
  groupType: string
  parts: SectionPart[]
  isPruned: boolean
  answer?: string
  reasoning?: string
  metadata?: Record<string, unknown>
}

// Use z.union instead of z.discriminatedUnion because z.lazy is not compatible
// with discriminatedUnion. The "type" field still acts as the discriminator at runtime.
export const SectionPart: z.ZodType<SectionPart> = z.union([
  SectionTextPart,
  SectionImagePart,
  SectionGroupPart,
])
export type SectionPart = SectionTextPart | SectionImagePart | SectionGroupPartType

export const PageSection = z.object({
  sectionId: z.string(),
  sectionType: z.string(),
  parts: z.array(SectionPart),
  backgroundColor: z.string(),
  textColor: z.string(),
  pageNumber: z.number().int().nullable(),
  isPruned: z.boolean(),
})
export type PageSection = z.infer<typeof PageSection>

export const PageSectioningOutput = z.object({
  reasoning: z.string(),
  sections: z.array(PageSection),
})
export type PageSectioningOutput = z.infer<typeof PageSectioningOutput>

// ---------------------------------------------------------------------------
// Helpers — recursive part traversal
// ---------------------------------------------------------------------------

/**
 * Recursively flatten a parts array, yielding all leaf parts (text_group and image)
 * in document order. Groups are traversed depth-first; the group wrapper is not included.
 */
export function flattenParts(parts: readonly SectionPart[]): (SectionTextPart | SectionImagePart)[] {
  const result: (SectionTextPart | SectionImagePart)[] = []
  for (const part of parts) {
    if (part.type === "group") {
      result.push(...flattenParts(part.parts))
    } else {
      result.push(part)
    }
  }
  return result
}

/**
 * Recursively collect all non-pruned image parts from a parts tree.
 */
export function flattenImageParts(parts: readonly SectionPart[]): SectionImagePart[] {
  return flattenParts(parts).filter(
    (p): p is SectionImagePart => p.type === "image" && !p.isPruned,
  )
}

/**
 * Recursively collect all non-pruned text_group parts from a parts tree.
 */
export function flattenTextParts(parts: readonly SectionPart[]): SectionTextPart[] {
  return flattenParts(parts).filter(
    (p): p is SectionTextPart => p.type === "text_group" && !p.isPruned,
  )
}

/**
 * Build an LLM-facing schema for page sectioning.
 * Enum fields use z.string() so invalid values are caught by our validate
 * callback (which feeds errors back to the LLM) instead of causing a
 * NoObjectGeneratedError that retries blindly.
 *
 * The `parts` array accepts:
 * - Plain string IDs (group IDs, text entry IDs, or image IDs)
 * - Group objects: `{ group_type, items }` where items can be string IDs
 *   or nested group objects (max 2 levels: option_group → option → IDs)
 */
export function buildPageSectioningLLMSchema() {
  // Leaf group: { group_type, items: string[] }
  const LeafGroup = z.object({
    group_type: z.string(),
    items: z.array(z.string()),
  })

  // Top-level group: { group_type, items: (string | LeafGroup)[] }
  const PartGroup = z.object({
    group_type: z.string(),
    items: z.array(z.union([z.string(), LeafGroup])),
  })

  return z.object({
    reasoning: z.string(),
    sections: z.array(
      z.object({
        section_type: z.string(),
        parts: z.array(z.union([z.string(), PartGroup])),
        background_color: z.string(),
        text_color: z.string(),
        page_number: z.number().int().nullable(),
      })
    ),
  })
}

/** Type for items in a PartGroup (output from LLM). */
export type LLMPartGroupItem = string | { group_type: string; items: string[] }
/** Type for a PartGroup (output from LLM). */
export type LLMPartGroup = { group_type: string; items: LLMPartGroupItem[] }
/** Type for a section part in LLM output — plain ID or group. */
export type LLMSectionPart = string | LLMPartGroup
