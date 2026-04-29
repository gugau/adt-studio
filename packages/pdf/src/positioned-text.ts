/**
 * Positioned text extraction for fixed-layout rendering.
 *
 * Parses mupdf's `asHTML()` output into structured paragraphs. Each paragraph
 * carries its viewport-space anchor (top-left origin), its line height, and
 * a list of styled segments (one per styled run, with CSS-compatible styling
 * preserved from mupdf's spans).
 *
 * Stream ordering for these paragraphs is assigned by the caller using the
 * page-stream recorder — mupdf's StructuredText layout doesn't preserve
 * draw order, so we don't try to extract z-order here.
 */

import {
  type Color,
  type Document as MupdfDocument,
  type Font as MupdfFont,
  type Page as MupdfPage,
  type Rect,
} from "mupdf"

// ── Types ──────────────────────────────────────────────────────────

/** Bounding box of an image on the page, in PDF points (top-left origin). */
export interface ImageBounds {
  x: number
  y: number
  width: number
  height: number
}

/** Structured styled-run inside a paragraph. */
export interface RawTextSegment {
  text: string
  /** CSS-compatible style map. Font-size is normalized to viewport `px`. */
  style?: Record<string, string>
}

/** Bounding box of a logical text block (union of its line bboxes). */
export interface TextBlockBounds {
  x: number
  y: number
  width: number
  height: number
}

/** A single asHTML paragraph parsed into viewport-coord position + segments. */
export interface AsHtmlParagraph {
  /** Top in viewport coordinates (PDF points, y-down, top-left origin). */
  top: number
  /** Left in viewport coordinates (PDF points). */
  left: number
  /** Line height in viewport coordinates (PDF points). */
  lineHeight: number
  /** Per-run styling. Concatenating `segments[].text` yields `text`. */
  segments: RawTextSegment[]
  /** Plain-text concatenation (convenience). */
  text: string
  /**
   * Identifier of the visual text block this paragraph belongs to. Wrapped
   * lines that came from the same speech bubble share `blockId`. Assigned
   * by `clusterParagraphsIntoBlocks` after asHTML parsing. Stable per
   * page (not globally unique — callers prefix with a page id if needed).
   */
  blockId?: string
  /**
   * Bounds of the whole block this paragraph belongs to (union of every
   * member paragraph's line bbox). Identical for paragraphs sharing
   * `blockId`. Used by translation flows to know how much room the
   * original container had.
   */
  blockBounds?: TextBlockBounds
  /**
   * Identifier of the merged paragraph this line belongs to. Wrapped
   * lines that the continuation heuristic decides are one logical
   * paragraph share a `mergedParagraphId`; sentence boundaries inside
   * the same block produce different ids. Same heuristic BookFusion's
   * PDF reader uses for TTS chunking.
   */
  mergedParagraphId?: string
  /**
   * Inferred horizontal alignment of the block this paragraph belongs
   * to ("center" or "right"). Absent when the block is left-aligned
   * (the CSS default). Used by the renderer to set `text-align` on the
   * merged-paragraph `<p>` so re-flowed translations stay visually
   * centred / right-aligned.
   */
  textAlign?: "center" | "right"
}

/**
 * One character recovered from `StructuredText.walk`. `qLeft`/`qRight`
 * are the glyph-quad horizontal extent — for a normal printable glyph
 * they straddle the rendered rectangle; for a U+0020 with zero glyph
 * advance (the literal-letter-spacing artefact some PDFs emit between
 * letters of a kerned title) the two are equal.
 *
 * Exported so tests can construct synthetic line data; internal callers
 * just see it through `LineBbox.chars`.
 */
export interface LineChar {
  c: string
  /** Origin x in PDF points (where the glyph anchor sits). */
  ox: number
  /** Left edge of the glyph quad in PDF points. */
  qLeft: number
  /** Right edge of the glyph quad in PDF points. */
  qRight: number
  /**
   * Font identity key — `"<fontname>@<size>"`. Used to detect runs of
   * consecutive characters in the same font/size, which is how we
   * recognise a decorative letter-spaced title sitting inside body text:
   * within one font run, a string of ≥4 ≤3-char fragments separated by
   * spaces is the broken-typesetting pattern.
   */
  font?: string
}

/** Per-line geometry recovered from `StructuredText.walk`. */
interface LineBbox {
  /** Top in PDF points. */
  top: number
  /** Left in PDF points. */
  left: number
  /** Bottom (top + height) in PDF points. */
  bottom: number
  /** Right (left + width) in PDF points. */
  right: number
  /** Plain text content of the line (trimmed of trailing whitespace). */
  text: string
  /**
   * Per-character geometry — only set when the consumer asked for it
   * (the metric-based space-stripping pass needs it). Trailing whitespace
   * is preserved here even though `text` strips it, so character indices
   * are stable.
   */
  chars?: LineChar[]
}

export interface PageGeometry {
  /** Page width in PDF points (viewport). */
  pageWidth: number
  /** Page height in PDF points (viewport). */
  pageHeight: number
  /** Rendered width in pixels (at renderScale, typically 2x). */
  renderWidth: number
  /** Rendered height in pixels (at renderScale, typically 2x). */
  renderHeight: number
}

/** Page info as stored in the pipeline storage. */
export interface PositionedTextPageInfo {
  pageId: string
  pageNumber: number
}

