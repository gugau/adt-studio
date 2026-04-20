/**
 * Fixed-Layout Rendering
 *
 * Produces fixed-layout HTML pages for illustrated storybooks. Uses
 * extracted illustration images as backgrounds with visible, styled
 * positioned text from mupdf's asHTML() output.
 *
 * Output follows the same PageSectioningOutput / WebRenderingOutput format
 * as the reflowable pipeline, so downstream steps (text-catalog, TTS,
 * packageAdtWeb) work unchanged.
 */

import { PNG } from "pngjs"
import type { Storage } from "@adt/storage"
import type {
  PageSectioningOutput,
  WebRenderingOutput,
  PositionedTextOutput,
} from "@adt/types"

// ── Background Sampling & Contrast ────────────────────────────────

interface RGB { r: number; g: number; b: number }

export interface BackgroundSampler {
  /** Sample average RGB color in a region (render pixel coordinates). */
  sample(x: number, y: number, width: number, height: number): RGB
}

/**
 * Create a background sampler from a PNG image buffer.
 * Returns null if the buffer can't be decoded.
 */
export function createBackgroundSampler(pngBuffer: Buffer): BackgroundSampler | null {
  try {
    const png = PNG.sync.read(pngBuffer)
    const { data, width, height } = png
    return {
      sample(rx: number, ry: number, rw: number, rh: number): RGB {
        // Clamp region to image bounds
        const x0 = Math.max(0, Math.min(Math.round(rx), width - 1))
        const y0 = Math.max(0, Math.min(Math.round(ry), height - 1))
        const x1 = Math.max(x0 + 1, Math.min(Math.round(rx + rw), width))
        const y1 = Math.max(y0 + 1, Math.min(Math.round(ry + rh), height))

        let totalR = 0, totalG = 0, totalB = 0, count = 0
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const idx = (y * width + x) * 4
            totalR += data[idx]
            totalG += data[idx + 1]
            totalB += data[idx + 2]
            count++
          }
        }

        if (count === 0) return { r: 255, g: 255, b: 255 }
        return {
          r: Math.round(totalR / count),
          g: Math.round(totalG / count),
          b: Math.round(totalB / count),
        }
      },
    }
  } catch {
    return null
  }
}

