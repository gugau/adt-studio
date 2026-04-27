/**
 * Generate desktop screenshots for individual sections, sized for the sidebar
 * thumbnail and reusable in app navigation / quiz cards.
 *
 * The renderer is reused by callers, which control its lifecycle; this module
 * just builds the screenshot HTML and asks Playwright for one PNG per section.
 */
import type { WebRenderingOutput } from "@adt/types"
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
