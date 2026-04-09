/**
 * Positioned Text Extraction
 *
 * Extracts positioned text from PDF pages using mupdf's StructuredText.asHTML()
 * which produces clean positioned HTML with font styling. This avoids the
 * character-level deduplication issues of the walk() API.
 *
 * The HTML is parsed to extract paragraph positions and spans, then augmented
 * with data-id attributes for TTS/accessibility integration.
 */

import mupdf, {
  type Document as MupdfDocument,
  type Rect,
} from "mupdf"

// ── Types ──────────────────────────────────────────────────────────

export interface PositionedParagraph {
  /** Top position in CSS pixels at render scale */
  top: number
  /** Left position in CSS pixels at render scale */
  left: number
  /** Line height in CSS pixels at render scale */
  lineHeight: number
  /** HTML content of the paragraph (spans with font styling) */
  html: string
}

/** Bounding box of an image on the page, in PDF points (top-left origin). */
export interface ImageBounds {
  /** Left edge in PDF points */
  x: number
  /** Top edge in PDF points */
  y: number
  /** Width in PDF points */
  width: number
  /** Height in PDF points */
  height: number
}

export interface PositionedTextOutput {
  /** Paragraphs with position and styled content */
  paragraphs: PositionedParagraph[]
  /** Page width in PDF points */
  pageWidth: number
  /** Page height in PDF points */
  pageHeight: number
  /** Rendered width in pixels (at render scale, typically 2x) */
  renderWidth: number
  /** Rendered height in pixels (at render scale, typically 2x) */
  renderHeight: number
  /** Bounding boxes of images on the page, in PDF points */
  imageBounds?: ImageBounds[]
}

/** Page info as stored in the pipeline storage. */
export interface PositionedTextPageInfo {
  pageId: string
  pageNumber: number
}

// ── High-Level API (for pipeline use) ──────────────────────────────

/**
 * Extract positioned text for all pages from a PDF buffer.
 *
 * Opens the PDF, iterates pages, and returns a map of pageId → output.
 * Handles spread detection (pageIds like "pg002003") automatically.
 */
export function extractAllPositionedText(
  pdfBuffer: Buffer,
  pages: PositionedTextPageInfo[],
  spreadMode?: boolean,
  renderScale = 2,
): Map<string, PositionedTextOutput> {
  const doc = mupdf.Document.openDocument(pdfBuffer, "application/pdf")
  const results = new Map<string, PositionedTextOutput>()

  for (const page of pages) {
    const isSpread = spreadMode && page.pageId.length > 5
    if (isSpread) {
      const nums = page.pageId.replace("pg", "")
      const leftNum = parseInt(nums.slice(0, nums.length / 2), 10)
      const rightNum = parseInt(nums.slice(nums.length / 2), 10)
      results.set(page.pageId, extractPositionedTextSpread(doc, leftNum - 1, rightNum - 1, renderScale))
    } else {
      results.set(page.pageId, extractPositionedText(doc, page.pageNumber - 1, renderScale))
    }
  }

  return results
}

// ── Low-Level API ──────────────────────────────────────────────────

/**
 * Extract positioned text from a single PDF page using asHTML().
 */
export function extractPositionedText(
  doc: MupdfDocument,
  pageIndex: number,
  renderScale = 2,
): PositionedTextOutput {
  const page = doc.loadPage(pageIndex)
  const bounds = page.getBounds() as Rect
  const pageWidth = bounds[2] - bounds[0]
  const pageHeight = bounds[3] - bounds[1]

  const stext = page.toStructuredText()
  const html = stext.asHTML(pageIndex)
  const paragraphs = parseAsHtml(html, renderScale)
  const imageBounds = extractImageBounds(page, bounds)

  return {
    paragraphs,
    pageWidth,
    pageHeight,
    renderWidth: Math.round(pageWidth * renderScale),
    renderHeight: Math.round(pageHeight * renderScale),
    imageBounds,
  }
}

/**
 * Extract positioned text from a two-page spread.
 *
 * Extracts both pages and offsets the right page's left-coordinates
 * by the left page's pixel width.
 */
export function extractPositionedTextSpread(
  doc: MupdfDocument,
  leftIndex: number,
  rightIndex: number,
  renderScale = 2,
): PositionedTextOutput {
  const leftPage = doc.loadPage(leftIndex)
  const rightPage = doc.loadPage(rightIndex)
  const leftBounds = leftPage.getBounds() as Rect
  const rightBounds = rightPage.getBounds() as Rect

  const leftWidth = leftBounds[2] - leftBounds[0]
  const leftHeight = leftBounds[3] - leftBounds[1]
  const rightWidth = rightBounds[2] - rightBounds[0]
  const rightHeight = rightBounds[3] - rightBounds[1]

  const spreadWidth = leftWidth + rightWidth
  const spreadHeight = Math.max(leftHeight, rightHeight)

  const leftStext = leftPage.toStructuredText()
  const rightStext = rightPage.toStructuredText()

  const leftHtml = leftStext.asHTML(leftIndex)
  const rightHtml = rightStext.asHTML(rightIndex)

  const leftParagraphs = parseAsHtml(leftHtml, renderScale)
  const rightParagraphs = parseAsHtml(rightHtml, renderScale)

  // Offset right page paragraphs by left page pixel width
  const leftPixelWidth = Math.round(leftWidth * renderScale)
  const offsetRightParagraphs = rightParagraphs.map((p) => ({
    ...p,
    left: p.left + leftPixelWidth,
  }))

  // Image bounds: offset right page images by left page width
  const leftImageBounds = extractImageBounds(leftPage, leftBounds)
  const rightImageBounds = extractImageBounds(rightPage, rightBounds).map((b) => ({
    ...b,
    x: b.x + leftWidth,
  }))

  return {
    paragraphs: [...leftParagraphs, ...offsetRightParagraphs],
    pageWidth: spreadWidth,
    pageHeight: spreadHeight,
    renderWidth: Math.round(spreadWidth * renderScale),
    renderHeight: Math.round(spreadHeight * renderScale),
    imageBounds: [...leftImageBounds, ...rightImageBounds],
  }
}