// ── High-Level API ─────────────────────────────────────────────────

/**
 * Parse asHTML paragraphs from a single PDF page.
 *
 * Returns paragraphs in mupdf's asHTML emission order. That order is
 * READING-FLOW (layout-reconstructed), NOT PDF stream order; callers that
 * need draw-order seqnos must derive them from the page stream recorder.
 *
 * Each paragraph is annotated with a `blockId` + `blockBounds` derived
 * from a layout-clustering pass over mupdf's per-line bboxes. Wrapped
 * lines that came from the same speech bubble share a block id and the
 * same bounds.
 */
export function parsePageParagraphs(
  doc: MupdfDocument,
  pageIndex: number,
  renderScale = 2,
  cleanSpacing = false,
): { paragraphs: AsHtmlParagraph[] } & PageGeometry {
  const page = doc.loadPage(pageIndex)
  const bounds = page.getBounds() as Rect
  const pageWidth = bounds[2] - bounds[0]
  const pageHeight = bounds[3] - bounds[1]
  const paragraphs = walkPageParagraphs(page)
  // Per-character geometry is only needed by the metric-based
  // space-stripping pass; skip it when not cleaning to avoid the
  // overhead.
  const lineBboxes = collectLineBboxes(page, cleanSpacing)
  if (cleanSpacing) {
    // Strip spurious U+0020 spaces (the literal-letter-spacing artefacts
    // some PDFs emit between glyphs of a tracked-letterform word) before
    // anything downstream uses paragraph text — clustering's
    // continuation heuristic and rendered output both want the cleaned
    // text. The decision is metric-based per paragraph (cluster advance
    // vs. that paragraph's own letter-spacing), so plain text is left
    // untouched. Reflowable text comes from a separate path
    // (`extractTextFromStructuredText`) and isn't affected.
    cleanParagraphSpacing(paragraphs, lineBboxes)
  }
  clusterParagraphsIntoBlocks(paragraphs, lineBboxes)
  return {
    paragraphs,
    pageWidth,
    pageHeight,
    renderWidth: Math.round(pageWidth * renderScale),
    renderHeight: Math.round(pageHeight * renderScale),
  }
}

/**
 * Parse asHTML paragraphs from a two-page spread, x-shifting right-page
 * positions by the left page's width so they address the stitched
 * spread viewport. Each paragraph is annotated with `blockId` /
 * `blockBounds`; clustering runs after the x-shift so left and right
 * pages remain in separate blocks even when their layout lines up.
 */
export function parsePageParagraphsSpread(
  doc: MupdfDocument,
  leftIndex: number,
  rightIndex: number,
  renderScale = 2,
  cleanSpacing = false,
): { paragraphs: AsHtmlParagraph[] } & PageGeometry {
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

  const leftParagraphs = walkPageParagraphs(leftPage)
  const rightParagraphs = walkPageParagraphs(rightPage)
  const shifted = rightParagraphs.map((p) => ({ ...p, left: p.left + leftWidth }))

  const leftLines = collectLineBboxes(leftPage, cleanSpacing)
  // For the right page we shift `chars[].ox/qLeft/qRight` along with
  // `left`/`right` so per-character geometry stays consistent in the
  // spread coordinate space.
  const rightLines = collectLineBboxes(rightPage, cleanSpacing).map((l) => ({
    ...l,
    left: l.left + leftWidth,
    right: l.right + leftWidth,
    chars: l.chars
      ? l.chars.map((c) => ({ ...c, ox: c.ox + leftWidth, qLeft: c.qLeft + leftWidth, qRight: c.qRight + leftWidth }))
      : undefined,
  }))

  if (cleanSpacing) {
    // Strip spurious spaces before clustering so the continuation
    // heuristic gets clean text. See `parsePageParagraphs`.
    cleanParagraphSpacing(leftParagraphs, leftLines)
    cleanParagraphSpacing(shifted, rightLines)
  }

  // Cluster left and right separately so paragraphs from the two physical
  // pages never join the same block, even if the gap between them happens
  // to look right (e.g. last-line-of-left bubble at the same y as
  // first-line-of-right bubble).
  clusterParagraphsIntoBlocks(leftParagraphs, leftLines, "L")
  clusterParagraphsIntoBlocks(shifted, rightLines, "R")

  return {
    paragraphs: [...leftParagraphs, ...shifted],
    pageWidth: spreadWidth,
    pageHeight: spreadHeight,
    renderWidth: Math.round(spreadWidth * renderScale),
    renderHeight: Math.round(spreadHeight * renderScale),
  }
}

/**
 * Walk the structured-text tree to collect per-line bboxes (and, when
 * `withChars` is set, per-character geometry too). mupdf's own "block"
 * grouping is unreliable for illustrated layouts (it sometimes fuses
 * unrelated columns and splits real bubbles), so we only consume the
 * per-line bboxes — they're tight and trustworthy — and do our own
 * clustering on top.
 */
