import type { SectionRendering } from "@adt/types"
import { webRenderingLLMSchema, activityAnswersLLMSchema } from "@adt/types"
import type { LLMModel, ValidationResult } from "@adt/llm"
import { validateSectionHtml } from "./validate-html.js"
import { getViewportBreakpoints, type ScreenshotRenderer } from "./screenshot.js"
import type { RenderConfig, RenderSectionInput, ImageInput, SectionPart } from "./web-rendering.js"
import { runVisualReviewLoop } from "./visual-review.js"

/** Dependencies for the optional visual refinement loop. */
export interface VisualRefinementDeps {
  screenshotRenderer: ScreenshotRenderer
  webAssetsDir: string
  /** Resolve an LLM model for visual review (may differ from the generation model). */
  llmModel: LLMModel
  /** Persist a screenshot (base64 PNG) so it can be resolved in the LLM log UI. */
  storeScreenshot?: (base64: string) => void
}

/**
 * Render a single section as HTML using an LLM.
 * Handles both regular "llm" and "activity" render types.
 *
 * For activity sections (config.renderType === "activity"):
 * - Validation allows activity_gen_* prefixed data-ids
 * - If config.answerPromptName is set, a second LLM call generates correct answers
 */
/** Recursively collect all images from parts (including nested groups). */
function collectImages(parts: SectionPart[]): ImageInput[] {
  const result: ImageInput[] = []
  for (const part of parts) {
    if (part.type === "image") result.push({ imageId: part.imageId, imageBase64: part.imageBase64, width: part.width, height: part.height })
    else if (part.type === "nested_group") result.push(...collectImages(part.parts))
  }
  return result
}

type OrderedPart =
  | { part_type: "text_group"; group_id: string; group_type: string; texts: Array<{ text_id: string; text_type: string; text: string }> }
  | { part_type: "image"; image_id: string; image_base64: string; width?: number; height?: number }
  | { part_type: "group"; group_id: string; group_type: string; parts: OrderedPart[]; answer?: string; reasoning?: string }

/** Build an image lookup map from parts (including nested groups). */
function buildImageLookup(parts: SectionPart[]): Map<string, { base64: string; width?: number; height?: number }> {
  const map = new Map<string, { base64: string; width?: number; height?: number }>()
  for (const part of parts) {
    if (part.type === "image") {
      map.set(part.imageId, { base64: part.imageBase64, width: part.width, height: part.height })
    } else if (part.type === "nested_group") {
      for (const [k, v] of buildImageLookup(part.parts)) map.set(k, v)
    }
  }
  return map
}

/** Recursively build ordered parts preserving nested group structure for the LLM prompt. */
function buildOrderedParts(parts: SectionPart[], imgLookup: Map<string, { base64: string; width?: number; height?: number }>): OrderedPart[] {
  const result: OrderedPart[] = []
  for (const part of parts) {
    if (part.type === "group") {
      result.push({
        part_type: "text_group",
        group_id: part.groupId,
        group_type: part.groupType,
        texts: part.texts.map((t) => ({
          text_id: t.textId,
          text_type: t.textType,
          text: t.text,
        })),
      })
    } else if (part.type === "image") {
      result.push({
        part_type: "image",
        image_id: part.imageId,
        image_base64: part.imageBase64,
        ...(part.width != null ? { width: part.width } : {}),
        ...(part.height != null ? { height: part.height } : {}),
      })
    } else if (part.type === "nested_group") {
      result.push({
        part_type: "group",
        group_id: part.groupId,
        group_type: part.groupType,
        parts: buildOrderedParts(part.parts, imgLookup),
        ...(part.answer ? { answer: part.answer } : {}),
        ...(part.reasoning ? { reasoning: part.reasoning } : {}),
      })
    }
  }
  return result
}

