import { z } from "zod"

/**
 * Explicit TypeScript interface for the recursive ContentNode.
 * z.infer cannot resolve z.lazy cycles, so we define this manually.
 *
 * Three node shapes (mutually exclusive):
 *   - Container: `structure` + `children`, optional `backgroundImageId`
 *     (the container's region is overlaid on this background image).
 *   - Text leaf: `role` (text type) + `text`.
 *   - Image leaf: `role: "image"` + `imageId`.
 */
export interface ContentNodeData {
  nodeId: string
  /** Container structure type — present on container nodes only */
  structure?: string
  /** Semantic role — present on leaf nodes only ("image" for image leaves, otherwise a text type) */
  role?: string
  /** Text content — present on text leaf nodes only */
  text?: string
  /** Image reference — present on image leaves (role: "image") */
  imageId?: string
  /** Background image — present on container nodes whose children sit on top of this image */
  backgroundImageId?: string
  /** Child nodes — present on container nodes only */
  children?: ContentNodeData[]
  isPruned: boolean
}

export const ContentNode: z.ZodType<ContentNodeData> = z.lazy(() =>
  z.object({
    nodeId: z.string(),
    structure: z.string().optional(),
    role: z.string().optional(),
    text: z.string().optional(),
    imageId: z.string().optional(),
    backgroundImageId: z.string().optional(),
    children: z.array(ContentNode).optional(),
    isPruned: z.boolean(),
  })
)

export const PageStructuringOutput = z.object({
  reasoning: z.string(),
  nodes: z.array(ContentNode),
})
export type PageStructuringOutput = z.infer<typeof PageStructuringOutput> & {
  nodes: ContentNodeData[]
}

/**
 * LLM-facing shape for a content node (snake_case, no nodeId/isPruned).
 * Used to type the generateObject result before post-processing.
 */
export interface LLMContentNode {
  structure?: string | null
  role?: string | null
  text?: string | null
  image_id?: string | null
  background_image_id?: string | null
  children?: LLMContentNode[] | null
}

export interface PageStructuringRefinementLLMOutput {
  approved: boolean
  reasoning: string
  nodes: LLMContentNode[]
}

/**
 * LLM-facing content node schema — non-recursive.
 *
 * We use mode: "json" so the schema is embedded in the prompt, not enforced
 * server-side (which caps nesting at 10 levels). The Liquid prompt templates
 * describe the full recursive node structure; this schema just validates
 * the top-level shape. Deep tree validation (types, roles, nesting) is
 * handled by the custom validate callback in page-structuring.ts.
 *
 * Children are typed as z.any() to avoid recursive $ref issues with
 * zod-to-json-schema conversion.
 */
const LLMContentNodeSchema = z.object({
  structure: z.string().nullish(),
  role: z.string().nullish(),
  text: z.string().nullish(),
  image_id: z.string().nullish(),
  background_image_id: z.string().nullish(),
  children: z.array(z.any()).nullish(),
})

export function buildPageStructuringLLMSchema() {
  return z.object({
    reasoning: z.string(),
    nodes: z.array(LLMContentNodeSchema),
  })
}

export function buildPageStructuringRefinementLLMSchema() {
  return z.object({
    approved: z.boolean(),
    reasoning: z.string(),
    nodes: z.array(LLMContentNodeSchema),
  })
}