function collectLineBboxes(page: MupdfPage, withChars = false): LineBbox[] {
  const stext = page.toStructuredText()
  const lines: LineBbox[] = []
  let curBbox: Rect | null = null
  let curChars: LineChar[] = []
  stext.walk({
    beginLine(bbox) {
      curBbox = bbox
      curChars = []
    },
    onChar(c, origin, font, size, quad) {
      // origin/quad layouts can vary between mupdf-js versions: origin is
      // a Point ([x, y] or {x, y}); quad is an 8-number flat array of the
      // four corners. We're only after horizontal extent, so take the
      // min/max of all four x components.
      const ox = Array.isArray(origin) ? origin[0] : (origin as { x: number } | undefined)?.x ?? 0
      const xs = [quad[0], quad[2], quad[4], quad[6]].filter(
        (v): v is number => typeof v === "number",
      )
      const qLeft = xs.length > 0 ? Math.min(...xs) : ox
      const qRight = xs.length > 0 ? Math.max(...xs) : ox
      const fontName = font?.getName?.() ?? ""
      const fontKey = `${fontName}@${size ?? ""}`
      curChars.push({ c, ox, qLeft, qRight, font: fontKey })
    },
    endLine() {
      if (!curBbox) return
      // Drop overlapping glyph passes (stroke-then-fill) so line text
      // matches what `walkPageParagraphs` produces — otherwise the
      // matchLineBbox lookup in `clusterParagraphsIntoBlocks` fails
      // ("yellow" line text vs "yellowyellow" deduped paragraph text)
      // and paragraphs get no blockBounds, which disables auto-fit.
      curChars = dedupOverlappingGlyphs(curChars)
      const rawText = curChars.map((c) => c.c).join("")
      const text = rawText.replace(/\s+$/, "")
      if (!text) {
        curBbox = null
        return
      }
      const line: LineBbox = {
        left: curBbox[0],
        top: curBbox[1],
        right: curBbox[2],
        bottom: curBbox[3],
        text,
      }
      if (withChars) line.chars = curChars.slice()
      lines.push(line)
      curBbox = null
    },
  })
  return lines
}

// ── Spurious-space stripping (metric-based) ───────────────────────

/**
 * Strip U+0020 characters that are "letter-spacing artefacts" — spaces
 * the PDF stream inserts between glyphs of a single visually-kerned word
 * (e.g. mupdf returns `"U n iversity"` for a tracked "University") — while
 * preserving real word-boundary spaces. The discriminator is *physical
 * advance through a space cluster vs. the paragraph's prevailing
 * letter-spacing*; no per-book convention is hard-coded.
 *
 * For each line we already collected per-character geometry for:
 * 1. Compute the median letter-spacing — the gap from one non-space
 *    glyph's right edge to the next non-space glyph's left edge across
 *    pairs that have no space between them. This is the paragraph's
 *    natural letter-tracking.
 * 2. Identify maximal runs of consecutive U+0020 characters.
 * 3. For each run, sum the widths of its space glyphs (its total
 *    horizontal advance through the cluster).
 * 4. If `clusterAdvance < max(medianLS × 1.6, 1pt)` the cluster is an
 *    intra-word artefact → strip every character in it. Otherwise it's a
 *    real word boundary → keep one space, drop the rest.
 *
 * The 1.6× multiplier handles fonts with slightly variable letter-spacing
 * without false-positiving on tightly-set body text. The 1pt floor avoids
 * a divide-by-zero edge case when letter-spacing rounds to 0 (then any
 * space character is wider than zero and gets kept — exactly what we
 * want for plain text).
 *
 * Returns the per-character strip mask for the caller to apply to the
 * matching asHTML paragraph's text + segments.
 */
