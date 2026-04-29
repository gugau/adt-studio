/**
 * Fixed-Layout Rendering
 *
 * Produces fixed-layout HTML pages for illustrated storybooks. Uses
 * extracted illustration images as backgrounds with visible, styled
 * positioned text from mupdf's asHTML() output.
 *
 * Sectioning emits a regular `PageSectioningOutput` (semantic tree of
 * `ContentNodeData` leaves) plus a `placement` sidecar carrying the PDF
 * coordinates, segment styling, blockBounds, etc. on
 * `PageSectioningSection.placement[nodeId]`. Downstream steps
 * (text-catalog, TTS, packageAdtWeb) walk the tree and ignore placement.
 */

import { PNG } from "pngjs"
import type { Storage } from "@adt/storage"
import type {
  AppConfig,
  ContentNodeData,
  DrawItem,
  ImageClassificationOutput,
  NodePlacement,
  PageSectioningOutput,
  PageSectioningSection,
  SectionTextSegment,
  WebRenderingOutput,
  PositionedTextOutput,
} from "@adt/types"

/**
 * Whether the book should render as a fixed-layout EPUB.
 *
 * True if any section type resolves to a `fixed_layout`-typed render strategy.
 * When any section is fixed-layout the whole book renders fixed-layout
 * (consistent with the BookFusion reader's homogeneous-layout requirement;
 * the EPUB spec allows mixed per-itemref but many readers don't support it
 * cleanly).
 */
export function isFixedLayoutBook(config: AppConfig): boolean {
  const strategies = config.render_strategies ?? {}
  const candidateNames = new Set<string>()
  if (config.default_render_strategy) candidateNames.add(config.default_render_strategy)
  for (const name of Object.values(config.section_render_strategies ?? {})) {
    candidateNames.add(name)
  }
  for (const name of candidateNames) {
    if (strategies[name]?.render_type === "fixed_layout") return true
  }
  return false
}

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
 * Compute the stroke style (or null when contrast is sufficient) for a
 * single text colour against a sampled background. Stroke direction is
 * the opposite luminance to the background; width scales with font size.
 */
function computeStrokeForColor(
  hex: string,
  bgColor: RGB,
  lineHeight: number,
): { "-webkit-text-stroke": string; "paint-order": string } | null {
  const textColor = parseHexColor(hex)
  if (contrastRatio(textColor, bgColor) >= 3.0) return null
  const bgLum = relativeLuminance(bgColor)
  const strokeColor = bgLum > 0.5 ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.6)"
  const strokeWidth = Math.max(1, Math.round(lineHeight * 0.06))
  return {
    "-webkit-text-stroke": `${strokeWidth}px ${strokeColor}`,
    "paint-order": "stroke fill",
  }
}

/**
 * Apply contrast strokes per segment by mutating the segment's `style` map.
 * Returning the mutated segments lets the caller serialise them into
 * `data-segments` so the runtime translation/rebuild path
 * (`assets/adt/modules/translations.js`) emits spans with the stroke too.
 * Spans whose colour already meets the WCAG AA large-text threshold (3:1)
 * are passed through unchanged.
 */
