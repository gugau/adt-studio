import { z } from "zod"

/**
 * Explicit TypeScript interface for the recursive ContentNode.
 * z.infer cannot resolve z.lazy cycles, so we define this manually.
 */
export interface ContentNodeData {
  nodeId: string
  nodeType: string
  /** Text content — present on text leaf nodes only */
  text?: string
  /** Image reference — present on image leaf nodes only */
  imageId?: string
  /** Child nodes — present on container nodes only */
  children?: ContentNodeData[]
  isPruned: boolean
}

/**
 * Recursive Zod schema for a content tree node.
 *
 * Nodes are either:
 *   - Leaf (text): has `text`, no `children`
 *   - Leaf (image): has `imageId`, no `children`
 *   - Container: has `children`, no `text`/`imageId`
 */
export const ContentNode: z.ZodType<ContentNodeData> = z.lazy(() =>
  z.object({
    nodeId: z.string(),
    nodeType: z.string(),
    text: z.string().optional(),
    imageId: z.string().optional(),
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
  node_type: string
  text?: string | null
  image_id?: string | null
  children?: LLMContentNode[] | null
}

/**
 * Maximum nesting depth for the LLM schema.
 * OpenAI structured outputs don't support $ref-based recursive schemas,
 * so we unroll to a fixed depth using concrete nesting.
 */
const LLM_SCHEMA_MAX_DEPTH = 5

/**
 * Build an LLM-facing schema for page structuring.
 *
 * Uses concrete nesting (not z.lazy) because OpenAI's structured output API
 * rejects $ref-based JSON Schema produced by z.lazy. The schema is unrolled
 * to LLM_SCHEMA_MAX_DEPTH levels — leaf nodes at the deepest level cannot
 * have children.
 */
export function buildPageStructuringLLMSchema() {
  // OpenAI structured outputs require every property in `required`.
  // Use .nullable() instead of .optional() so fields are always present
  // but can be null when not applicable.

  // Build inside-out: deepest level first (leaf-only), then wrap
  let nodeSchema: z.ZodTypeAny = z.object({
    node_type: z.string(),
    text: z.string().nullable(),
    image_id: z.string().nullable(),
  })

  for (let i = 1; i < LLM_SCHEMA_MAX_DEPTH; i++) {
    nodeSchema = z.object({
      node_type: z.string(),
      text: z.string().nullable(),
      image_id: z.string().nullable(),
      children: z.array(nodeSchema).nullable(),
    })
  }

  return z.object({
    reasoning: z.string(),
    nodes: z.array(nodeSchema),
  })
}