function computeStripMask(chars: LineChar[]): boolean[] {
  const mask = new Array(chars.length).fill(false)
  if (chars.length === 0) return mask

  // 1. Group chars into physical font runs (consecutive characters with
  //    the same font key) and compute each run's prevailing letter-
  //    spacing. Mixed-font lines — body text + decorative title +
  //    body text — would otherwise have their median washed out by
  //    the body run's zero-tracking pairs, hiding the title run's real
  //    ~3pt tracking. Per-run medians keep each context honest.
  type Run = { start: number; end: number; medianLS: number }
  const runs: Run[] = []
  let s = 0
  while (s < chars.length) {
    let e = s + 1
    while (e < chars.length && chars[e].font === chars[s].font) e++
    const trackings: number[] = []
    for (let k = s + 1; k < e; k++) {
      if (chars[k].c === " " || chars[k - 1].c === " ") continue
      const advance = chars[k].ox - chars[k - 1].ox
      const prevWidth = chars[k - 1].qRight - chars[k - 1].qLeft
      const tracking = advance - prevWidth
      if (tracking >= 0 && tracking < 50) trackings.push(tracking)
    }
    trackings.sort((a, b) => a - b)
    const medianLS =
      trackings.length > 0 ? trackings[Math.floor(trackings.length / 2)] : 0
    runs.push({ start: s, end: e, medianLS })
    s = e
  }
  const runForIndex = (idx: number): Run | undefined =>
    runs.find((r) => idx >= r.start && idx < r.end)

  // 1b. Identify font runs that consist of mostly single-character
  //     fragments separated by single spaces — the "L E A V E  N O  O N E
  //     B E H I N D." or "e v a c u a t i o n t e n t s" pattern. Those
  //     runs either have no consecutive non-space pairs to measure
  //     (medianLS=0) or have a single accidental pair (D→.) that gives a
  //     misleading non-zero median; either way the primary threshold
  //     check straddles the real cluster advances and produces wrong
  //     decisions per cluster. The shape itself — ≥4 single-char
  //     fragments and ≥60% of fragments being single-char — is the
  //     unambiguous signal: body text never produces that.
  const stripAsLetterRun = new Set<number>()
  for (const run of runs) {
    let fragCount = 0
    let singleCharCount = 0
    let p = run.start
    while (p < run.end) {
      while (p < run.end && chars[p].c === " ") p++
      const fragStart = p
      while (p < run.end && chars[p].c !== " ") p++
      const fragLen = p - fragStart
      if (fragLen > 0) {
        fragCount += 1
        if (fragLen === 1) singleCharCount += 1
      }
    }
    if (singleCharCount >= 4 && singleCharCount / fragCount >= 0.6) {
      stripAsLetterRun.add(run.start)
    }
  }

  // 2. Walk space clusters. The cluster's *real* advance is the cursor
  //    distance from the first space to the next non-space — origin-to-
  //    origin, telescoping through any number of spaces. The threshold
  //    we compare against depends on context:
  //
  //    - Surrounding non-space chars share a font → use that run's
  //      median letter-spacing (× 1.6, floored at 1pt). Cluster narrower
  //      than that = letter-spacing artefact → strip.
  //    - Surrounding chars are in different fonts → font transition,
  //      almost certainly a real word boundary → keep.
  //    - At line edge (no surrounding char on one side) → use the
  //      adjacent run's threshold.
  //    - Cluster sits inside a `stripAsLetterRun` font run → strip
  //      (single-space) or collapse (multi-space) regardless of metric.
  let i = 0
  while (i < chars.length) {
    if (chars[i].c !== " ") {
      i++
      continue
    }
    let j = i
    while (j < chars.length && chars[j].c === " ") j++

    const leftFont = i > 0 ? chars[i - 1].font : undefined
    const rightFont = j < chars.length ? chars[j].font : undefined
    const sameFontRun =
      leftFont !== undefined && rightFont !== undefined && leftFont === rightFont
    const surroundingRun = sameFontRun
      ? runForIndex(i - 1)
      : leftFont !== undefined && rightFont === undefined
        ? runForIndex(i - 1)
        : leftFont === undefined && rightFont !== undefined
          ? runForIndex(j)
          : undefined
    const medianLS = surroundingRun?.medianLS ?? 0

    // Letter-run fallback: fire when the cluster is bracketed by chars in
    // a flagged single-char-fragment run. We require sameFontRun so we
    // don't strip a font-transition space whose two sides happen to
    // belong to different runs.
    const inLetterRun =
      sameFontRun &&
      surroundingRun !== undefined &&
      stripAsLetterRun.has(surroundingRun.start)

    const stripThreshold = Math.max(medianLS * 1.6, 1)
    const clusterAdvance =
      j < chars.length
        ? chars[j].ox - chars[i].ox
        : chars[j - 1].qRight - chars[i].ox // trailing cluster fallback

    const shouldStrip = clusterAdvance < stripThreshold || (inLetterRun && j - i === 1)

    if (shouldStrip) {
      for (let k = i; k < j; k++) mask[k] = true
    } else if (j - i > 1) {
      for (let k = i + 1; k < j; k++) mask[k] = true
    }

    i = j
  }

  return mask
}

/**
 * Apply the strip mask to an asHTML paragraph in place: drop characters
 * from `text` and from each segment's `text` when their position aligns
 * with a stripped character in the line. We only touch the paragraph
 * when its text matches the line text up to trailing whitespace (the
 * common case); when they diverge we leave the paragraph untouched
 * rather than risk corrupting style boundaries.
 */
function applyStripMaskToParagraph(p: AsHtmlParagraph, line: LineBbox): void {
  if (!line.chars) return
  const lineText = line.chars.map((c) => c.c).join("")
  // Only proceed when paragraph text is a prefix of the line characters
  // (asHTML often trims trailing whitespace differently than the walker).
  // If they diverge mid-string we'd start dropping the wrong characters.
  if (!lineText.startsWith(p.text) && !p.text.startsWith(lineText.replace(/\s+$/, ""))) return

  const mask = computeStripMask(line.chars)

  // Build cleaned text by walking p.text and consulting the mask at the
  // matching index in lineText.
  let newText = ""
  for (let i = 0; i < p.text.length; i++) {
    if (i < mask.length && p.text[i] === line.chars[i].c && mask[i]) continue
    newText += p.text[i]
  }
  if (newText === p.text) return // Nothing to strip — leave segments alone.

  // Apply same drop pattern to segments. Segment texts concatenate to
  // p.text in order, so we track a global position and skip stripped
  // indices per segment.
  let pos = 0
  const newSegments: RawTextSegment[] = []
  for (const seg of p.segments) {
    let segText = ""
    for (let k = 0; k < seg.text.length; k++) {
      const idx = pos + k
      const stripHere =
        idx < mask.length && mask[idx] && line.chars[idx].c === seg.text[k]
      if (!stripHere) segText += seg.text[k]
    }
    newSegments.push(segText.length > 0 ? { ...seg, text: segText } : { ...seg, text: "" })
    pos += seg.text.length
  }

  p.text = newText
  // Drop fully-empty segments so we don't render zero-content spans.
  p.segments = newSegments.filter((s) => s.text.length > 0)
}

/**
 * Top-level pass: for each paragraph, find its matching line and apply
 * metric-based space stripping. Modifies paragraphs in place. Exported
 * so tests can drive it with synthetic data without spinning up mupdf.
 */