function applyContrastStrokesToSegments(
  segments: SectionTextSegment[] | undefined,
  bgColor: RGB,
  lineHeight: number,
): SectionTextSegment[] | undefined {
  if (!segments || segments.length === 0) return segments
  return segments.map((seg) => {
    const colorRaw = seg.style?.color
    const colorMatch = colorRaw?.match(/^#([0-9a-fA-F]{6})$/)
    if (!colorMatch) return seg
    const stroke = computeStrokeForColor(colorMatch[1], bgColor, lineHeight)
    if (!stroke) return seg
    return { ...seg, style: { ...seg.style, ...stroke } }
  })
}

// ── Fixed-Layout Page Sectioning ───────────────────────────────────

/**
 * Input shape for building a fixed-layout section. `drawItems` is the
 * authoritative draw sequence from extraction — array order IS z-order.
 * Image items are kept only when their `imageId` is in `availableImageIds`
 * (i.e. the image survived image-filtering).
 */
export interface FixedLayoutSectionInput {
  pageId: string
  pageNumber: number
  viewport: { width: number; height: number }
  drawItems: DrawItem[]
  /**
   * Set of imageIds that passed image-filtering. Image draw-items whose
   * imageId isn't in this set are dropped from the section.
   */
  availableImageIds: Set<string>
}

/**
 * Produce a `PageSectioningOutput` for a fixed-layout page. The section's
 * `nodes` array mirrors `drawItems` order — each kept image becomes a
 * `role: "image"` leaf, each paragraph becomes a `role: "text"` leaf.
 * Wrapped lines that share a `mergedParagraphId` are collapsed into a
 * single text leaf with concatenated text + segments. Sentence boundaries
 * inside the same speech bubble keep separate leaves.
 *
 * PDF coordinates, segment styling, blockBounds, blend/clip metadata, etc.
 * live on `section.placement[nodeId]` (out-of-band) so the tree itself
 * stays a clean semantic structure that downstream tree-walkers
 * (text-catalog, validators) can process unchanged.
 */
export function sectionFixedLayoutPage(
  input: FixedLayoutSectionInput,
): PageSectioningOutput {
  const { pageId, pageNumber, viewport, drawItems, availableImageIds } = input

  const nodes: ContentNodeData[] = []
  const placement: Record<string, NodePlacement> = {}
  // State for the in-flight merge: the leaf we'd append to, its placement
  // (mutable; same reference stored in `placement`), the merged-id of its
  // trailing line, and that line's original text — we read the trailing
  // text to decide hyphen vs. space joining.
  let lastLeaf: ContentNodeData | null = null
  let lastLeafPlacement: NodePlacement | null = null
  let lastMergedId: string | undefined
  let lastItemText: string | null = null

  for (const item of drawItems) {
    if (item.kind === "image") {
      // An image breaks any in-flight text merge — even if the next text
      // shares an id, appending past the image would reorder DOM.
      lastLeaf = null
      lastLeafPlacement = null
      lastMergedId = undefined
      lastItemText = null
      if (!availableImageIds.has(item.imageId)) continue
      nodes.push({
        nodeId: item.imageId,
        role: "image",
        isPruned: false,
      })
      placement[item.imageId] = {
        bounds: item.bounds,
        ...(item.clipPath ? { clipPath: item.clipPath } : {}),
        ...(item.blendMode ? { blendMode: item.blendMode } : {}),
        ...(typeof item.opacity === "number" ? { opacity: item.opacity } : {}),
      }
      continue
    }

    const canMerge =
      lastLeaf !== null &&
      lastLeafPlacement !== null &&
      lastItemText !== null &&
      item.mergedParagraphId !== undefined &&
      item.mergedParagraphId === lastMergedId
    if (canMerge && lastLeaf && lastLeafPlacement && lastItemText !== null) {
      appendContinuationLine(lastLeaf, lastLeafPlacement, item, lastItemText)
      lastItemText = item.text
      continue
    }

    const leaf: ContentNodeData = {
      nodeId: item.textId,
      role: "text",
      isPruned: false,
      text: item.text,
    }
    const leafPlacement: NodePlacement = {
      position: {
        top: Math.round(item.top),
        left: Math.round(item.left),
        lineHeight: Math.round(item.lineHeight),
      },
      ...(item.segments !== undefined ? { segments: item.segments } : {}),
      ...(item.blockId !== undefined ? { blockId: item.blockId } : {}),
      ...(item.blockBounds !== undefined ? { blockBounds: item.blockBounds } : {}),
      ...(item.textAlign !== undefined ? { textAlign: item.textAlign } : {}),
    }
    nodes.push(leaf)
    placement[item.textId] = leafPlacement
    lastLeaf = leaf
    lastLeafPlacement = leafPlacement
    lastMergedId = item.mergedParagraphId
    lastItemText = item.text
  }

  // Slice each block's height across the leaves that share it. Without
  // this, multiple absolutely-positioned <p>s in one block all use the
  // full block height (blockBounds.height) and stack with overlapping
  // boxes — e.g. "LISTEN. PREPARE." and "STAY AWARE!" in the same
  // bubble both get height:55, but their tops are 25 apart, so a 30 px
  // overlap covers the second paragraph's content.
  const byBlock = new Map<string, NodePlacement[]>()
  for (const node of nodes) {
    if (node.role !== "text") continue
    const p = placement[node.nodeId]
    if (!p?.blockId || !p.blockBounds || !p.position) continue
    const list = byBlock.get(p.blockId)
    if (list) list.push(p)
    else byBlock.set(p.blockId, [p])
  }
  for (const list of byBlock.values()) {
    if (list.length < 2) continue // single leaf — full blockBounds.height is correct.
    list.sort((a, b) => a.position!.top - b.position!.top)
    for (let i = 0; i < list.length; i++) {
      const cur = list[i]
      const next = list[i + 1]
      const top = cur.position!.top
      const bottom = next ? next.position!.top : cur.blockBounds!.y + cur.blockBounds!.height
      // Floor at one lineHeight so degenerate slices still hold a line of
      // text. The auto-fit script tolerates the ~0.2× per-line glyph
      // overhead between scrollHeight and clientHeight, so we don't need
      // to over-allocate the layout box here.
      cur.renderHeight = Math.max(bottom - top, cur.position!.lineHeight)
    }
  }

  const section: PageSectioningSection = {
    sectionId: `${pageId}_sec001`,
    sectionType: "fixed-layout-page",
    nodes,
    placement,
    backgroundColor: "#ffffff",
    textColor: "#000000",
    pageNumber,
    isPruned: false,
    viewport,
  }

  return {
    reasoning: "Fixed-layout mode: entire page is a single section; nodes are in PDF draw-sequence order so z-stacking is preserved by HTML DOM order. Wrapped lines that the continuation heuristic identified as one logical paragraph are collapsed into a single text leaf.",
    sections: [section],
  }
}

/**
 * Append a continuation line to an existing text leaf. `prevLineText` is
 * the untouched text of the line that ends the leaf — we test its tail
 * for a hyphen to choose between hyphen-join (no separator, drop the
 * boundary whitespace) and word-wrap join (single space between).
 *
 * Mutates `leaf.text` and `placement.segments` in place.
 */
function appendContinuationLine(
  leaf: ContentNodeData,
  placement: NodePlacement,
  item: { text: string; segments?: SectionTextSegment[] },
  prevLineText: string,
): void {
  const hyphenJoin = prevLineText.endsWith("-")
  const currentText = leaf.text ?? ""

  if (hyphenJoin) {
    leaf.text = currentText.replace(/\s+$/, "") + item.text.replace(/^\s+/, "")
    if (placement.segments && placement.segments.length > 0) {
      const lastIdx = placement.segments.length - 1
      placement.segments[lastIdx] = {
        ...placement.segments[lastIdx],
        text: placement.segments[lastIdx].text.replace(/\s+$/, ""),
      }
    }
    if (item.segments && item.segments.length > 0) {
      const trimmedFirst = {
        ...item.segments[0],
        text: item.segments[0].text.replace(/^\s+/, ""),
      }
      placement.segments = [...(placement.segments ?? []), trimmedFirst, ...item.segments.slice(1)]
    }
    return
  }

  // Word-wrap join: ensure exactly one space between the two lines. PDF
  // lines often already have a trailing space on prev or a leading space
  // on current; only insert one if neither side carries it.
  const prevHasTrailing = /\s$/.test(currentText)
  const currHasLeading = /^\s/.test(item.text)
  const needsSpace = !prevHasTrailing && !currHasLeading

  leaf.text = currentText + (needsSpace ? " " : "") + item.text
  if (needsSpace && placement.segments && placement.segments.length > 0) {
    const lastIdx = placement.segments.length - 1
    placement.segments[lastIdx] = {
      ...placement.segments[lastIdx],
      text: placement.segments[lastIdx].text + " ",
    }
  }
  if (item.segments) {
    placement.segments = [...(placement.segments ?? []), ...item.segments]
  }
}

/**
 * Build the inner HTML for a paragraph `<p>` from structured segments.
 * Emits one `<span>` per styled run (bare text for runs without styling
 * to keep markup compact). Later slices will swap these spans for
 * per-word spans with SMIL-referenceable IDs.
 */
function renderSegmentsToHtml(segments: SectionTextSegment[] | undefined): string {
  if (!segments || segments.length === 0) return ""
  const parts: string[] = []
  for (const seg of segments) {
    const styleStr = seg.style ? styleMapToInline(seg.style) : ""
    const text = escapeHtml(seg.text)
    if (styleStr) {
      parts.push(`<span style="${styleStr}">${text}</span>`)
    } else {
      parts.push(text)
    }
  }
  return parts.join("")
}

function styleMapToInline(style: Record<string, string>): string {
  return Object.entries(style)
    .map(([k, v]) => `${k}:${k === "font-family" ? withBundledFallback(v) : v}`)
    .join(";")
}

/**
 * Append `Merriweather` to a font-family chain so spans whose declared
 * fonts (MuseoSans, Chokle, etc.) aren't bundled fall back to the
 * actually-loaded Merriweather instead of system `serif`. Without this
 * fallback, `document.fonts.ready` resolves immediately because no
 * declared face is loading, and the auto-fit script then measures
 * against system Times — giving widely different metrics than the
 * source PDF, which causes over-shrinking.
 *
 * Already includes Merriweather (case-insensitive) → unchanged.
 * Generic family terminator (serif/sans-serif/monospace/etc.) → insert
 * Merriweather just before it. No generic terminator → append both.
 */
function withBundledFallback(fontFamily: string): string {
  if (/\bmerriweather\b/i.test(fontFamily)) return fontFamily
  const generics = /\b(serif|sans-serif|monospace|cursive|fantasy|system-ui)\b/i
  const m = fontFamily.match(generics)
  if (m) {
    const idx = fontFamily.toLowerCase().lastIndexOf(m[0].toLowerCase())
    return fontFamily.slice(0, idx) + "Merriweather," + fontFamily.slice(idx)
  }
  return fontFamily.replace(/\s*$/, "") + ",Merriweather,serif"
}

// ── Fixed-Layout Web Rendering ─────────────────────────────────────

/**
 * Produce fixed-layout HTML from a pre-built `PageSectioningSection`.
 * Walks the section's `nodes` tree (image and text leaves) and looks up
 * placement metadata in `section.placement[nodeId]`. Downstream edit /
 * translation flows can mutate node text + placement and re-call this to
 * get a correctly-positioned HTML output.
 */
export function renderFixedLayoutPage(
  section: PageSectioningSection,
  imageUrlPrefix: string,
  options?: {
    backgroundSampler?: BackgroundSampler
    /** Scale for sampler coordinates — sampler operates in render-pixel
     *  space (the original page image); section positions are in viewport
     *  coordinates. Multiplying by `renderScale` converts back. */
    renderScale?: number
  },
): WebRenderingOutput {
  const viewport = section.viewport
  if (!viewport) {
    throw new Error(
      `Fixed-layout section ${section.sectionId} is missing viewport dimensions`,
    )
  }
  const placement = section.placement ?? {}
  const sampler = options?.backgroundSampler
  const renderScale = options?.renderScale ?? 1

  // Emit every drawable leaf (image or text) as a direct sibling of
  // `#content`, in section-node order. Tree order = PDF draw order = HTML
  // DOM order = z-stacking, so later items naturally appear on top.
  const elements: string[] = []
  for (const node of section.nodes) {
    if (node.isPruned) continue
    const p = placement[node.nodeId]
    if (node.role === "image") {
      if (!p?.bounds) continue
      const url = `${imageUrlPrefix}/${node.nodeId}`
      const { x, y, width, height } = p.bounds
      let imgStyle = `position:absolute;top:${Math.round(y)}px;left:${Math.round(x)}px;width:${Math.round(width)}px;height:${Math.round(height)}px`
      // Apply the PDF clip path captured during extraction. The `d` string is
      // in absolute viewport coords; we translate via `transform` on the
      // <path> element so the inner coords stay readable for debugging,
      // while userSpaceOnUse interprets them relative to the <img>'s box
      // (top-left origin). EPUB3 readers (Apple Books, ADE, Thorium,
      // Calibre) all support this combination.
      if (p.clipPath) {
        const clipId = `clip-${node.nodeId}`
        elements.push(
          `  <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><path d="${escapeHtmlAttr(p.clipPath)}" transform="translate(${-Math.round(x)},${-Math.round(y)})"/></clipPath></defs></svg>`,
        )
        imgStyle += `;clip-path:url(#${clipId})`
      }
      // PDF blend modes (commonly Multiply in watercolor storybooks) make
      // image backgrounds composite as transparent. Reproduce via
      // `mix-blend-mode`.
      if (p.blendMode) {
        imgStyle += `;mix-blend-mode:${p.blendMode}`
      }
      if (typeof p.opacity === "number" && p.opacity < 1) {
        imgStyle += `;opacity:${p.opacity}`
      }
      elements.push(
        `  <img src="${escapeHtml(url)}" alt="" data-id="${node.nodeId}" style="${imgStyle}"/>`)
    } else if (node.role === "text") {
      if (!p?.position) continue // Reflowable text leaves shouldn't appear in fixed-layout sections; skip defensively
      const { top, lineHeight } = p.position
      // When the leaf carries a block bounds (i.e. clustering ran and
      // identified the visual container), render the paragraph spanning
      // the full block width with the inferred text-align — this lets a
      // translation re-flow inside the original bubble. Without
      // blockBounds (legacy data), fall back to single-line legacy
      // behaviour (anchor at the line's own left, no width constraint).
      const renderLeft = p.blockBounds ? Math.round(p.blockBounds.x) : p.position.left
      // When we have block geometry, pin the paragraph to the full block
      // box (width + height) and tag it with data-adt-fit so the runtime
      // auto-fit script can shrink letter-spacing/font-size to make the
      // text actually fit. We deliberately leave overflow visible: cases
      // we haven't characterised should overflow visibly so they're easy
      // to spot rather than getting silently clipped. The auto-fit
      // script's fits() check uses scrollHeight/scrollWidth which work
      // regardless of overflow setting.
      const widthRule = p.blockBounds ? `;width:${Math.round(p.blockBounds.width)}px` : ""
      // renderHeight is stamped at sectioning when multiple leaves share
      // a block (each gets its own slice of the block height); for blocks
      // with a single leaf the full blockBounds.height is correct.
      const heightValue = p.blockBounds
        ? p.renderHeight !== undefined ? p.renderHeight : p.blockBounds.height
        : undefined
      const heightRule = heightValue !== undefined ? `;height:${Math.round(heightValue)}px` : ""
      const alignRule = p.textAlign ? `;text-align:${p.textAlign}` : ""
      // line-height needs to fit the LARGEST segment's font-size, not
      // just mupdf's reported lineHeight (which it computes from the
      // first/dominant run). Without this, mixed-size paragraphs like
      // "Remember the warning signs." (11.5px body + 24px decorative)
      // overflow their 12px line box and the auto-fit's blanket scale
      // produces uneven results. Use the biggest segment fontSize when
      // segments mix sizes; fall back to the leaf's lineHeight otherwise.
      const effectiveLineHeight = pickEffectiveLineHeight(p.segments, lineHeight)
      const style = `position:absolute;top:${top}px;left:${renderLeft}px;line-height:${effectiveLineHeight}px${widthRule}${heightRule}${alignRule}`

      // Apply contrast strokes at the segment level (not on the rendered
      // HTML afterwards) so the stroke style flows into both the inline
      // `<span>` rendering AND the `data-segments` JSON. Without this, the
      // runtime rebuild on language switch / inline edit re-emits spans
      // from `data-segments` and drops the stroke — low-contrast text
      // becomes invisible against the page background again.
      let segments = p.segments
      if (sampler) {
        const sampleWidth = p.blockBounds ? p.blockBounds.width : lineHeight * 3
        const bgColor = sampler.sample(
          renderLeft * renderScale,
          top * renderScale,
          sampleWidth * renderScale,
          lineHeight * renderScale,
        )
        segments = applyContrastStrokesToSegments(segments, bgColor, lineHeight)
      }
      const content = renderSegmentsToHtml(segments) || escapeHtml(node.text ?? "")

      // `data-segments` carries the structured styling inline so the viewer
      // can rebuild the styled span structure after any text swap (language
      // switch, inline edit) without losing font / colour / size / stroke.
      const segmentsAttr = segments && segments.length > 0
        ? ` data-segments="${escapeHtmlAttr(JSON.stringify(segments))}"`
        : ""
      const fitAttr = p.blockBounds ? ` data-adt-fit="1"` : ""
      elements.push(
        `  <p data-id="${node.nodeId}"${segmentsAttr}${fitAttr} style="${style}">${content}</p>`)
    }
  }

  const hasFitTargets = elements.some((el) => el.includes("data-adt-fit=\"1\""))
  const fitScript = hasFitTargets ? `\n${FIT_SCRIPT}` : ""
  const html = `<div id="content" style="position:relative;width:${viewport.width}px;height:${viewport.height}px;margin:0 auto;overflow:hidden">
${elements.join("\n")}${fitScript}
</div>`

  return {
    sections: [
      {
        sectionIndex: 0,
        sectionType: "fixed-layout-page",
        reasoning: "Fixed-layout: rendered from positioned section JSON (text + image bounds).",
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
    // Render whatever image-filtering left unpruned. The wizard writes
    // `image_filters` values for fixed-layout books that disable size /
    // complexity / LLM-meaningfulness pruning, so in practice every
    // extracted image survives except the full-page render itself (which
    // image-filtering always prunes — using it as a background would
    // double-draw the page).
    const allImages = storage.getPageImages(page.pageId)
    const pageRender = allImages.find((img) => img.imageId.endsWith("_page"))
    const classRow = storage.getLatestNodeData("image-filtering", page.pageId)
    const classification = classRow ? (classRow.data as ImageClassificationOutput) : null
    const availableImageIds = new Set(
      classification
        ? classification.images.filter((c) => !c.isPruned).map((c) => c.imageId)
        : []
    )

    const posTextRow = storage.getLatestNodeData("positioned-text", page.pageId)
    const positionedText = posTextRow ? (posTextRow.data as PositionedTextOutput) : null

    // Viewport comes from the positioned-text extraction (authoritative PDF
    // page dimensions). Fall back to the page render's pixel size only when
    // no positioned text was extracted at all.
    const viewport = positionedText
      ? { width: Math.round(positionedText.pageWidth), height: Math.round(positionedText.pageHeight) }
      : pageRender
        ? { width: pageRender.width, height: pageRender.height }
        : null
    if (!viewport) continue
    const renderScale = positionedText ? positionedText.renderWidth / positionedText.pageWidth : 1

    const drawItems: DrawItem[] = positionedText?.drawItems ?? []

    const sectioning = sectionFixedLayoutPage({
      pageId: page.pageId,
      pageNumber: page.pageNumber,
      viewport,
      drawItems,
      availableImageIds,
    })
    storage.putNodeData("page-sectioning", page.pageId, sectioning)

    // Contrast sampler: always built from the page render when available,
    // regardless of how the page is composed visually. The page render is an
    // accurate preview of the final composited page, so sampling it gives a
    // correct answer to "what is under this text?" for stroke-contrast decisions.
    let backgroundSampler: BackgroundSampler | undefined
    if (pageRender) {
      try {
        const imgBase64 = storage.getImageBase64(pageRender.imageId)
        const imgBuffer = Buffer.from(imgBase64, "base64")
        const rawSampler = createBackgroundSampler(imgBuffer)
        if (rawSampler) {
          const imgW = pageRender.width
          const imgH = pageRender.height
          const viewportPxW = viewport.width * renderScale
          const viewportPxH = viewport.height * renderScale
          // Map render-pixel sampler coords (viewport × renderScale) to the
          // page render image's pixel coords.
          backgroundSampler = {
            sample(rx, ry, rw, rh) {
              const ix = rx * (imgW / viewportPxW)
              const iy = ry * (imgH / viewportPxH)
              const iw = rw * (imgW / viewportPxW)
              const ih = rh * (imgH / viewportPxH)
              if (ix + iw < 0 || iy + ih < 0 || ix > imgW || iy > imgH) {
                return { r: 255, g: 255, b: 255 }
              }
              return rawSampler.sample(ix, iy, iw, ih)
            },
          }
        }
      } catch {
        // Page render not available — skip contrast checking
      }
    }

    const rendering = renderFixedLayoutPage(
      sectioning.sections[0],
      imageUrlPrefix,
      { backgroundSampler, renderScale },
    )
    storage.putNodeData("web-rendering", page.pageId, rendering)
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Escape a JSON string for embedding inside a double-quoted HTML attribute.
 * `&` and `"` are entity-encoded; browsers decode them when calling
 * `.getAttribute()`, so `JSON.parse(el.getAttribute("data-segments"))` works.
 */
function escapeHtmlAttr(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Pick the line-height to apply on the paragraph `<p>`. mupdf's
 * `position.lineHeight` is the line-height of the first/dominant
 * run on that line, which is wrong for mixed-size paragraphs — a 24 px
 * decorative segment inside an 11.5 px body line gets clipped/overflows
 * the 12 px line box.
 *
 * Strategy: take the largest segment font-size when (a) segments are
 * present and (b) at least one segment exceeds the fallback. Single-size
 * segments and segments-without-fontSize fall through to `fallbackLineHeight`.
 */
function pickEffectiveLineHeight(
  segments: SectionTextSegment[] | undefined,
  fallbackLineHeight: number,
): number {
  if (!segments || segments.length === 0) return fallbackLineHeight
  let maxFontSize = 0
  for (const seg of segments) {
    const fsRaw = seg.style?.["font-size"]
    if (!fsRaw) continue
    const fs = parseFloat(fsRaw)
    if (!Number.isFinite(fs) || fs <= 0) continue
    if (fs > maxFontSize) maxFontSize = fs
  }
  if (maxFontSize <= fallbackLineHeight) return fallbackLineHeight
  return maxFontSize
}

/**
 * `<script src>` reference to the shared auto-fit script. The actual
 * logic lives in `assets/adt/auto-fit.js` so the same file is used in
 * both packaged-book pages (loaded by URL) and the studio storyboard
 * preview (loaded by URL into the iframe shell). Keeping a single
 * source of truth avoids the drift we ran into with two inline copies.
 */
const FIT_SCRIPT = `<script src="./assets/auto-fit.js"></script>`
