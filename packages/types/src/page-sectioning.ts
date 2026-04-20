import { z } from "zod"

// ── UI-wire types (flat parts) ──────────────────────────────────
// These mirror the pre-tree shape of the page-sectioning output. The
// storyboard editor UI is built against this flat shape; we keep it as a
// temporary wire format while individual pieces migrate to the canonical
// tree. `packages/pipeline/src/sectioning-shim.ts` converts at the API
// boundary.

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

export const SectionPart = z.discriminatedUnion("type", [
  SectionTextPart,
  SectionImagePart,
])
export type SectionPart = z.infer<typeof SectionPart>

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

export const UIPageSectioningOutput = z.object({
  reasoning: z.string(),
  sections: z.array(PageSection),
})
export type UIPageSectioningOutput = z.infer<typeof UIPageSectioningOutput>

// ── Tree node ───────────────────────────────────────────────────
// A content node is either a container (has `structure`, usually `children`)
// or a leaf (has `role` and `text`). The two arms are mutually exclusive;
// the runtime validator enforces this because Zod cannot express it cleanly
// alongside recursion without blowing up OpenAI's structured-output support.

// A content node is either a container (has `structure`, usually `children`)
// or a leaf (has `role` and `text`). Images are represented as leaves with
// role="image" whose `nodeId` IS the image file's id — an image_group
// container wraps them alongside caption/label leaves.
export type ContentNodeData = {
  nodeId: string
  isPruned: boolean

  // Container arm (mutually exclusive with leaf arm)
  structure?: string
  children?: ContentNodeData[]

  // Leaf arm
  role?: string
  text?: string
}

export const ContentNodeData: z.ZodType<ContentNodeData> = z.lazy(() =>
  z.object({
    nodeId: z.string(),
    isPruned: z.boolean(),
    structure: z.string().optional(),
    children: z.array(ContentNodeData).optional(),
    role: z.string().optional(),
    text: z.string().optional(),
  })
)

// ── Section ─────────────────────────────────────────────────────

export const PageSectioningSection = z.object({
  sectionId: z.string(),
  sectionType: z.string(),
  backgroundColor: z.string(),
  textColor: z.string(),
  pageNumber: z.number().int().nullable(),
  isPruned: z.boolean(),
  nodes: z.array(ContentNodeData),
})
export type PageSectioningSection = z.infer<typeof PageSectioningSection>

export const PageSectioningOutput = z.object({
  reasoning: z.string(),
  sections: z.array(PageSectioningSection),
})
export type PageSectioningOutput = z.infer<typeof PageSectioningOutput>

// ── LLM-facing schemas ──────────────────────────────────────────
// Recursive via z.lazy() so the JSON schema produced for OpenAI
// structured outputs has proper `items` on `children` (OpenAI strict
// mode rejects empty / missing items). Recursion is expressed via $ref
// in the generated schema, which OpenAI supports since 2024-08.

type LLMContentNodeShape = {
  structure?: string | null
  role?: string | null
  text?: string | null
  image_id?: string | null
  children?: LLMContentNodeShape[] | null
}

const LLMContentNodeShape: z.ZodType<LLMContentNodeShape> = z.lazy(() =>
  z.object({
    structure: z.string().nullish(),
    role: z.string().nullish(),
    text: z.string().nullish(),
    image_id: z.string().nullish(),
    children: z.array(LLMContentNodeShape).nullish(),
  })
)

export function buildPageSectioningLLMSchema() {
  return z.object({
    reasoning: z.string(),
    sections: z.array(
      z.object({
        section_type: z.string(),
        background_color: z.string(),
        text_color: z.string(),
        page_number: z.number().int().nullable(),
        nodes: z.array(LLMContentNodeShape),
      })
    ),
  })
}

export function buildPageSectioningRefinementLLMSchema() {
  return z.object({
    approved: z.boolean(),
    reasoning: z.string(),
    nodes_and_sections: z
      .object({
        reasoning: z.string(),
        sections: z.array(
          z.object({
            section_type: z.string(),
            background_color: z.string(),
            text_color: z.string(),
            page_number: z.number().int().nullable(),
            nodes: z.array(LLMContentNodeShape),
          })
        ),
      })
      .nullable(),
  })
}