export function cleanParagraphSpacing(paragraphs: AsHtmlParagraph[], lines: { text: string; chars?: LineChar[]; top: number; left: number; right: number; bottom: number }[]): void {
  for (const p of paragraphs) {
    const matched = matchLineBbox(p, lines)
    if (matched) applyStripMaskToParagraph(p, matched)
  }
}

/**
 * Walk the structured-text tree to extract paragraphs (one per line) with
 * viewport (PDF point) coordinates + structured segments. Each line
 * becomes one paragraph; consecutive characters that share font, size,
 * and color collapse into one segment. Deduplicates paragraphs that share
 * normalized text content at a close position (mupdf emits the same text
 * from both text and vector layers for some PDFs).
 *
 * This is a single-pass walk that replaces the previous
 * `asHTML()`-and-reparse approach: mupdf's `onChar` callback exposes the
 * same data (font, size, color, position) directly, so no HTML round-trip
 * is needed.
 */
function walkPageParagraphs(page: MupdfPage): AsHtmlParagraph[] {
  const stext = page.toStructuredText()
  const paragraphs: AsHtmlParagraph[] = []
  const seen = new Map<string, number>()

  let curBbox: Rect | null = null
  let curChars: Array<{ c: string; ox: number; font: MupdfFont; size: number; color: Color }> = []

  stext.walk({
    beginLine(bbox) {
      curBbox = bbox
      curChars = []
    },
    onChar(c, origin, font, size, _quad, color) {
      const ox = Array.isArray(origin) ? origin[0] : (origin as { x: number } | undefined)?.x ?? 0
      curChars.push({ c, ox, font, size, color })
    },
    endLine() {
      if (!curBbox || curChars.length === 0) {
        curBbox = null
        return
      }
      // Drop overlapping glyph passes — stroke-then-fill rendering (used
      // for outlined-fill effects on decorative text like "yellow") emits
      // each character twice at the same origin: once stroked, once
      // filled. mupdf's StructuredText keeps both passes; concatenating
      // them naively yields "yellowyellow". Dedup by (char, integer
      // x-pt) keeps one occurrence; we replace the earlier instance with
      // the later so the visual end-state (typically fill, drawn after
      // stroke) wins on color/style.
      curChars = dedupOverlappingGlyphs(curChars)

      const rawText = curChars.map((ch) => ch.c).join("")
      const text = rawText.replace(/\s+$/, "")
      if (!text.trim()) {
        curBbox = null
        return
      }

      const segments = groupIntoSegments(curChars, rawText.length - text.length)
      const topPt = curBbox[1]
      const leftPt = curBbox[0]
      // Use the max nominal font-size in the line as line-height —
      // matches mupdf asHtml's convention and CSS's line-box model.
      // The glyph-quad bbox height (`curBbox[3] - curBbox[1]`) overcounts
      // for fonts with large ascender/descender extent (e.g. ComicSansMS
      // glyphs at 48pt span ~67pt of quad), which inflates the rendered
      // line-height past CSS's expectation and breaks the wrapped-line
      // count vs block-bounds math.
      let maxSize = 0
      for (const ch of curChars) if (ch.size > maxSize) maxSize = ch.size
      const lineHeightPt = maxSize > 0 ? maxSize : curBbox[3] - curBbox[1]

      // Collapse repeated-numeral page numbers ("1616" → "16") for the dedup
      // key only. The original text is kept as-is.
      let dedupText = text
      if (/^\d+$/.test(dedupText) && dedupText.length >= 2 && dedupText.length % 2 === 0) {
        const half = dedupText.length / 2
        if (dedupText.slice(0, half) === dedupText.slice(half)) {
          dedupText = dedupText.slice(0, half)
        }
      }
      const dedupKey = `${dedupText}|${Math.floor(topPt / 15)}|${Math.floor(leftPt / 15)}`

      const paragraph: AsHtmlParagraph = {
        top: topPt,
        left: leftPt,
        lineHeight: lineHeightPt,
        segments,
        text,
      }

      const existingIdx = seen.get(dedupKey)
      if (existingIdx !== undefined) {
        // Duplicate — prefer the one with non-black color (e.g. white page nums).
        const hasColor = segments.some((s) => {
          const colorStr = s.style?.color
          return !!colorStr && !/^#?0{3}$|^#?0{6}$/.test(colorStr.replace(/\s/g, ""))
        })
        if (hasColor) paragraphs[existingIdx] = paragraph
      } else {
        seen.set(dedupKey, paragraphs.length)
        paragraphs.push(paragraph)
      }
      curBbox = null
    },
  })

  return paragraphs
}

/** Dedup glyphs that occupy the same `(char, x-pt)` slot — happens when a
 *  PDF renders text with stroke-then-fill (or fill-then-stroke) for an
 *  outline effect. The later occurrence wins so the fill (drawn last in
 *  PDF stream order) carries through; segment style on the deduped char
 *  reflects the visible end-state. */
function dedupOverlappingGlyphs<T extends { c: string; ox: number }>(chars: T[]): T[] {
  if (chars.length < 2) return chars
  const seen = new Map<string, number>()
  const out: T[] = []
  for (const ch of chars) {
    if (ch.c === " " || ch.c === "\t") {
      out.push(ch)
      continue
    }
    const key = `${ch.c}|${Math.round(ch.ox)}`
    const existingIdx = seen.get(key)
    if (existingIdx !== undefined) {
      out[existingIdx] = ch
      continue
    }
    seen.set(key, out.length)
    out.push(ch)
  }
  return out
}