export async function renderSectionLlm(
  input: RenderSectionInput,
  config: RenderConfig,
  llmModel: LLMModel,
  visualRefinement?: VisualRefinementDeps,
): Promise<SectionRendering> {
  const images = collectImages(input.parts)

  const isActivity = config.renderType === "activity"
  const taskType = isActivity ? "activity-rendering" : "web-rendering"

  // Build ordered parts — the canonical representation for all prompts.
  // Preserves document flow and nested group structure (option_group → option → text).
  const imgLookup = buildImageLookup(input.parts)
  const orderedParts = buildOrderedParts(input.parts, imgLookup)

  const context = {
    label: input.label,
    page_image_base64: input.pageImageBase64,
    section_id: input.sectionId,
    section_type: input.sectionType,
    ordered_parts: orderedParts,
    styleguide: input.styleguide ?? "",
    viewports: getViewportBreakpoints(),
    _isActivity: isActivity,
    user_instructions: input.userPrompt ?? "",
  }

  const result = await llmModel.generateObject<{
    reasoning: string
    content: string
  }>({
    schema: webRenderingLLMSchema,
    prompt: config.promptName,
    context,
    validate: validateWebRendering,
    maxRetries: config.maxRetries,
    maxTokens: 16384,
    temperature: config.temperature,
    timeoutMs: config.timeoutMs,
    log: {
      taskType,
      pageId: input.pageId,
      promptName: config.promptName,
    },
  })

  let generatedHtml = result.object.content

  // Optional: visual refinement loop — screenshot the HTML and ask an LLM to review
  if (visualRefinement && config.visualRefinement?.enabled) {
    const vr = config.visualRefinement
    const imagesForScreenshot = new Map<string, { base64: string }>()
    for (const img of images) {
      imagesForScreenshot.set(img.imageId, { base64: img.imageBase64 })
    }

    const review = await runVisualReviewLoop({
      initialHtml: generatedHtml,
      label: input.label,
      pageId: input.pageId,
      images: imagesForScreenshot,
      deps: {
        llmModel: visualRefinement.llmModel,
        screenshotRenderer: visualRefinement.screenshotRenderer,
        webAssetsDir: visualRefinement.webAssetsDir,
        storeScreenshot: visualRefinement.storeScreenshot,
      },
      promptName: vr.promptName,
      maxIterations: vr.maxIterations,
      timeoutMs: vr.timeoutMs,
      temperature: vr.temperature,
      pageImageBase64: input.pageImageBase64,
      promptContext: {
        page_image_base64: input.pageImageBase64,
        section_type: input.sectionType,
        current_html: generatedHtml,
      },
      originalImageIntroText: "Here is the original page image (this is what the rendered page should resemble):",
      firstIterationScreenshotsText: "\nHere are screenshots of the current rendered HTML at three viewport sizes:\n",
      nextIterationScreenshotsText: "Here are the updated screenshots after your revision:\n",
      trailingContextText: `Section type: ${input.sectionType}`,
      validateHtml: (candidateHtml) => {
        const check = validateWebRendering(
          { reasoning: "visual-review", content: candidateHtml },
          context
        )
        if (!check.valid) return { valid: false, errors: check.errors }
        const cleaned = check.cleaned as { reasoning: string; content: string } | undefined
        return { valid: true, errors: [], cleanedHtml: cleaned?.content }
      },
    })
    generatedHtml = review.html
  }

  // Optional: generate activity answers via a second LLM call
  let activityReasoning: string | undefined
  let activityAnswers: Record<string, string | boolean | number> | undefined

  if (isActivity && config.answerPromptName) {
    const answersResult = await llmModel.generateObject<{
      reasoning: string
      answers: Array<{ id: string; value: string | boolean | number }>
    }>({
      schema: activityAnswersLLMSchema,
      prompt: config.answerPromptName,
      context: {
        ...context,
        activity_html: generatedHtml,
      },
      maxRetries: config.maxRetries,
      maxTokens: 4096,
      temperature: config.temperature,
      timeoutMs: config.timeoutMs,
      log: {
        taskType: "activity-answers",
        pageId: input.pageId,
        promptName: config.answerPromptName,
      },
    })
    activityReasoning = answersResult.object.reasoning
    // Convert array of {id, value} to record for storage
    activityAnswers = Object.fromEntries(
      answersResult.object.answers.map((a) => [a.id, a.value])
    )
  }

  return {
    sectionIndex: input.sectionIndex,
    sectionType: input.sectionType,
    reasoning: result.object.reasoning,
    html: generatedHtml,
    ...(activityReasoning !== undefined && { activityReasoning }),
    ...(activityAnswers !== undefined && { activityAnswers }),
  }
}

/** Recursively collect text and image info from ordered parts for validation. */
function collectValidationIds(
  parts: OrderedPart[],
  textIds: string[],
  imageIds: string[],
  textMap: Map<string, string>,
): void {
  for (const part of parts) {
    if (part.part_type === "text_group") {
      for (const t of part.texts) {
        textIds.push(t.text_id)
        textMap.set(t.text_id, t.text)
      }
    } else if (part.part_type === "image") {
      imageIds.push(part.image_id)
    } else if (part.part_type === "group") {
      collectValidationIds(part.parts, textIds, imageIds, textMap)
    }
  }
}

function validateWebRendering(
  result: unknown,
  context: Record<string, unknown>
): ValidationResult {
  const r = result as { reasoning: string; content: string }
  const label = context.label as string
  const parts = context.ordered_parts as OrderedPart[]
  const isActivity = context._isActivity as boolean | undefined
  const sectionId = context.section_id as string
  const sectionType = context.section_type as string

  const allowedTextIds: string[] = []
  const allowedImageIds: string[] = []
  const expectedTexts = new Map<string, string>()
  collectValidationIds(parts, allowedTextIds, allowedImageIds, expectedTexts)

  const imageUrlPrefix = `/api/books/${label}/images`

  const check = validateSectionHtml(
    r.content,
    allowedTextIds,
    allowedImageIds,
    imageUrlPrefix,
    {
      ...(isActivity && { allowActivityGeneratedIds: true }),
      expectedTexts,
      expectedSectionType: sectionType,
      expectedSectionId: sectionId,
    }
  )
  if (check.valid && check.sectionHtml) {
    return {
      valid: true,
      errors: [],
      cleaned: { reasoning: r.reasoning, content: check.sectionHtml },
    }
  }
  return { valid: check.valid, errors: check.errors }
}
