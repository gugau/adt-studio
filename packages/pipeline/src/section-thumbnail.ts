import type { SectionRendering } from "@adt/types"
import { buildScreenshotHtml } from "./screenshot-html.js"
import type { ScreenshotRenderer } from "./screenshot.js"

export interface ThumbnailViewport {
  width: number
  height: number
}

export const DEFAULT_THUMBNAIL_VIEWPORT: ThumbnailViewport = { width: 800, height: 1040 }

export interface RenderSectionThumbnailInput {
  section: SectionRendering
  label: string
  images: Map<string, { base64: string }>
  webAssetsDir: string
  screenshotRenderer: ScreenshotRenderer
  language?: string
  viewport?: ThumbnailViewport
}

/**
 * Render a single section to a thumbnail PNG buffer.
 * Produces a fixed-viewport screenshot (no scrolling past viewport height)
 * so thumbnails stay small and consistent.
 */
export async function renderSectionThumbnail(
  input: RenderSectionThumbnailInput
): Promise<Buffer> {
  const {
    section,
    label,
    images,
    webAssetsDir,
    screenshotRenderer,
    language,
    viewport = DEFAULT_THUMBNAIL_VIEWPORT,
  } = input

  const html = await buildScreenshotHtml({
    sectionHtml: section.html,
    label,
    images,
    webAssetsDir,
    language,
  })

  const base64 = await screenshotRenderer.screenshot(html, viewport, { fullPage: false })
  return Buffer.from(base64, "base64")
}