/** Group consecutive same-style chars into segments. `trailingTrim` drops
 *  trailing whitespace chars from the last segment (matching `text` which
 *  is right-trimmed). */
function groupIntoSegments(
  chars: Array<{ c: string; font: MupdfFont; size: number; color: Color }>,
  trailingTrim: number,
): RawTextSegment[] {
  if (chars.length === 0) return []
  const segments: RawTextSegment[] = []
  const styleSig = (i: number) =>
    `${chars[i].font.getName()}|${chars[i].size}|${colorToCss(chars[i].color)}|${chars[i].font.isBold()}|${chars[i].font.isItalic()}`

  let segStart = 0
  let curSig = styleSig(0)
  for (let i = 1; i <= chars.length; i++) {
    const sig = i < chars.length ? styleSig(i) : null
    if (sig !== curSig) {
      const segText = chars.slice(segStart, i).map((c) => c.c).join("")
      if (segText) {
        segments.push({
          text: segText,
          style: buildSegmentStyle(chars[segStart].font, chars[segStart].size, chars[segStart].color),
        })
      }
      segStart = i
      if (sig !== null) curSig = sig
    }
  }
  // Right-trim trailing whitespace from the last segment.
  if (trailingTrim > 0 && segments.length > 0) {
    const last = segments[segments.length - 1]
    last.text = last.text.replace(/\s+$/, "")
    if (!last.text) segments.pop()
  }
  return segments
}

function buildSegmentStyle(font: MupdfFont, size: number, color: Color): Record<string, string> {
  const style: Record<string, string> = {
    "font-family": cssFontFamily(font),
    "font-size": `${size}px`,
    color: colorToCss(color),
  }
  if (font.isBold()) style["font-weight"] = "bold"
  if (font.isItalic()) style["font-style"] = "italic"
  return style
}

/** Convert a mupdf font name to a CSS font-family string. Strips PostScript
 *  style suffixes (`-Roman`, `-Regular`, `-Bold`, etc.) and the foundry
 *  prefix (e.g. `LT`, `MT`) that PDFs sometimes carry, then appends the
 *  generic `serif` so unbundled fonts fall back to a serif terminal in the
 *  renderer's `withBundledFallback` chain. */
function cssFontFamily(font: MupdfFont): string {
  let name = font.getName()
  // PDF subset prefix is 6 uppercase letters + "+" + the real font name
  // (e.g. "TXJRJH+Palatino"). Drop it so paragraphs that mupdf split
  // into different subsets cluster as the same logical font — otherwise
  // adjacent lines from one bubble end up in separate blocks because
  // their fontKey differs only in subset tag.
  if (/^[A-Z]{6}\+/.test(name)) name = name.slice(7)
  // Strip PostScript style suffix.
  const dash = name.indexOf("-")
  if (dash > 0) name = name.slice(0, dash)
  // Strip common foundry suffixes.
  name = name.replace(/(MT|LT|PS|Pro|Std)$/g, "")
  if (!name) name = "serif"
  return `${name},serif`
}

/** Convert a mupdf Color (1, 3, or 4 floats in 0..1) to `#rrggbb`. */
function colorToCss(color: Color): string {
  let r: number, g: number, b: number
  if (color.length === 1) {
    r = g = b = color[0]
  } else if (color.length === 3) {
    [r, g, b] = color
  } else {
    // CMYK → naive conversion: r=(1-c)(1-k), g=(1-m)(1-k), b=(1-y)(1-k).
    const [c, m, y, k] = color
    r = (1 - c) * (1 - k)
    g = (1 - m) * (1 - k)
    b = (1 - y) * (1 - k)
  }
  const hex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n * 255))).toString(16).padStart(2, "0")
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

// ── Block clustering ───────────────────────────────────────────────

/**
 * Each paragraph plus the line-bbox we matched it to (bottom/right are
 * the only fields not already on the paragraph). Used internally during
 * clustering; not exported because the final form everyone consumes is
 * `AsHtmlParagraph.blockBounds`.
 */
interface ParagraphWithBbox {
  paragraph: AsHtmlParagraph
  /** Effective line bbox: tight when matched to a structured-text line, estimated otherwise. */
  bbox: { left: number; top: number; right: number; bottom: number }
  /** Primary font (family + size as a string key) for the paragraph. Empty when unknown. */
  fontKey: string
}

/**
 * Cluster paragraphs into visual blocks (e.g. one speech bubble = one
 * block) and stamp `blockId` + `blockBounds` on each paragraph in place.
 *
 * Inputs:
 * - `paragraphs` is the asHTML output (top/left/lineHeight per line; no width).
 * - `lineBboxes` are mupdf's per-line bboxes from structured-text walk —
 *   tight rectangles we use to recover each paragraph's true right/bottom.
 *
 * Algorithm:
 * 1. For each paragraph, find the best-matching line bbox by `top` proximity
 *    and a text-prefix match. Fall back to an estimated bbox when no line
 *    matches (rare; happens when asHTML emits text the structured-text walker
 *    didn't see, e.g. duplicated layers).
 * 2. Sort paragraphs by top, then left.
 * 3. Greedily assign each paragraph to an existing block when:
 *    - same font (family + size),
 *    - vertical gap from any existing line in the block to the candidate's
 *      top is in [-0.5×lh, 1.6×lh] (handles both descenders and small
 *      lineHeight-vs-leading mismatches), and
 *    - rectangles overlap horizontally OR centers are within 30pt
 *      (centred ragged-right text in bubbles).
 *    Otherwise start a new block.
 * 4. Compute each block's bounds as the union of its paragraphs' line bboxes.
 *
 * The optional `idPrefix` lets the spread variant keep left/right blocks in
 * separate id namespaces — this function never invents cross-page blocks
 * because clustering happens on each side's paragraphs separately.
 */
