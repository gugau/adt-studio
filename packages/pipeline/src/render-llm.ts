import type { SectionRendering } from "@adt/types"
import { webRenderingLLMSchema, activityAnswersLLMSchema } from "@adt/types"
import type { LLMModel, ValidationResult } from "@adt/llm"
import { validateSectionHtml } from "./validate-html.js"
import { getViewportBreakpoints, type ScreenshotRenderer } from "./screenshot.js"
import type { RenderConfig, RenderSectionInput } from "./web-rendering.js"
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
export async function renderSectionLlm(
  input: RenderSectionInput,
  config: RenderConfig,
  llmModel: LLMModel,
  visualRefinement?: VisualRefinementDeps,
): Promise<SectionRendering> {
  const isActivity = config.renderType === "activity"
  const taskType = isActivity ? "activity-rendering" : "web-rendering"
  const { section, context: renderContext } = input

  const promptContext = {
    label: input.label,
    page_image_base64: input.pageImageBase64,
    section_id: section.sectionId,
    section_type: section.sectionType,
    nodes: renderContext.nodes,
    leaf_texts: renderContext.leaf_texts,
    images: renderContext.image_refs,
    group_ids: renderContext.group_ids,
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
    context: promptContext,
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
    for (const img of renderContext.image_refs) {
      if (img.image_base64) {
        imagesForScreenshot.set(img.image_id, { base64: img.image_base64 })
      }
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
        section_type: section.sectionType,
        current_html: generatedHtml,
        nodes: renderContext.nodes,
        leaf_texts: renderContext.leaf_texts,
      },
      originalImageIntroText: "Here is the original page image (this is what the rendered page should resemble):",
      firstIterationScreenshotsText: "\nHere are screenshots of the current rendered HTML at three viewport sizes:\n",
      nextIterationScreenshotsText: "Here are the updated screenshots after your revision:\n",
      trailingContextText: `Section type: ${section.sectionType}`,
      validateHtml: (candidateHtml) => {
        const check = validateWebRendering(
          { reasoning: "visual-review", content: candidateHtml },
          promptContext
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
        ...promptContext,
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
    sectionType: section.sectionType,
    reasoning: result.object.reasoning,
    html: generatedHtml,
    ...(activityReasoning !== undefined && { activityReasoning }),
    ...(activityAnswers !== undefined && { activityAnswers }),
  }
}

function validateWebRendering(
  result: unknown,
  context: Record<string, unknown>
): ValidationResult {
  const r = result as { reasoning: string; content: string }
  const label = context.label as string
  const leaf_texts = context.leaf_texts as Array<{ text_id: string; text: string }>
  const images = context.images as Array<{ image_id: string }>
  const group_ids = context.group_ids as string[]
  const isActivity = context._isActivity as boolean | undefined
  const sectionId = context.section_id as string
  const sectionType = context.section_type as string
  const allowedTextIds = leaf_texts.map((t) => t.text_id)
  const allowedImageIds = images.map((img) => img.image_id)
  const imageUrlPrefix = `/api/books/${label}/images`
  const expectedTexts = new Map(leaf_texts.map((t) => [t.text_id, t.text]))

  const check = validateSectionHtml(
    r.content,
    allowedTextIds,
    allowedImageIds,
    imageUrlPrefix,
    {
      ...(isActivity && { allowActivityGeneratedIds: true }),
      allowedContainerIds: group_ids,
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
