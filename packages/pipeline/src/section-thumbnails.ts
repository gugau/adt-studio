/**
 * Generate desktop screenshots for individual sections, sized for the sidebar
 * thumbnail and reusable in app navigation / quiz cards.
 *
 * The renderer is reused by callers, which control its lifecycle; this module
 * just builds the screenshot HTML and asks Playwright for one PNG per section.
 */
import type { Quiz, TextCatalogOutput, WebRenderingOutput } from "@adt/types"
import { renderQuizHtml } from "./package-web.js"
import { buildScreenshotHtml } from "./screenshot-html.js"
import type { ScreenshotRenderer } from "./screenshot.js"

/** Desktop viewport used for thumbnails. Matches the visual-review desktop viewport. */
export const THUMBNAIL_VIEWPORT = { width: 1280, height: 800 } as const

export interface SectionThumbnail {
  sectionId: string
  /** Base64-encoded PNG. */
  base64: string
}

export interface GenerateSectionThumbnailsOptions {
  rendering: WebRenderingOutput
  sectionIds: string[]
  label: string
  images: Map<string, { base64: string }>
  webAssetsDir: string
  screenshotRenderer: ScreenshotRenderer
}

/**
 * Render a desktop screenshot for each section in `rendering.sections`. The
 * caller provides the section IDs in order matching `sectionIndex`. Sections
 * without a matching ID (e.g. sectionIndex out of range) are skipped.
 */
export async function generateSectionThumbnails(
  options: GenerateSectionThumbnailsOptions
): Promise<SectionThumbnail[]> {
  const { rendering, sectionIds, label, images, webAssetsDir, screenshotRenderer } = options
  const out: SectionThumbnail[] = []
  for (const section of rendering.sections) {
    const sectionId = sectionIds[section.sectionIndex]
    if (!sectionId) continue
    const html = await buildScreenshotHtml({
      sectionHtml: section.html,
      label,
      images,
      webAssetsDir,
    })
    const base64 = await screenshotRenderer.screenshot(html, THUMBNAIL_VIEWPORT)
    out.push({ sectionId, base64 })
  }
  return out
}

export interface QuizThumbnail {
  /** Same `qzNNN` id used by adt-preview, also keys the .thumbnails file. */
  quizId: string
  /** Base64-encoded PNG. */
  base64: string
}

export interface GenerateQuizThumbnailsOptions {
  quizzes: Array<{ quiz: Quiz; quizId: string }>
  label: string
  catalog?: TextCatalogOutput
  webAssetsDir: string
  screenshotRenderer: ScreenshotRenderer
}

/**
 * Render a desktop thumbnail PNG for each quiz. The caller controls the
 * renderer lifecycle; the function calls renderQuizHtml + buildScreenshotHtml
 * so quizzes share the same screenshot path as section thumbnails.
 */
export async function generateQuizThumbnails(
  options: GenerateQuizThumbnailsOptions
): Promise<QuizThumbnail[]> {
  const { quizzes, label, catalog, webAssetsDir, screenshotRenderer } = options
  const out: QuizThumbnail[] = []
  for (const { quiz, quizId } of quizzes) {
    // renderQuizHtml emits `<div id="content" class="... opacity-0">` because
    // the runtime fades it in via JS. The screenshot renderer doesn't run that
    // script, so we strip opacity-0 to avoid blank thumbnails.
    const sectionHtml = renderQuizHtml(quiz, quizId, catalog).replace(
      /(<div\s+id="content"[^>]*\bclass="[^"]*?)\s*\bopacity-0\b/,
      "$1",
    )
    const html = await buildScreenshotHtml({
      sectionHtml,
      label,
      images: new Map(),
      webAssetsDir,
    })
    const base64 = await screenshotRenderer.screenshot(html, THUMBNAIL_VIEWPORT)
    out.push({ quizId, base64 })
  }
  return out
}