export function clusterParagraphsIntoBlocks(
  paragraphs: AsHtmlParagraph[],
  lineBboxes: LineBbox[],
  idPrefix = "",
): void {
  if (paragraphs.length === 0) return

  const enriched: ParagraphWithBbox[] = paragraphs.map((p) => {
    const matched = matchLineBbox(p, lineBboxes)
    const bbox = matched
      ? { left: matched.left, top: matched.top, right: matched.right, bottom: matched.bottom }
      : {
          left: p.left,
          top: p.top,
          // Crude fallback: unknown width, height = lineHeight. Used only when
          // no structured-text line matches (very rare in practice).
          right: p.left + Math.max(p.text.length * 0.5 * p.lineHeight, p.lineHeight),
          bottom: p.top + p.lineHeight,
        }
    return { paragraph: p, bbox, fontKey: paragraphFontKey(p) }
  })

  // Stable sort by top (primary) then left (secondary) so clustering
  // sweeps top-to-bottom in reading order and gets a deterministic
  // assignment for paragraphs at the same y.
  const sorted = enriched.slice().sort((a, b) => {
    if (a.bbox.top !== b.bbox.top) return a.bbox.top - b.bbox.top
    return a.bbox.left - b.bbox.left
  })

  type Block = {
    members: ParagraphWithBbox[]
    /** Running union bounds — kept current as members join. */
    union: { left: number; top: number; right: number; bottom: number }
    fontKey: string
    /** Median lineHeight across members; used as the vertical-gap budget. */
    lineHeight: number
  }
  const blocks: Block[] = []

  for (const item of sorted) {
    const lh = item.paragraph.lineHeight
    const join = blocks.find((b) => canJoinBlock(b, item))
    if (join) {
      join.members.push(item)
      join.union = {
        left: Math.min(join.union.left, item.bbox.left),
        top: Math.min(join.union.top, item.bbox.top),
        right: Math.max(join.union.right, item.bbox.right),
        bottom: Math.max(join.union.bottom, item.bbox.bottom),
      }
      // Track running median-ish lineHeight by simple max — bubbles are
      // usually uniform and we want the join budget to grow if a slightly
      // taller line shows up rather than to shrink.
      join.lineHeight = Math.max(join.lineHeight, lh)
    } else {
      blocks.push({
        members: [item],
        union: { ...item.bbox },
        fontKey: item.fontKey,
        lineHeight: lh,
      })
    }
  }

  blocks.forEach((block, idx) => {
    const id = `${idPrefix}b${String(idx).padStart(3, "0")}`
    const bounds: TextBlockBounds = {
      x: block.union.left,
      y: block.union.top,
      width: block.union.right - block.union.left,
      height: block.union.bottom - block.union.top,
    }
    const align = inferTextAlign(block.members, block.union)
    // Sort members in visual reading order (top, then left) before running
    // the continuation pass — clustering already touched these in some
    // sweep order, but we want the continuation check to compare "the
    // line above" with "the line below it" specifically.
    const ordered = block.members
      .slice()
      .sort((a, b) => (a.bbox.top !== b.bbox.top ? a.bbox.top - b.bbox.top : a.bbox.left - b.bbox.left))

    let mergedIdx = 0
    let prevText: string | null = null
    for (const m of ordered) {
      const curText = m.paragraph.text
      const startsNewParagraph = prevText === null || !isContinuation(prevText, curText)
      if (startsNewParagraph) mergedIdx += 1
      const mid = `${id}_p${String(mergedIdx).padStart(2, "0")}`
      m.paragraph.blockId = id
      m.paragraph.blockBounds = bounds
      m.paragraph.mergedParagraphId = mid
      if (align) m.paragraph.textAlign = align
      prevText = curText
    }
  })
}

/**
 * Decide whether `currentText` continues the line above (`prevText`).
 * Mirrors BookFusion's PDF-reader TTS heuristic:
 *
 * 1. Previous line ends with a hyphen → wrapped word, treat as continuation.
 * 2. Current line starts with a Unicode lowercase letter → mid-sentence
 *    wrap, treat as continuation.
 *
 * Otherwise the lines are different paragraphs (sentence break, list
 * item, new bubble line, etc.). Sharing a block (visual container) is
 * decided separately; this just splits within a block.
 */
function isContinuation(prevText: string, currentText: string): boolean {
  if (prevText.endsWith("-")) return true
  const firstChar = currentText.match(/^\s*(\S)/)
  if (firstChar && /\p{Ll}/u.test(firstChar[1])) return true
  return false
}

