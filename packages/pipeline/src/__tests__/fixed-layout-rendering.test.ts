import { describe, it, expect, afterEach } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { sectionFixedLayoutPage, renderFixedLayoutPage, contrastRatio, createBackgroundSampler, processFixedLayoutPages } from "../fixed-layout-rendering.js"
import type { ContentNodeData, DrawItem, NodePlacement, PageSectioningSection, PositionedTextOutput } from "@adt/types"
import type { ExtractedImage } from "@adt/pdf"
import { createBookStorage } from "@adt/storage"
import { PNG } from "pngjs"

/** Find the first text leaf inside a section (no nested containers in fixed layout). */
function firstTextLeaf(section: PageSectioningSection): ContentNodeData | undefined {
  return section.nodes.find((n) => n.role === "text")
}

function textLeaves(section: PageSectioningSection): ContentNodeData[] {
  return section.nodes.filter((n) => n.role === "text")
}

function imageLeaves(section: PageSectioningSection): ContentNodeData[] {
  return section.nodes.filter((n) => n.role === "image")
}

function placementOf(section: PageSectioningSection, nodeId: string): NodePlacement | undefined {
  return section.placement?.[nodeId]
}

describe("sectionFixedLayoutPage", () => {
  const viewport = { width: 400, height: 300 }

  it("produces one section per page with an image leaf for the background", () => {
    const drawItems: DrawItem[] = [
      { kind: "image", imageId: "pg001_im001", bounds: { x: 0, y: 0, width: 400, height: 300 } },
    ]
    const result = sectionFixedLayoutPage({
      pageId: "pg001",
      pageNumber: 1,
      viewport,
      drawItems,
      availableImageIds: new Set(["pg001_im001"]),
    })

    expect(result.sections).toHaveLength(1)
    const section = result.sections[0]
    expect(section.sectionId).toBe("pg001_sec001")
    expect(section.sectionType).toBe("fixed-layout-page")
    expect(section.isPruned).toBe(false)
    expect(section.pageNumber).toBe(1)
    expect(section.viewport).toEqual(viewport)

    expect(section.nodes).toHaveLength(1)
    expect(section.nodes[0]).toEqual({
      nodeId: "pg001_im001",
      role: "image",
      isPruned: false,
    })
    expect(placementOf(section, "pg001_im001")).toEqual({
      bounds: { x: 0, y: 0, width: 400, height: 300 },
    })
  })

  it("emits text leaves with their nodeId (textId) and position", () => {
    const drawItems: DrawItem[] = [
      { kind: "image", imageId: "pg001_im001", bounds: { x: 0, y: 0, width: 400, height: 300 } },
      {
        kind: "paragraph",
        textId: "pg001_p000",
        top: 100,
        left: 72,
        lineHeight: 48,
        segments: [{ text: "hello", style: { color: "#000000" } }],
        text: "hello",
      },
    ]
    const result = sectionFixedLayoutPage({
      pageId: "pg001",
      pageNumber: 1,
      viewport,
      drawItems,
      availableImageIds: new Set(["pg001_im001"]),
    })
    const section = result.sections[0]

    const leaves = textLeaves(section)
    expect(leaves).toHaveLength(1)
    expect(leaves[0].nodeId).toBe("pg001_p000")
    expect(leaves[0].text).toBe("hello")

    const p = placementOf(section, "pg001_p000")!
    expect(p.position).toEqual({ top: 100, left: 72, lineHeight: 48 })
    expect(p.segments).toEqual([{ text: "hello", style: { color: "#000000" } }])
  })

  it("preserves draw order — later items appear later in nodes", () => {
    const drawItems: DrawItem[] = [
      { kind: "image", imageId: "pg001_im001", bounds: { x: 0, y: 0, width: 400, height: 300 } },
      {
        kind: "paragraph",
        textId: "pg001_p000",
        top: 50,
        left: 50,
        lineHeight: 20,
        segments: [{ text: "under" }],
        text: "under",
      },
      { kind: "image", imageId: "pg001_im002", bounds: { x: 10, y: 20, width: 30, height: 40 } },
      {
        kind: "paragraph",
        textId: "pg001_p001",
        top: 100,
        left: 100,
        lineHeight: 20,
        segments: [{ text: "over" }],
        text: "over",
      },
    ]
    const result = sectionFixedLayoutPage({
      pageId: "pg001",
      pageNumber: 1,
      viewport,
      drawItems,
      availableImageIds: new Set(["pg001_im001", "pg001_im002"]),
    })

    const nodes = result.sections[0].nodes
    expect(nodes).toHaveLength(4)
    expect(nodes[0]).toMatchObject({ nodeId: "pg001_im001", role: "image" })
    expect(nodes[1]).toMatchObject({ nodeId: "pg001_p000", role: "text" })
    expect(nodes[2]).toMatchObject({ nodeId: "pg001_im002", role: "image" })
    expect(nodes[3]).toMatchObject({ nodeId: "pg001_p001", role: "text" })
  })

  it("merges consecutive same-mergedParagraphId draw items into one text leaf", () => {
    // "Move away from the volcano" wrapping to "as fast as possible." — the
    // continuation heuristic stamps both lines with the same mergedParagraphId.
    // Sectioning collapses them into a single text leaf whose text joins
    // the two lines with a single space.
    const blockBounds = { x: 113, y: 410, width: 165, height: 35 }
    const drawItems: DrawItem[] = [
      {
        kind: "paragraph",
        textId: "pg001_p001",
        top: 410,
        left: 113,
        lineHeight: 12,
        segments: [{ text: "Move away from the volcano " }],
        text: "Move away from the volcano ",
        blockId: "b001",
        blockBounds,
        mergedParagraphId: "b001_p01",
        textAlign: "center",
      },
      {
        kind: "paragraph",
        textId: "pg001_p002",
        top: 433,
        left: 142,
        lineHeight: 12,
        segments: [{ text: "as fast as possible." }],
        text: "as fast as possible.",
        blockId: "b001",
        blockBounds,
        mergedParagraphId: "b001_p01",
        textAlign: "center",
      },
    ]
    const result = sectionFixedLayoutPage({
      pageId: "pg001",
      pageNumber: 1,
      viewport,
      drawItems,
      availableImageIds: new Set(),
    })
    const section = result.sections[0]

    const leaves = textLeaves(section)
    expect(leaves).toHaveLength(1)
    expect(leaves[0].text).toBe("Move away from the volcano as fast as possible.")
    const p = placementOf(section, leaves[0].nodeId)!
    expect(p.position).toEqual({ top: 410, left: 113, lineHeight: 12 })
    expect(p.textAlign).toBe("center")
    expect(p.blockBounds).toEqual(blockBounds)
  })

  it("keeps sentence-boundary lines as separate leaves inside the same block", () => {
    const blockBounds = { x: 113, y: 386, width: 165, height: 60 }
    const drawItems: DrawItem[] = [
      {
        kind: "paragraph",
        textId: "pg001_p001",
        top: 387,
        left: 116,
        lineHeight: 12,
        segments: [{ text: "Follow the evacuation plan. " }],
        text: "Follow the evacuation plan. ",
        blockId: "b001",
        blockBounds,
        mergedParagraphId: "b001_p01",
      },
      {
        kind: "paragraph",
        textId: "pg001_p002",
        top: 410,
        left: 113,
        lineHeight: 12,
        segments: [{ text: "Move away from the volcano " }],
        text: "Move away from the volcano ",
        blockId: "b001",
        blockBounds,
        mergedParagraphId: "b001_p02",
      },
    ]
    const result = sectionFixedLayoutPage({
      pageId: "pg001",
      pageNumber: 1,
      viewport,
      drawItems,
      availableImageIds: new Set(),
    })

    expect(textLeaves(result.sections[0])).toHaveLength(2)
  })

  it("joins hyphen-wrapped words without a space between", () => {
    const drawItems: DrawItem[] = [
      {
        kind: "paragraph",
        textId: "pg001_p001",
        top: 100,
        left: 50,
        lineHeight: 12,
        segments: [{ text: "super-" }],
        text: "super-",
        mergedParagraphId: "b001_p01",
      },
      {
        kind: "paragraph",
        textId: "pg001_p002",
        top: 115,
        left: 50,
        lineHeight: 12,
        segments: [{ text: "Computers" }],
        text: "Computers",
        mergedParagraphId: "b001_p01",
      },
    ]
    const result = sectionFixedLayoutPage({
      pageId: "pg001",
      pageNumber: 1,
      viewport,
      drawItems,
      availableImageIds: new Set(),
    })

    const leaves = textLeaves(result.sections[0])
    expect(leaves).toHaveLength(1)
    expect(leaves[0].text).toBe("super-Computers")
  })

  it("does not merge across an image draw-item even when ids match", () => {
    const drawItems: DrawItem[] = [
      {
        kind: "paragraph",
        textId: "pg001_p001",
        top: 100,
        left: 50,
        lineHeight: 12,
        segments: [{ text: "first " }],
        text: "first ",
        mergedParagraphId: "b001_p01",
      },
      { kind: "image", imageId: "pg001_im001", bounds: { x: 0, y: 0, width: 100, height: 100 } },
      {
        kind: "paragraph",
        textId: "pg001_p002",
        top: 115,
        left: 50,
        lineHeight: 12,
        segments: [{ text: "second" }],
        text: "second",
        mergedParagraphId: "b001_p01",
      },
    ]
    const result = sectionFixedLayoutPage({
      pageId: "pg001",
      pageNumber: 1,
      viewport,
      drawItems,
      availableImageIds: new Set(["pg001_im001"]),
    })

    expect(textLeaves(result.sections[0])).toHaveLength(2)
  })

  it("drops image items whose imageId isn't available (pruned by filtering)", () => {
    const drawItems: DrawItem[] = [
      { kind: "image", imageId: "pg001_im001", bounds: { x: 0, y: 0, width: 400, height: 300 } },
      { kind: "image", imageId: "pg001_im002", bounds: { x: 10, y: 20, width: 30, height: 40 } },
    ]
    const result = sectionFixedLayoutPage({
      pageId: "pg001",
      pageNumber: 1,
      viewport,
      drawItems,
      availableImageIds: new Set(["pg001_im001"]), // im002 pruned
    })
    const section = result.sections[0]

    const images = imageLeaves(section)
    expect(images).toHaveLength(1)
    expect(images[0].nodeId).toBe("pg001_im001")
  })
})