// ── Image Bounds ──────────────────────────────────────────────────

/**
 * Extract image bounding boxes from a PDF page using toStructuredText
 * with the 'preserve-images' option. Returns positions in PDF points
 * relative to the page origin.
 */
function extractImageBounds(
  page: ReturnType<MupdfDocument["loadPage"]>,
  pageBounds: Rect,
): ImageBounds[] {
  const stext = page.toStructuredText("preserve-images")
  const results: ImageBounds[] = []
  const pageOriginX = pageBounds[0]
  const pageOriginY = pageBounds[1]

  stext.walk({
    onImageBlock(bbox: [number, number, number, number]) {
      results.push({
        x: bbox[0] - pageOriginX,
        y: bbox[1] - pageOriginY,
        width: bbox[2] - bbox[0],
        height: bbox[3] - bbox[1],
      })
    },
  })

  return results
}

// ── Internal ───────────────────────────────────────────────────────

/**
 * Parse mupdf's asHTML output into positioned paragraphs.
 *
 * Input format:
 * <div id="pageN" style="width:Wpt;height:Hpt">
 * <p style="top:Tpt;left:Lpt;line-height:Hpt"><span style="...">text</span></p>
 * </div>
 *
 * Deduplicates paragraphs with similar positions and same text content.
 */
function parseAsHtml(html: string, renderScale: number): PositionedParagraph[] {
  const paragraphs: PositionedParagraph[] = []
  // Map dedup key → index in paragraphs array (so we can replace with better-styled version)
  const seen = new Map<string, number>()

  // Match each <p> element with its style and content
  const pRegex = /<p style="top:([\d.]+)pt;left:([\d.]+)pt;line-height:([\d.]+)pt">(.*?)<\/p>/gs
  let match
  while ((match = pRegex.exec(html)) !== null) {
    const topPt = parseFloat(match[1])
    const leftPt = parseFloat(match[2])
    const lineHeightPt = parseFloat(match[3])
    const content = match[4]

    // Strip HTML tags to get plain text for dedup.
    const rawText = content.replace(/<[^>]+>/g, "").trim()
    if (!rawText) continue

    // mupdf sometimes duplicates page numbers from overlapping vector paths:
    // - "3<sup>3</sup>" → strip <sup>/<sub> content
    // - "66", "1616" → a single span with the number repeated
    // Normalize for dedup by stripping sup/sub and collapsing repeated digit sequences.
    let dedupText = content.replace(/<sup>.*?<\/sup>/gi, "").replace(/<sub>.*?<\/sub>/gi, "").replace(/<[^>]+>/g, "").trim()
    if (/^\d+$/.test(dedupText) && dedupText.length >= 2 && dedupText.length % 2 === 0) {
      const half = dedupText.length / 2
      if (dedupText.slice(0, half) === dedupText.slice(half)) {
        dedupText = dedupText.slice(0, half)
      }
    }

    // Dedup: same text at similar position (within ~15pt)
    // mupdf can emit the same text from both text and vector layers
    // with slightly different positions
    const dedupKey = `${dedupText}|${Math.floor(topPt / 15)}|${Math.floor(leftPt / 15)}`

    // Strip <sup>/<sub> duplicates (e.g. "3<sup>3</sup>" → "3")
    // Digit halving is intentionally dedup-key-only — collapsing content
    // would turn legitimate "22" into "2".
    const cleanContent = content.replace(/<sup>.*?<\/sup>/gi, "").replace(/<sub>.*?<\/sub>/gi, "")

    const paragraph: PositionedParagraph = {
      top: Math.round(topPt * renderScale),
      left: Math.round(leftPt * renderScale),
      lineHeight: Math.round(lineHeightPt * renderScale),
      html: cleanContent,
    }

    const existingIdx = seen.get(dedupKey)
    if (existingIdx !== undefined) {
      // Duplicate found — prefer the version with non-black color (e.g. white page numbers)
      const hasColor = /color:#(?!000000)[0-9a-f]{6}/i.test(cleanContent)
      if (hasColor) {
        paragraphs[existingIdx] = paragraph
      }
      continue
    }

    seen.set(dedupKey, paragraphs.length)
    paragraphs.push(paragraph)
  }

  return paragraphs
}