/**
 * Infer the horizontal alignment of a block from its member lines.
 * Returns "center" / "right" when the block visibly aligns that way;
 * undefined for left-aligned (CSS default).
 *
 * The check we want is "do all lines share the same horizontal centre?",
 * which works even for ragged-right centred bubbles where the widest line
 * is flush-left and a different shorter line defines the block's right
 * edge (so the *block* centre is shifted away from the *visual* centre).
 *
 * - All line lefts within FLUSH of block.left → left (return undefined).
 * - All line rights within FLUSH of block.right → "right".
 * - All line centres within CENTER_TOL of the average line centre, and
 *   at least one line has padding on both sides → "center".
 * - Otherwise treat as left (CSS default).
 */
function inferTextAlign(
  members: ParagraphWithBbox[],
  blockUnion: { left: number; top: number; right: number; bottom: number },
): "center" | "right" | undefined {
  if (members.length < 2) return undefined
  const FLUSH = 2 // pt — line edge counts as touching the block edge
  const CENTER_TOL = 6 // pt — tolerance for "all line centres agree"

  let maxLeftDelta = 0
  let maxRightDelta = 0
  let anyMeaningfulPadding = false
  const lineCentres: number[] = []
  for (const m of members) {
    const leftDelta = m.bbox.left - blockUnion.left
    const rightDelta = blockUnion.right - m.bbox.right
    if (leftDelta > maxLeftDelta) maxLeftDelta = leftDelta
    if (rightDelta > maxRightDelta) maxRightDelta = rightDelta
    if (leftDelta > FLUSH && rightDelta > FLUSH) anyMeaningfulPadding = true
    lineCentres.push((m.bbox.left + m.bbox.right) / 2)
  }

  if (maxLeftDelta < FLUSH) return undefined // left-flush — default
  if (maxRightDelta < FLUSH) return "right"

  const avgCentre = lineCentres.reduce((a, b) => a + b, 0) / lineCentres.length
  const maxCentreDeviation = lineCentres.reduce(
    (m, c) => Math.max(m, Math.abs(c - avgCentre)),
    0,
  )
  if (maxCentreDeviation < CENTER_TOL && anyMeaningfulPadding) return "center"
  return undefined
}

/**
 * Decide whether `candidate` can extend `block`. Same font, vertical gap
 * in lineHeight territory, and either horizontal overlap or close centres
 * (centred bubble text). Reject if any check fails.
 */
function canJoinBlock(
  block: { union: { left: number; top: number; right: number; bottom: number }; fontKey: string; lineHeight: number },
  candidate: ParagraphWithBbox,
): boolean {
  if (block.fontKey !== candidate.fontKey) return false

  const lh = Math.max(block.lineHeight, candidate.paragraph.lineHeight)
  // Gap from the block's current bottom to the candidate's top. Allow a
  // small negative gap (descenders / overlap) and up to 1.6×lineHeight
  // forward (extra leading in some PDFs).
  const verticalGap = candidate.bbox.top - block.union.bottom
  if (verticalGap < -lh * 0.5 || verticalGap > lh * 1.6) return false

  const overlapsHoriz =
    candidate.bbox.left <= block.union.right && candidate.bbox.right >= block.union.left
  if (overlapsHoriz) return true

  // Centred ragged-right text — match centres within 30pt (≈ a typical
  // bubble's half-width tolerance).
  const candCentre = (candidate.bbox.left + candidate.bbox.right) / 2
  const blockCentre = (block.union.left + block.union.right) / 2
  return Math.abs(candCentre - blockCentre) <= 30
}

/**
 * Match a paragraph to its mupdf structured-text line. Prefers text
 * agreement (mupdf's asHTML and StructuredText agree on the actual run
 * of characters even when their reported `top` values disagree — e.g.
 * inside blocks with extra leading where asHTML's paragraph top is
 * offset from the glyph cap-top by more than one lineHeight). When two
 * lines share the same text (page numbers, repeated headers), `top`
 * proximity disambiguates.
 *
 * Returns the best candidate, or null when the paragraph's text doesn't
 * appear in the structured-text output at all.
 */
function matchLineBbox(p: AsHtmlParagraph, lines: LineBbox[]): LineBbox | null {
  const target = p.text.trim()
  if (!target) return null
  let best: LineBbox | null = null
  let bestScore = Infinity
  for (const line of lines) {
    const lineText = line.text.trim()
    const exactMatch = lineText === target
    const prefixMatch = !exactMatch && (lineText.startsWith(target) || target.startsWith(lineText))
    if (!exactMatch && !prefixMatch) continue

    // Among same-text candidates pick the one closest in y. asHTML and
    // StructuredText sometimes disagree by more than one lineHeight, so
    // we don't reject far-apart matches outright — but we do score them.
    const dy = Math.abs(line.top - p.top)
    const score = (exactMatch ? 0 : 50) + dy
    if (score < bestScore) {
      bestScore = score
      best = line
    }
  }
  return best
}

/**
 * Build a stable identity key for a paragraph's primary font (family +
 * size). Used by clustering to refuse to merge a heading into the body
 * paragraph below it. Empty string when no font info is available — those
 * paragraphs will only cluster among themselves.
 */
function paragraphFontKey(p: AsHtmlParagraph): string {
  const seg = p.segments[0]
  if (!seg?.style) return ""
  const family = seg.style["font-family"] ?? ""
  const size = seg.style["font-size"] ?? ""
  return `${family}|${size}`
}
