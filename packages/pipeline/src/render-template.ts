import { Liquid } from "liquidjs"
import type { SectionRendering } from "@adt/types"
import { validateSectionHtml } from "./validate-html.js"
import type { RenderConfig, RenderSectionInput } from "./web-rendering.js"

export interface TemplateEngine {
  render(templateName: string, context: Record<string, unknown>): Promise<string>
}

/**
 * Create a template engine that renders Liquid templates from a directory.
 * Plain Liquid — no custom tags (unlike the prompt engine).
 */
export function createTemplateEngine(templatesDir: string): TemplateEngine {
  const liquid = new Liquid({
    root: [templatesDir],
    extname: ".liquid",
    strictVariables: false,
  })

  return {
    async render(
      templateName: string,
      context: Record<string, unknown>
    ): Promise<string> {
      return liquid.renderFile(templateName, context)
    },
  }
}

/**
 * Render a single section using a Liquid template.
 * Deterministic — no LLM call, no retries. If validation fails, throws.
 */
export async function renderSectionTemplate(
  input: RenderSectionInput,
  config: RenderConfig,
  templateEngine: TemplateEngine
): Promise<SectionRendering> {
  const imageUrlPrefix = `/api/books/${input.label}/images`
  const { section, context: renderContext } = input

  const templateContext: Record<string, unknown> = {
    section_id: section.sectionId,
    section_type: section.sectionType,
    background_color: section.backgroundColor,
    text_color: section.textColor,
    label: input.label,
    image_url_prefix: imageUrlPrefix,
    nodes: renderContext.nodes,
    leaf_texts: renderContext.leaf_texts,
    image_refs: renderContext.image_refs,
    group_ids: renderContext.group_ids,
  }

  const html = await templateEngine.render(config.templateName, templateContext)

  // Validate the template output using the same validator as LLM output
  const allowedTextIds = renderContext.leaf_texts.map((t) => t.text_id)
  const allowedImageIds = renderContext.image_refs.map((i) => i.image_id)
  const expectedTexts = new Map(
    renderContext.leaf_texts.map((t) => [t.text_id, t.text])
  )

  const check = validateSectionHtml(
    html,
    allowedTextIds,
    allowedImageIds,
    imageUrlPrefix,
    {
      allowedContainerIds: renderContext.group_ids,
      expectedTexts,
      expectedSectionType: section.sectionType,
      expectedSectionId: section.sectionId,
    }
  )
  if (!check.valid) {
    throw new Error(
      `Template "${config.templateName}" produced invalid HTML: ${check.errors.join("; ")}`
    )
  }

  return {
    sectionIndex: input.sectionIndex,
    sectionType: section.sectionType,
    reasoning: "template-based rendering",
    html: check.sectionHtml ?? html,
  }
}