describe("renderFixedLayoutPage", () => {
  const viewport = { width: 400, height: 300 }

  function makeSection(overrides: Partial<Parameters<typeof sectionFixedLayoutPage>[0]> = {}) {
    const palatinoBlackStyle = {
      "font-family": "Palatino,serif",
      "font-size": "48px",
      color: "#000000",
    }
    const defaultItems: DrawItem[] = [
      { kind: "image", imageId: "pg001_im001", bounds: { x: 0, y: 0, width: 400, height: 300 } },
      {
        kind: "paragraph",
        textId: "pg001_p000",
        top: 100,
        left: 72,
        lineHeight: 48,
        segments: [{ text: "I am a little girl.", style: palatinoBlackStyle }],
        text: "I am a little girl.",
      },
      {
        kind: "paragraph",
        textId: "pg001_p001",
        top: 158,
        left: 72,
        lineHeight: 48,
        segments: [{ text: "My name is Sue.", style: palatinoBlackStyle }],
        text: "My name is Sue.",
      },
    ]
    return sectionFixedLayoutPage({
      pageId: "pg001",
      pageNumber: 1,
      viewport,
      drawItems: defaultItems,
      availableImageIds: new Set(["pg001_im001"]),
      ...overrides,
    }).sections[0]
  }

  it("produces a single section with fixed-layout-page type", () => {
    const result = renderFixedLayoutPage(makeSection(), "/images")

    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].sectionType).toBe("fixed-layout-page")
    expect(result.sections[0].sectionIndex).toBe(0)
  })

  it("includes viewport dimensions in the HTML", () => {
    const html = renderFixedLayoutPage(makeSection(), "/images").sections[0].html

    expect(html).toContain("width:400px")
    expect(html).toContain("height:300px")
  })

  it("includes illustration image reference", () => {
    const html = renderFixedLayoutPage(makeSection(), "/images").sections[0].html

    expect(html).toContain('src="/images/pg001_im001"')
    expect(html).toContain('data-id="pg001_im001"')
  })

  it("includes positioned paragraphs with data-id attributes", () => {
    const html = renderFixedLayoutPage(makeSection(), "/images").sections[0].html

    expect(html).toContain('data-id="pg001_p000"')
    expect(html).toContain('data-id="pg001_p001"')
    expect(html).toContain("I am a little girl.")
    expect(html).toContain("My name is Sue.")
  })

  it("emits width + text-align on a paragraph that carries blockBounds", () => {
    const blockBounds = { x: 113, y: 410, width: 165, height: 12 }
    const drawItems: DrawItem[] = [
      { kind: "image", imageId: "pg001_im001", bounds: { x: 0, y: 0, width: 400, height: 300 } },
      {
        kind: "paragraph",
        textId: "pg001_p000",
        top: 410,
        left: 142,
        lineHeight: 12,
        segments: [{ text: "as fast as possible." }],
        text: "as fast as possible.",
        blockId: "b001",
        blockBounds,
        mergedParagraphId: "b001_p01",
        textAlign: "center",
      },
    ]
    const section = sectionFixedLayoutPage({
      pageId: "pg001",
      pageNumber: 1,
      viewport,
      drawItems,
      availableImageIds: new Set(["pg001_im001"]),
    }).sections[0]

    const html = renderFixedLayoutPage(section, "/images").sections[0].html

    // Renders at the block's left (113), not the line's left (142), so the
    // line re-centres against the block's full width when translated.
    expect(html).toContain("left:113px")
    expect(html).toContain("width:165px")
    expect(html).toContain("text-align:center")
  })

  it("pins height + data-adt-fit when blockBounds is set (overflow stays visible)", () => {
    const blockBounds = { x: 184, y: 22, width: 40, height: 16 }
    const drawItems: DrawItem[] = [
      { kind: "image", imageId: "pg001_im001", bounds: { x: 0, y: 0, width: 400, height: 300 } },
      {
        kind: "paragraph",
        textId: "pg001_p000",
        top: 22,
        left: 184,
        lineHeight: 12,
        segments: [{ text: "C O P E" }],
        text: "C O P E",
        blockId: "b000",
        blockBounds,
        mergedParagraphId: "b000_p01",
      },
    ]
    const section = sectionFixedLayoutPage({
      pageId: "pg001",
      pageNumber: 1,
      viewport,
      drawItems,
      availableImageIds: new Set(["pg001_im001"]),
    }).sections[0]

    const html = renderFixedLayoutPage(section, "/images").sections[0].html

    expect(html).toContain('data-adt-fit="1"')
    expect(html).toContain("height:16px")
    // overflow stays visible on the text leaf's <p> — content that
    // doesn't auto-fit overflows visibly rather than getting silently
    // clipped. The page-level #content wrapper keeps overflow:hidden.
    const pStyleMatch = html.match(/<p[^>]*data-id="pg001_p000"[^>]*style="([^"]*)"/)
    expect(pStyleMatch).not.toBeNull()
    expect(pStyleMatch![1]).not.toContain("overflow:")
    // Script reference is injected once when at least one fit-target
    // exists. Loaded by URL from the shared assets/adt/auto-fit.js so
    // studio + EPUB + web export run identical code.
    expect(html).toContain('<script src="./assets/auto-fit.js"></script>')
    expect(html.match(/<script src="\.\/assets\/auto-fit\.js"><\/script>/g)?.length).toBe(1)
  })

  it("does not inject the auto-fit script when no leaf has blockBounds", () => {
    const drawItems: DrawItem[] = [
      { kind: "image", imageId: "pg001_im001", bounds: { x: 0, y: 0, width: 400, height: 300 } },
      {
        kind: "paragraph",
        textId: "pg001_p000",
        top: 100,
        left: 72,
        lineHeight: 24,
        segments: [{ text: "legacy" }],
        text: "legacy",
      },
    ]
    const section = sectionFixedLayoutPage({
      pageId: "pg001",
      pageNumber: 1,
      viewport,
      drawItems,
      availableImageIds: new Set(["pg001_im001"]),
    }).sections[0]

    const html = renderFixedLayoutPage(section, "/images").sections[0].html

    expect(html).not.toContain("data-adt-fit")
    expect(html).not.toContain("auto-fit.js")
  })

  it("appends Merriweather to font-family fallback chains for unbundled fonts", () => {
    // MuseoSans / Chokle aren't bundled as @font-face rules; without the
    // Merriweather fallback the spans render in system serif (Times)
    // which has very different metrics than the PDF source — causing the
    // auto-fit script to over-shrink.
    const drawItems: DrawItem[] = [
      { kind: "image", imageId: "pg001_im001", bounds: { x: 0, y: 0, width: 400, height: 300 } },
      {
        kind: "paragraph",
        textId: "pg001_p000",
        top: 100,
        left: 50,
        lineHeight: 12,
        segments: [
          { text: "Body text", style: { "font-family": "MuseoSans,serif", "font-size": "11.5px" } },
          { text: "Title", style: { "font-family": "Chokle,serif", "font-size": "22px" } },
        ],
        text: "Body textTitle",
      },
    ]
    const section = sectionFixedLayoutPage({
      pageId: "pg001",
      pageNumber: 1,
      viewport: { width: 400, height: 300 },
      drawItems,
      availableImageIds: new Set(["pg001_im001"]),
    }).sections[0]

    const html = renderFixedLayoutPage(section, "/images").sections[0].html

    // Merriweather inserted before the generic `serif` terminator.
    expect(html).toContain("font-family:MuseoSans,Merriweather,serif")
    expect(html).toContain("font-family:Chokle,Merriweather,serif")
  })

  it("leaves font-family untouched when Merriweather is already present", () => {
    const drawItems: DrawItem[] = [
      { kind: "image", imageId: "pg001_im001", bounds: { x: 0, y: 0, width: 400, height: 300 } },
      {
        kind: "paragraph",
        textId: "pg001_p000",
        top: 100,
        left: 50,
        lineHeight: 12,
        segments: [
          { text: "x", style: { "font-family": "Merriweather,serif", "font-size": "12px" } },
        ],
        text: "x",
      },
    ]
    const section = sectionFixedLayoutPage({
      pageId: "pg001",
      pageNumber: 1,
      viewport: { width: 400, height: 300 },
      drawItems,
      availableImageIds: new Set(["pg001_im001"]),
    }).sections[0]

    const html = renderFixedLayoutPage(section, "/images").sections[0].html

    // No double-Merriweather.
    expect(html).toContain("font-family:Merriweather,serif")
    expect(html).not.toContain("Merriweather,Merriweather")
  })

  it("uses max segment font-size as line-height when segments mix sizes", () => {
    // Narrative paragraph "Remember the warning signs." with body
    // segments (11.5px) sandwiching a decorative 24px segment. mupdf
    // reports lineHeight = 12 (the body run); without the override the
    // 24px segment overflows that 12px line box.
    const drawItems: DrawItem[] = [
      { kind: "image", imageId: "pg001_im001", bounds: { x: 0, y: 0, width: 800, height: 400 } },
      {
        kind: "paragraph",
        textId: "pg001_p000",
        top: 140,
        left: 37,
        lineHeight: 12,
        segments: [
          { text: "Remember the", style: { "font-family": "MuseoSans,serif", "font-size": "11.5px" } },
          { text: " warning signs.", style: { "font-family": "Chokle,serif", "font-size": "24px" } },
        ],
        text: "Remember the warning signs.",
        blockId: "b000",
        blockBounds: { x: 37, y: 140, width: 483, height: 28 },
        mergedParagraphId: "b000_p01",
      },
    ]
    const section = sectionFixedLayoutPage({
      pageId: "pg001",
      pageNumber: 1,
      viewport: { width: 800, height: 400 },
      drawItems,
      availableImageIds: new Set(["pg001_im001"]),
    }).sections[0]

    const html = renderFixedLayoutPage(section, "/images").sections[0].html

    // Effective line-height should be 24 (max segment fontSize), not 12.
    const pStyleMatch = html.match(/<p[^>]*data-id="pg001_p000"[^>]*style="([^"]*)"/)
    expect(pStyleMatch).not.toBeNull()
    expect(pStyleMatch![1]).toContain("line-height:24px")
    expect(pStyleMatch![1]).not.toContain("line-height:12px")
  })

  it("keeps mupdf-reported line-height for uniform segment sizes", () => {
    const drawItems: DrawItem[] = [
      { kind: "image", imageId: "pg001_im001", bounds: { x: 0, y: 0, width: 400, height: 300 } },
      {
        kind: "paragraph",
        textId: "pg001_p000",
        top: 100,
        left: 72,
        lineHeight: 24,
        segments: [
          { text: "I am a little girl.", style: { "font-family": "Palatino,serif", "font-size": "24px" } },
        ],
        text: "I am a little girl.",
      },
    ]
    const section = sectionFixedLayoutPage({
      pageId: "pg001",
      pageNumber: 1,
      viewport: { width: 400, height: 300 },
      drawItems,
      availableImageIds: new Set(["pg001_im001"]),
    }).sections[0]

    const html = renderFixedLayoutPage(section, "/images").sections[0].html

    const pStyleMatch = html.match(/<p[^>]*data-id="pg001_p000"[^>]*style="([^"]*)"/)
    expect(pStyleMatch).not.toBeNull()
    expect(pStyleMatch![1]).toContain("line-height:24px")
  })

  it("falls back to legacy single-line rendering when blockBounds is absent", () => {
    const drawItems: DrawItem[] = [
      { kind: "image", imageId: "pg001_im001", bounds: { x: 0, y: 0, width: 400, height: 300 } },
      {
        kind: "paragraph",
        textId: "pg001_p000",
        top: 100,
        left: 72,
        lineHeight: 24,
        segments: [{ text: "legacy" }],
        text: "legacy",
      },
    ]
    const section = sectionFixedLayoutPage({
      pageId: "pg001",
      pageNumber: 1,
      viewport,
      drawItems,
      availableImageIds: new Set(["pg001_im001"]),
    }).sections[0]

    const html = renderFixedLayoutPage(section, "/images").sections[0].html

    expect(html).toContain("left:72px")
    expect(html).not.toContain("text-align:")
    // No width / box-height / overflow rule when blockBounds isn't set —
    // legacy leaves flow at their original line position. (`line-height`
    // is fine; `height:` proper isn't.)
    const pStyleMatch = html.match(/<p[^>]*data-id="pg001_p000"[^>]*style="([^"]*)"/)
    expect(pStyleMatch).not.toBeNull()
    expect(pStyleMatch![1]).not.toContain("width:")
    expect(pStyleMatch![1]).not.toMatch(/(^|;)height:/)
    expect(pStyleMatch![1]).not.toContain("overflow:")
  })

  it("preserves font styling from mupdf via leaf html", () => {
    const html = renderFixedLayoutPage(makeSection(), "/images").sections[0].html

    // Merriweather is auto-inserted before the generic serif terminator
    // (it's the bundled font; without this insertion spans fall back to
    // system serif).
    expect(html).toContain("font-family:Palatino,Merriweather,serif")
    expect(html).toContain("color:#000000")
  })

  it("places positions from section JSON as inline styles in viewport coords", () => {
    const html = renderFixedLayoutPage(makeSection(), "/images").sections[0].html

    expect(html).toContain("top:100px")
    expect(html).toContain("left:72px")
    expect(html).toContain("top:158px")
  })

  it("emits data-segments on <p> so the viewer can rebuild styling on text swap", () => {
    const html = renderFixedLayoutPage(makeSection(), "/images").sections[0].html

    // Each <p> should carry the JSON segments (HTML-escaped).
    expect(html).toMatch(/<p data-id="pg001_p000" data-segments="[^"]+"/)
    // Attribute value must contain the style keys (HTML-escaped JSON quotes).
    expect(html).toContain("font-family")
    expect(html).toContain("color")
    // The attribute value decodes to valid JSON with the expected segment.
    const match = html.match(/data-id="pg001_p000" data-segments="([^"]+)"/)
    expect(match).not.toBeNull()
    const decoded = match![1].replace(/&quot;/g, '"').replace(/&amp;/g, "&")
    const parsed = JSON.parse(decoded)
    expect(parsed).toEqual([
      {
        text: "I am a little girl.",
        style: { "font-family": "Palatino,serif", "font-size": "48px", color: "#000000" },
      },
    ])
  })

  it("renders visible text (no transparent fallback)", () => {
    const html = renderFixedLayoutPage(makeSection(), "/images").sections[0].html

    expect(html).not.toContain("color:transparent")
  })

  it("adds contrast stroke for white text on light background", () => {
    const section = makeSection({
      drawItems: [
        { kind: "image", imageId: "pg001_im001", bounds: { x: 0, y: 0, width: 400, height: 300 } },
        {
          kind: "paragraph",
          textId: "pg001_p000",
          top: 100,
          left: 72,
          lineHeight: 48,
          segments: [
            {
              text: "white",
              style: { "font-family": "Palatino,serif", "font-size": "48px", color: "#ffffff" },
            },
          ],
          text: "white",
        },
      ],
    })

    const png = new PNG({ width: 800, height: 600 })
    png.data.fill(255)
    const pngBuffer = PNG.sync.write(png)
    const sampler = createBackgroundSampler(pngBuffer)!

    const html = renderFixedLayoutPage(section, "/images", {
      backgroundSampler: sampler,
      renderScale: 2,
    }).sections[0].html

    expect(html).toContain("-webkit-text-stroke")
    expect(html).toContain("paint-order:stroke fill")
    // Stroke must also appear inside `data-segments` so the runtime
    // translation rebuild (`assets/adt/modules/translations.js`) re-emits
    // spans with the stroke after a language switch / inline edit. Without
    // this, low-contrast text becomes invisible against the page image
    // again on the next swap.
    const dataSegMatch = html.match(/data-segments="([^"]*)"/)
    expect(dataSegMatch).not.toBeNull()
    const decoded = dataSegMatch![1].replace(/&quot;/g, '"').replace(/&amp;/g, "&")
    const parsed = JSON.parse(decoded) as Array<{ style: Record<string, string> }>
    expect(parsed[0].style["-webkit-text-stroke"]).toMatch(/^\d+px /)
    expect(parsed[0].style["paint-order"]).toBe("stroke fill")
  })

  it("emits an SVG clipPath and applies clip-path:url() to images carrying a PDF clip", () => {
    const section = makeSection({
      drawItems: [
        {
          kind: "image",
          imageId: "pg001_im001",
          bounds: { x: 100, y: 50, width: 200, height: 200 },
          clipPath: "M150 100L250 100L250 200L150 200Z",
        },
      ],
      availableImageIds: new Set(["pg001_im001"]),
    })

    const html = renderFixedLayoutPage(section, "/images").sections[0].html

    // SVG <clipPath> defs reference the imageId.
    expect(html).toContain('id="clip-pg001_im001"')
    expect(html).toContain('clipPathUnits="userSpaceOnUse"')
    // Path d carried verbatim, with a translate that subtracts the image's
    // origin so userSpaceOnUse coords are image-local.
    expect(html).toContain('d="M150 100L250 100L250 200L150 200Z"')
    expect(html).toContain('transform="translate(-100,-50)"')
    // The <img> picks up the clip-path style via the clip-{imageId} ref.
    expect(html).toMatch(
      /<img[^>]+style="[^"]*clip-path:url\(#clip-pg001_im001\)/,
    )
  })

  it("omits clipPath markup when the source PDF didn't clip the image", () => {
    const html = renderFixedLayoutPage(makeSection(), "/images").sections[0].html

    expect(html).not.toContain("<clipPath")
    expect(html).not.toContain("clip-path:url(")
  })

  it("emits mix-blend-mode and opacity for images drawn under a non-Normal PDF blend mode", () => {
    const section = makeSection({
      drawItems: [
        {
          kind: "image",
          imageId: "pg001_im001",
          bounds: { x: 0, y: 0, width: 200, height: 100 },
          blendMode: "multiply",
          opacity: 0.8,
        },
      ],
      availableImageIds: new Set(["pg001_im001"]),
    })

    const html = renderFixedLayoutPage(section, "/images").sections[0].html
    expect(html).toMatch(
      /<img[^>]+style="[^"]*mix-blend-mode:multiply[^"]*"/,
    )
    expect(html).toMatch(/<img[^>]+style="[^"]*opacity:0\.8/)
  })

  it("omits blend-mode and opacity styles when not provided", () => {
    const html = renderFixedLayoutPage(makeSection(), "/images").sections[0].html
    expect(html).not.toContain("mix-blend-mode")
    expect(html).not.toContain("opacity:")
  })

  it("does not add contrast stroke for black text on white background", () => {
    const png = new PNG({ width: 800, height: 600 })
    png.data.fill(255)
    const pngBuffer = PNG.sync.write(png)
    const sampler = createBackgroundSampler(pngBuffer)!

    const html = renderFixedLayoutPage(makeSection(), "/images", {
      backgroundSampler: sampler,
      renderScale: 2,
    }).sections[0].html

    expect(html).not.toContain("-webkit-text-stroke")
  })
})