/** sRGB → linear channel conversion */
function linearize(srgb: number): number {
  const c = srgb / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** WCAG relative luminance */
function relativeLuminance(c: RGB): number {
  return 0.2126 * linearize(c.r) + 0.7152 * linearize(c.g) + 0.0722 * linearize(c.b)
}

/** WCAG contrast ratio (always ≥ 1) */
export function contrastRatio(c1: RGB, c2: RGB): number {
  const l1 = relativeLuminance(c1)
  const l2 = relativeLuminance(c2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function parseHexColor(hex: string): RGB {
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  }
}

/**
 * Add text-stroke to spans whose color has insufficient contrast against
 * the sampled background. Only modifies spans below the WCAG AA large-text
 * threshold (3:1). Stroke color and width adapt to background luminance
 * and font size.
 */
export function addContrastStrokes(
  html: string,
  bgColor: RGB,
  lineHeight: number,
): string {
  const bgLum = relativeLuminance(bgColor)
  return html.replace(/color:#([0-9a-f]{6})/gi, (match, hex: string) => {
    const textColor = parseHexColor(hex)
    if (contrastRatio(textColor, bgColor) >= 3.0) return match

    // Stroke in the opposite luminance direction from background
    const strokeColor = bgLum > 0.5
      ? "rgba(0,0,0,0.6)"
      : "rgba(255,255,255,0.6)"
    const strokeWidth = Math.max(1, Math.round(lineHeight * 0.06))
    return `${match};-webkit-text-stroke:${strokeWidth}px ${strokeColor};paint-order:stroke fill`
  })
}

// ── Fixed-Layout Page Sectioning ───────────────────────────────────

/**
 * Produce a simplified PageSectioningOutput for a fixed-layout page.
 * One section per page — references the background image.
 */
export function sectionFixedLayoutPage(
  pageId: string,
  pageNumber: number,
  imageIds: string[],
): PageSectioningOutput {
  const parts = imageIds.map((imageId) => ({
    type: "image" as const,
    imageId,
    isPruned: false,
  }))

  return {
    reasoning: "Fixed-layout mode: entire page is a single section with illustration images as content.",
    sections: [
      {
        sectionId: `${pageId}_sec001`,
        sectionType: "fixed-layout-page",
        parts,
        backgroundColor: "#ffffff",
        textColor: "#000000",
        pageNumber,
        isPruned: false,
      },
    ],
  }
}

// ── Fixed-Layout Web Rendering ─────────────────────────────────────

/**
 * Produce fixed-layout HTML for a page: illustration image as background
 * with positioned text paragraphs from mupdf's asHTML() output.
 *
 * Text paragraphs get `data-id` attributes so text-catalog can pick them up
 * for TTS and translation, matching the reflowable pipeline pattern.
 */
export function renderFixedLayoutPage(
  pageId: string,
  positionedText: PositionedTextOutput,
  images: Array<{ imageId: string; url: string; bounds?: { x: number; y: number; width: number; height: number } }>,
  pageNumber: number,
  viewport: { width: number; height: number },
  options?: { transparentText?: boolean; backgroundSampler?: BackgroundSampler },
): WebRenderingOutput {
  const { renderWidth, renderHeight, pageWidth, pageHeight, paragraphs } = positionedText
  const transparentText = options?.transparentText ?? false
  const sampler = options?.backgroundSampler

  // Scale factor from render-pixel positions (2x) to viewport coordinates.
  // When viewport = page dimensions (1x), posScale = 0.5 — images get 2x density.
  // When viewport = render dimensions (2x), posScale = 1 — positions are 1:1.
  const posScale = viewport.width / renderWidth
  // Font sizes from asHTML are in PDF points → scale to viewport pixels.
  const fontScale = viewport.height / pageHeight

  // Build image elements — position each at its actual location on the page
  const imageElements: string[] = []
  for (const img of images) {
    if (img.bounds) {
      // Bounds are in render-pixel space (from findImageBounds) — scale to viewport
      const imgLeft = Math.round(img.bounds.x * posScale)
      const imgTop = Math.round(img.bounds.y * posScale)
      const imgWidth = Math.round(img.bounds.width * posScale)
      const imgHeight = Math.round(img.bounds.height * posScale)
      imageElements.push(
        `  <img src="${escapeHtml(img.url)}" alt="" data-id="${img.imageId}" style="position:absolute;top:${imgTop}px;left:${imgLeft}px;width:${imgWidth}px;height:${imgHeight}px"/>`)
    } else {
      // No bounds data — fill the viewport (page render or fallback)
      imageElements.push(
        `  <img src="${escapeHtml(img.url)}" alt="" data-id="${img.imageId}" style="position:absolute;top:0;left:0;width:100%;height:100%"/>`)
    }
  }

  // Build positioned paragraphs with data-id for TTS
  // Text positions are in render pixels — scale to viewport coordinates.
  const paragraphElements: string[] = []
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]
    const dataId = `${pageId}_p${String(i).padStart(3, "0")}`
    const top = Math.round(p.top * posScale)
    const left = Math.round(p.left * posScale)
    const lh = Math.round(p.lineHeight * posScale)

    const style = transparentText
      ? `position:absolute;top:${top}px;left:${left}px;line-height:${lh}px;color:transparent;overflow:hidden;pointer-events:auto`
      : `position:absolute;top:${top}px;left:${left}px;line-height:${lh}px;pointer-events:auto`

    // Scale font sizes within the HTML spans (pt → viewport px)
    let scaledHtml = scaleFontSizes(p.html, fontScale)

    // Add contrast-enhancing strokes for text with poor visibility against background
    if (sampler && !transparentText) {
      // Sample at render-pixel coords (sampler uses the original image)
      const bgColor = sampler.sample(p.left, p.top, p.lineHeight * 3, p.lineHeight)
      scaledHtml = addContrastStrokes(scaledHtml, bgColor, lh)
    }

    paragraphElements.push(
      `    <p data-id="${dataId}" style="${style}">${scaledHtml}</p>`)
  }

  const html = `<div id="content" style="position:relative;width:${viewport.width}px;height:${viewport.height}px;margin:0 auto;overflow:hidden">
${imageElements.join("\n")}
  <div class="text-overlay" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none">
${paragraphElements.join("\n")}
  </div>
</div>`

  return {
    sections: [
      {
        sectionIndex: 0,
        sectionType: "fixed-layout-page",
        reasoning: "Fixed-layout: illustration image with positioned text from PDF.",
        html,
      },
    ],
  }
}

// ── Batch Processing ───────────────────────────────────────────────

/**
 * Run fixed-layout sectioning + rendering for all pages.
 * Stores results using the same node names as the reflowable pipeline.
 */
