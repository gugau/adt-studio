import { z } from "zod"
import type { LLMModel, Message, ContentPart } from "@adt/llm"
import type { PageStructuringOutput, ContentNodeData, TypeDef } from "@adt/types"
import type { PageInput } from "./page-structuring.js"

const JUDGE_MAX_TOKENS = 4096

const PageEvaluationSchema = z.object({
  overall_score: z.number().min(1).max(10),
  scores: z.object({
    text_completeness: z.number().min(1).max(10),
    text_accuracy: z.number().min(1).max(10),
    tree_structure: z.number().min(1).max(10),
    type_accuracy: z.number().min(1).max(10),
    image_placement: z.number().min(1).max(10),
    reading_order: z.number().min(1).max(10),
  }),
  issues: z.array(
    z.object({
      category: z.enum([
        "missing_text",
        "wrong_type",
        "bad_structure",
        "wrong_order",
        "missing_image",
        "other",
      ]),
      description: z.string(),
      severity: z.enum(["low", "medium", "high"]),
    })
  ),
  suggestions: z.string(),
})

export type PageEvaluation = z.infer<typeof PageEvaluationSchema>

export interface AggregatedScores {
  overall: number
  text_completeness: number
  text_accuracy: number
  tree_structure: number
  type_accuracy: number
  image_placement: number
  reading_order: number
}

const JUDGE_SYSTEM = `You are an expert evaluator of book page content structuring. You will be shown:
1. A page image from a book
2. The extracted text for that page
3. A structured content tree produced by an automated system
4. The configured node types

Your task is to evaluate how well the structured tree captures the page content. Score each dimension from 1 (terrible) to 10 (perfect).

## Node Model

The tree uses a two-field model:
- **Container nodes** have a \`structure\` field (how content is grouped) and \`children\`. They may also have an \`image_id\` (e.g., "image" containers for content images, or other containers for background images).
- **Leaf nodes** have a \`role\` field (what the content means) and \`text\`.
- A node never has both \`structure\` and \`role\`.

## Scoring Dimensions

- **text_completeness**: Does the tree capture ALL provided text? Every line of input text must appear in a leaf node. Missing text is the most critical failure.
- **text_accuracy**: Does the extracted text match what's on the page image? Check for errors, hallucinated text, or garbled content.
- **tree_structure**: Does the hierarchy make semantic sense? Are containers used appropriately? Is nesting depth reasonable? Are images represented as "image" containers with \`image_id\`?
- **type_accuracy**: Are the correct \`structure\` values on containers and correct \`role\` values on leaves? Check against the configured types provided.
- **image_placement**: Are images placed at the correct position in the reading flow? Are all available images accounted for?
- **reading_order**: Does the content follow the correct reading order (left-to-right, top-to-bottom, respecting columns)?

## Guidelines

- Be strict but fair. A score of 7 means "good with minor issues". A score of 5 means "significant problems". Below 5 means "major failures".
- The overall_score should reflect the weighted importance: text completeness and accuracy are most critical, followed by type accuracy and structure.
- List specific issues found, categorized by type and severity.
- In suggestions, describe what could be improved in the prompt or type definitions to address the issues found.
- **Text granularity**: Text should be broken at sentence boundaries — each sentence or logical unit should be its own leaf node. Do NOT penalize fine-grained splitting. DO penalize combining multiple sentences into a single leaf node, as downstream processing (TTS, translation) requires sentence-level granularity.
- **Spreads**: The page image may show a two-page spread. The tree should capture ALL visible content from the image, even if it spans two pages. Do NOT penalize for including content from both pages of a spread.
- **Text corrections**: The structurer is instructed to correct extraction errors when the page image clearly shows different text. Do NOT penalize for text that differs from the extracted input if the corrected text matches the page image.
- **Visual separators**: Lines of dashes, asterisks, underscores, or similar characters that serve as visual dividers or section breaks are decorative and should be omitted. Do NOT penalize for missing separator text.
- **Text within images**: When an image contains readable text, it should be placed as children of the "image" container. Do NOT penalize for this structural pattern.
- **Image containers**: Images are represented as containers with \`structure: "image"\` and \`image_id\`. They may have no children (standalone images) or children (captions, labels, embedded text). Do NOT penalize childless image containers.`

/**
 * Strip post-processing fields (nodeId, isPruned) from structuring output
 * so the judge only evaluates what the LLM actually produced.
 */
function stripPostProcessingFields(nodes: ContentNodeData[]): unknown[] {
  return nodes.map((node) => {
    const clean: Record<string, unknown> = {}
    if (node.structure != null) clean.structure = node.structure
    if (node.role != null) clean.role = node.role
    if (node.text != null) clean.text = node.text
    if (node.imageId != null) clean.image_id = node.imageId
    if (node.children) clean.children = stripPostProcessingFields(node.children)
    return clean
  })
}

export async function judgePage(
  page: PageInput,
  structuringResult: PageStructuringOutput,
  config: { textTypes: TypeDef[]; containerTypes: TypeDef[] },
  llmModel: LLMModel
): Promise<PageEvaluation> {
  const userContent: ContentPart[] = [
    {
      type: "text",
      text: `Evaluate the structured content tree for this page.

## Configured Types

Container types (map to \`structure\` field on container nodes): ${config.containerTypes.map((t) => `${t.key} (${t.description})`).join(", ")}

Text types (map to \`role\` field on text leaf nodes): ${config.textTypes.map((t) => `${t.key} (${t.description})`).join(", ")}

## Extracted Text

${page.text}

## Structuring Result

${JSON.stringify({ reasoning: structuringResult.reasoning, nodes: stripPostProcessingFields(structuringResult.nodes) }, null, 2)}

## Page Image`,
    },
    { type: "image", image: page.imageBase64 },
  ]

  const messages: Message[] = [{ role: "user", content: userContent }]

  const result = await llmModel.generateObject<PageEvaluation>({
    schema: PageEvaluationSchema,
    system: JUDGE_SYSTEM,
    messages,
    maxTokens: JUDGE_MAX_TOKENS,
    log: {
      taskType: "eval-judge",
      pageId: page.pageId,
      promptName: "eval-judge",
    },
  })

  return result.object
}

export function aggregateScores(
  evaluations: Array<{ pageId: string; evaluation: PageEvaluation }>
): AggregatedScores {
  if (evaluations.length === 0) {
    return {
      overall: 0,
      text_completeness: 0,
      text_accuracy: 0,
      tree_structure: 0,
      type_accuracy: 0,
      image_placement: 0,
      reading_order: 0,
    }
  }

  const n = evaluations.length
  const sum = (fn: (e: PageEvaluation) => number) =>
    evaluations.reduce((acc, { evaluation }) => acc + fn(evaluation), 0) / n

  return {
    overall: sum((e) => e.overall_score),
    text_completeness: sum((e) => e.scores.text_completeness),
    text_accuracy: sum((e) => e.scores.text_accuracy),
    tree_structure: sum((e) => e.scores.tree_structure),
    type_accuracy: sum((e) => e.scores.type_accuracy),
    image_placement: sum((e) => e.scores.image_placement),
    reading_order: sum((e) => e.scores.reading_order),
  }
}