describe("contrastRatio", () => {
  it("returns 21:1 for black on white", () => {
    const ratio = contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })
    expect(ratio).toBeCloseTo(21, 0)
  })

  it("returns 1:1 for same colors", () => {
    const ratio = contrastRatio({ r: 128, g: 128, b: 128 }, { r: 128, g: 128, b: 128 })
    expect(ratio).toBeCloseTo(1, 1)
  })

  it("detects insufficient contrast for white text on light gray", () => {
    const ratio = contrastRatio({ r: 255, g: 255, b: 255 }, { r: 220, g: 220, b: 220 })
    expect(ratio).toBeLessThan(3)
  })
})

describe("processFixedLayoutPages", () => {
  const tmpDirs: string[] = []
  afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true })
    tmpDirs.length = 0
  })

  function solidPngBuffer(width: number, height: number): Buffer {
    const png = new PNG({ width, height })
    png.data.fill(255)
    return PNG.sync.write(png)
  }

  function makeImage(
    imageId: string,
    pageId: string,
    width: number,
    height: number,
    bounds?: { x: number; y: number; width: number; height: number },
  ): ExtractedImage {
    const buffer = solidPngBuffer(width, height)
    return {
      imageId,
      pageId,
      buffer,
      format: "png",
      width,
      height,
      hash: "",
      renderMethod: "raster",
      bounds,
    }
  }

  it("renders all positioned images and paragraphs in draw order", () => {
    const booksRoot = fs.mkdtempSync(path.join(os.tmpdir(), "adt-fixlayout-test-"))
    tmpDirs.push(booksRoot)

    const storage = createBookStorage("test-book", booksRoot)
    try {
      const positionedText: PositionedTextOutput = {
        drawItems: [
          { kind: "image", imageId: "pg001_im001", bounds: { x: 50, y: 50, width: 300, height: 200 } },
          { kind: "image", imageId: "pg001_im002", bounds: { x: 200, y: 100, width: 30, height: 20 } },
        ],
        pageWidth: 400,
        pageHeight: 300,
        renderWidth: 800,
        renderHeight: 600,
      }

      storage.putExtractedPage({
        pageId: "pg001",
        pageNumber: 1,
        text: "",
        pageImage: makeImage("pg001_page", "pg001", 800, 600),
        images: [
          makeImage("pg001_im001", "pg001", 600, 400, { x: 50, y: 50, width: 300, height: 200 }),
          makeImage("pg001_im002", "pg001", 60, 40, { x: 200, y: 100, width: 30, height: 20 }),
        ],
        positionedText,
      })

      storage.putNodeData("positioned-text", "pg001", positionedText)
      storage.putNodeData("image-filtering", "pg001", {
        images: [
          { imageId: "pg001_page", isPruned: true, reason: "full-page render" },
          { imageId: "pg001_im001", isPruned: false },
          { imageId: "pg001_im002", isPruned: false },
        ],
      })

      processFixedLayoutPages(storage, "/images")

      const rendering = storage.getLatestNodeData("web-rendering", "pg001")
      expect(rendering).not.toBeNull()
      const html = (rendering!.data as { sections: Array<{ html: string }> }).sections[0].html

      expect(html).toContain('data-id="pg001_im001"')
      expect(html).toContain('data-id="pg001_im002"')
      // Both images positioned at their bounds
      expect(html).toMatch(/data-id="pg001_im002"[^>]*top:100px/)
      expect(html).toMatch(/data-id="pg001_im002"[^>]*left:200px/)
    } finally {
      storage.close()
    }
  })

  it("excludes images that image-filtering marked pruned", () => {
    // Fixed-layout trusts image-filtering's pruning decisions: the wizard
    // writes image_filters that disable size/complexity/meaningfulness
    // filtering for these books, so in practice nothing gets pruned except
    // the full-page render — but if something *did* get pruned (manual
    // user prune, etc.) the renderer respects that.
    const booksRoot = fs.mkdtempSync(path.join(os.tmpdir(), "adt-fixlayout-test-"))
    tmpDirs.push(booksRoot)

    const storage = createBookStorage("test-book", booksRoot)
    try {
      const positionedText: PositionedTextOutput = {
        drawItems: [
          { kind: "image", imageId: "pg001_im001", bounds: { x: 50, y: 50, width: 300, height: 200 } },
          { kind: "image", imageId: "pg001_im002", bounds: { x: 200, y: 100, width: 30, height: 20 } },
        ],
        pageWidth: 400,
        pageHeight: 300,
        renderWidth: 800,
        renderHeight: 600,
      }

      storage.putExtractedPage({
        pageId: "pg001",
        pageNumber: 1,
        text: "",
        pageImage: makeImage("pg001_page", "pg001", 800, 600),
        images: [
          makeImage("pg001_im001", "pg001", 600, 400, { x: 50, y: 50, width: 300, height: 200 }),
          makeImage("pg001_im002", "pg001", 60, 40, { x: 200, y: 100, width: 30, height: 20 }),
        ],
        positionedText,
      })

      storage.putNodeData("positioned-text", "pg001", positionedText)
      storage.putNodeData("image-filtering", "pg001", {
        images: [
          { imageId: "pg001_page", isPruned: true, reason: "full-page render" },
          { imageId: "pg001_im001", isPruned: false },
          { imageId: "pg001_im002", isPruned: true, reason: "not meaningful" },
        ],
      })

      processFixedLayoutPages(storage, "/images")

      const rendering = storage.getLatestNodeData("web-rendering", "pg001")!
      const html = (rendering.data as { sections: Array<{ html: string }> }).sections[0].html

      expect(html).toContain('data-id="pg001_im001"')
      expect(html).not.toContain('data-id="pg001_im002"')
    } finally {
      storage.close()
    }
  })
})