export function processFixedLayoutPages(
  storage: Storage,
  imageUrlPrefix: string,
): void {
  const pages = storage.getPages()

  for (const page of pages) {
    // Get all images for this page
    const allImages = storage.getPageImages(page.pageId)
    const pageRender = allImages.find((img) => img.imageId.endsWith("_page"))
    const extractedImages = allImages.filter((img) => !img.imageId.endsWith("_page"))

    // Use the largest extracted image as the background illustration,
    // but only if it covers a significant portion of the page.
    // Small extracted images (logos, icons) aren't suitable backgrounds.
    const pageRenderArea = pageRender ? pageRender.width * pageRender.height : 0
    const largestExtracted = extractedImages.length > 0
      ? extractedImages.reduce((best, img) =>
          img.width * img.height > best.width * best.height ? img : best)
      : null
    const largestArea = largestExtracted ? largestExtracted.width * largestExtracted.height : 0
    const usePageRender = !largestExtracted || largestArea < pageRenderArea * 0.25

    const backgroundImage = usePageRender && pageRender ? pageRender : largestExtracted!
    const imageIds = [backgroundImage.imageId]

    // Store simplified sectioning
    const sectioning = sectionFixedLayoutPage(page.pageId, page.pageNumber, imageIds)
    storage.putNodeData("page-sectioning", page.pageId, sectioning)

    // Read positioned text (must have been extracted in extract stage)
    const posTextRow = storage.getLatestNodeData("positioned-text-extraction", page.pageId)
    if (!posTextRow) {
      // If no positioned text, create image-only page
      const html = `<div id="content" style="position:relative;width:100%;margin:0 auto">
  <img src="${escapeHtml(imageUrlPrefix)}/${backgroundImage.imageId}" alt="Page ${page.pageNumber}" data-id="${backgroundImage.imageId}" style="width:100%;height:auto"/>
</div>`
      storage.putNodeData("web-rendering", page.pageId, {
        sections: [{
          sectionIndex: 0,
          sectionType: "fixed-layout-page",
          reasoning: "Fixed-layout: image-only page (no positioned text data).",
          html,
        }],
      })
      continue
    }

    const positionedText = posTextRow.data as PositionedTextOutput

    // Find image bounds from positioned text extraction data
    const matchedBounds = usePageRender
      ? undefined // page render fills the entire viewport
      : findImageBounds(backgroundImage, positionedText)
    const images = [{
      imageId: backgroundImage.imageId,
      url: `${imageUrlPrefix}/${backgroundImage.imageId}`,
      bounds: matchedBounds,
    }]

    // Viewport = page dimensions (1x) — images at render scale provide 2x density
    const viewport = {
      width: Math.round(positionedText.pageWidth),
      height: Math.round(positionedText.pageHeight),
    }

    // Create background sampler from illustration image for contrast checking.
    // Uses the illustration (no text baked in) rather than the page render
    // to avoid text pixels skewing the background color average.
    // Only needed when text is visible (not transparent).
    let backgroundSampler: BackgroundSampler | undefined
    if (!usePageRender && matchedBounds) {
      try {
        const imgBase64 = storage.getImageBase64(backgroundImage.imageId)
        const imgBuffer = Buffer.from(imgBase64, "base64")
        const rawSampler = createBackgroundSampler(imgBuffer)
        if (rawSampler) {
          // Map viewport coordinates to illustration image coordinates
          const imgW = backgroundImage.width
          const imgH = backgroundImage.height
          const bx = matchedBounds.x, by = matchedBounds.y
          const bw = matchedBounds.width, bh = matchedBounds.height
          backgroundSampler = {
            sample(rx, ry, rw, rh) {
              // Convert viewport coords to illustration pixel coords
              const ix = (rx - bx) * (imgW / bw)
              const iy = (ry - by) * (imgH / bh)
              const iw = rw * (imgW / bw)
              const ih = rh * (imgH / bh)
              // If outside illustration bounds, assume white page background
              if (ix + iw < 0 || iy + ih < 0 || ix > imgW || iy > imgH) {
                return { r: 255, g: 255, b: 255 }
              }
              return rawSampler.sample(ix, iy, iw, ih)
            },
          }
        }
      } catch {
        // Illustration image not available — skip contrast checking
      }
    }

    const rendering = renderFixedLayoutPage(
      page.pageId,
      positionedText,
      images,
      page.pageNumber,
      viewport,
      { transparentText: usePageRender, backgroundSampler },
    )
    storage.putNodeData("web-rendering", page.pageId, rendering)
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Compute the bounding box for the background illustration image.
 *
 * Takes the union of all "large" image bounds (those covering >25% of the
 * page area). This correctly handles both single-page illustrations and
 * spread images (which are the union of two full-page images).
 * Small images (icons, inset drawings) are excluded.
 *
 * Returns bounds in render-pixel space (PDF points × renderScale).
 */
function findImageBounds(
  _image: { imageId: string; width: number; height: number },
  positionedText: PositionedTextOutput,
): { x: number; y: number; width: number; height: number } | undefined {
  const bounds = positionedText.imageBounds
  if (!bounds || bounds.length === 0) return undefined

  const renderScale = positionedText.renderWidth / positionedText.pageWidth
  const pageArea = positionedText.pageWidth * positionedText.pageHeight

  // Keep only large images (>25% of page area)
  const large = bounds.filter((b) => b.width * b.height > pageArea * 0.25)
  if (large.length === 0) return undefined

  // Compute the union bounding box of all large images
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const b of large) {
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.width)
    maxY = Math.max(maxY, b.y + b.height)
  }

  return {
    x: Math.round(minX * renderScale),
    y: Math.round(minY * renderScale),
    width: Math.round((maxX - minX) * renderScale),
    height: Math.round((maxY - minY) * renderScale),
  }
}

/** Scale font-size values in HTML span styles from pt to px. */
function scaleFontSizes(html: string, fontScale: number): string {
  return html.replace(/font-size:([\d.]+)pt/g, (_match, sizePt) => {
    const px = Math.round(parseFloat(sizePt) * fontScale)
    return `font-size:${px}px`
  })
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
