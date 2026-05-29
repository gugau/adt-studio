import { describe, it, expect } from "vitest"
import { clusterParagraphsIntoBlocks, type AsHtmlParagraph } from "../positioned-text.js"

type LineBbox = Parameters<typeof clusterParagraphsIntoBlocks>[1][number]

const FONT_BODY = { "font-family": "MuseoSans,serif", "font-size": "11.5px" }
const FONT_TITLE = { "font-family": "Chokle,serif", "font-size": "22px" }

function makeParagraph(text: string, top: number, left: number, lineHeight = 11.5, style = FONT_BODY): AsHtmlParagraph {
  return {
    top,
    left,
    lineHeight,
    text,
    segments: [{ text, style }],
  }
}

function makeLine(text: string, top: number, left: number, right: number, bottom: number): LineBbox {
  return { top, left, right, bottom, text }
}

describe("clusterParagraphsIntoBlocks", () => {
  it("clusters wrapped lines from one bubble into a single block", () => {
    // Mirrors the Volcanoes book page 12 'Follow the evacuation plan / Move
    // away from the volcano / as fast as possible.' bubble — three centred
    // lines drawn as separate mupdf paragraphs.
    const p1 = makeParagraph("Follow the evacuation plan. ", 387.2, 116.5)
    const p2 = makeParagraph("Move away from the volcano ", 410.2, 112.9)
    const p3 = makeParagraph("as fast as possible.", 433.2, 142.1)
    const paragraphs = [p1, p2, p3]
    const lines: LineBbox[] = [
      makeLine("Follow the evacuation plan.", 386.1, 116.5, 273.9, 398.8),
      makeLine("Move away from the volcano", 409.1, 112.9, 277.4, 421.8),
      makeLine("as fast as possible.", 432.1, 142.1, 245.3, 444.8),
    ]

    clusterParagraphsIntoBlocks(paragraphs, lines)

    expect(p1.blockId).toBeDefined()
    expect(p1.blockId).toBe(p2.blockId)
    expect(p2.blockId).toBe(p3.blockId)
    expect(p1.blockBounds).toEqual({
      x: 112.9,
      y: 386.1,
      width: 277.4 - 112.9,
      height: 444.8 - 386.1,
    })
    expect(p3.blockBounds).toEqual(p1.blockBounds)
  })

  it("keeps adjacent bubbles in different blocks when their x-ranges don't overlap", () => {
    const left1 = makeParagraph("as fast as possible.", 433.2, 142.1)
    const right1 = makeParagraph("Try to stay out of low lying ", 418.1, 354.7)
    const right2 = makeParagraph("areas such as valleys.", 441.1, 370.2)
    const paragraphs = [left1, right1, right2]
    const lines: LineBbox[] = [
      makeLine("as fast as possible.", 432.1, 142.1, 245.3, 444.8),
      makeLine("Try to stay out of low lying", 417.1, 354.7, 506.9, 429.7),
      makeLine("areas such as valleys.", 440.1, 370.2, 488.4, 452.7),
    ]

    clusterParagraphsIntoBlocks(paragraphs, lines)

    // Left bubble's last line gets its own block; right bubble's two lines join.
    expect(left1.blockId).not.toBe(right1.blockId)
    expect(right1.blockId).toBe(right2.blockId)
    expect(right1.blockBounds).toEqual({
      x: 354.7,
      y: 417.1,
      width: 506.9 - 354.7,
      height: 452.7 - 417.1,
    })
  })

  it("does not merge a heading with body text below it (different fonts)", () => {
    const heading = makeParagraph("AND DURING A VOLCANIC ERUPTION?", 85.4, 58.4, 22.0, FONT_TITLE)
    const body = makeParagraph("Follow the evacuation plan. ", 387.2, 116.5)
    const paragraphs = [heading, body]
    const lines: LineBbox[] = [
      makeLine("AND DURING A VOLCANIC ERUPTION?", 81.3, 58.4, 416.4, 111.6),
      makeLine("Follow the evacuation plan.", 386.1, 116.5, 273.9, 398.8),
    ]

    clusterParagraphsIntoBlocks(paragraphs, lines)

    expect(heading.blockId).not.toBe(body.blockId)
  })

  it("clusters centred ragged-right lines whose left edges differ", () => {
    // No horizontal overlap on left edges alone, but the visual centres
    // line up — typical centred bubble text.
    const p1 = makeParagraph("Watch out for falling ash and ", 111.1, 78.2)
    const p2 = makeParagraph("rocks, lava, lahars, volcanic ", 134.1, 82.6)
    const p3 = makeParagraph("gases and pyroclastic flows.", 157.1, 80.8)
    const paragraphs = [p1, p2, p3]
    const lines: LineBbox[] = [
      makeLine("Watch out for falling ash and", 110.0, 78.2, 250.0, 122.6),
      makeLine("rocks, lava, lahars, volcanic", 133.0, 82.6, 248.0, 145.6),
      makeLine("gases and pyroclastic flows.", 156.0, 80.8, 246.0, 168.6),
    ]

    clusterParagraphsIntoBlocks(paragraphs, lines)

    expect(p1.blockId).toBe(p2.blockId)
    expect(p2.blockId).toBe(p3.blockId)
  })

  it("isolates a far-away paragraph from a preceding cluster", () => {
    const top = makeParagraph("Watch out for falling ash and ", 111.1, 78.2)
    const farBelow = makeParagraph("Did you know that the ", 307.0, 347.2)
    const paragraphs = [top, farBelow]
    const lines: LineBbox[] = [
      makeLine("Watch out for falling ash and", 110.0, 78.2, 250.0, 122.6),
      makeLine("Did you know that the", 306.0, 347.2, 480.0, 318.5),
    ]

    clusterParagraphsIntoBlocks(paragraphs, lines)

    expect(top.blockId).not.toBe(farBelow.blockId)
  })

  it("merges lowercase-continuation lines into one mergedParagraphId", () => {
    // "Move away from the volcano " (uppercase 'M') / "as fast as possible." (lowercase 'a')
    const p1 = makeParagraph("Move away from the volcano ", 410.2, 112.9)
    const p2 = makeParagraph("as fast as possible.", 433.2, 142.1)
    const lines: LineBbox[] = [
      makeLine("Move away from the volcano", 409.1, 112.9, 277.4, 421.8),
      makeLine("as fast as possible.", 432.1, 142.1, 245.3, 444.8),
    ]

    clusterParagraphsIntoBlocks([p1, p2], lines)

    expect(p1.mergedParagraphId).toBe(p2.mergedParagraphId)
  })

  it("splits at sentence boundaries inside the same block", () => {
    // "Follow the evacuation plan." → period + uppercase "Move" → split
    const p1 = makeParagraph("Follow the evacuation plan. ", 387.2, 116.5)
    const p2 = makeParagraph("Move away from the volcano ", 410.2, 112.9)
    const p3 = makeParagraph("as fast as possible.", 433.2, 142.1)
    const lines: LineBbox[] = [
      makeLine("Follow the evacuation plan.", 386.1, 116.5, 273.9, 398.8),
      makeLine("Move away from the volcano", 409.1, 112.9, 277.4, 421.8),
      makeLine("as fast as possible.", 432.1, 142.1, 245.3, 444.8),
    ]

    clusterParagraphsIntoBlocks([p1, p2, p3], lines)

    // All three share a block (one bubble) but split into two merged paragraphs.
    expect(p1.blockId).toBe(p2.blockId)
    expect(p2.blockId).toBe(p3.blockId)
    expect(p1.mergedParagraphId).not.toBe(p2.mergedParagraphId)
    expect(p2.mergedParagraphId).toBe(p3.mergedParagraphId)
  })

  it("merges hyphen-wrapped words across lines", () => {
    // "fast-" / "moving" — prev ends with '-' → continuation regardless of next case
    const p1 = makeParagraph("super-", 100, 50)
    const p2 = makeParagraph("Computers", 115, 50)
    const lines: LineBbox[] = [
      makeLine("super-", 99, 50, 90, 112),
      makeLine("Computers", 114, 50, 110, 127),
    ]

    clusterParagraphsIntoBlocks([p1, p2], lines)

    expect(p1.mergedParagraphId).toBe(p2.mergedParagraphId)
  })

  it("infers center alignment for centred bubble lines", () => {
    const p1 = makeParagraph("Follow the evacuation plan. ", 387.2, 116.5)
    const p2 = makeParagraph("Move away from the volcano ", 410.2, 112.9)
    const p3 = makeParagraph("as fast as possible.", 433.2, 142.1)
    const lines: LineBbox[] = [
      makeLine("Follow the evacuation plan.", 386.1, 116.5, 273.9, 398.8),
      makeLine("Move away from the volcano", 409.1, 112.9, 277.4, 421.8),
      makeLine("as fast as possible.", 432.1, 142.1, 245.3, 444.8),
    ]

    clusterParagraphsIntoBlocks([p1, p2, p3], lines)

    expect(p1.textAlign).toBe("center")
    expect(p2.textAlign).toBe("center")
    expect(p3.textAlign).toBe("center")
  })

  it("leaves textAlign undefined for left-flush body text", () => {
    // All lines flush to the same left edge, varying right.
    const p1 = makeParagraph("Lorem ipsum dolor sit amet, ", 100, 50)
    const p2 = makeParagraph("consectetur adipiscing elit, ", 115, 50)
    const p3 = makeParagraph("sed do eiusmod.", 130, 50)
    const lines: LineBbox[] = [
      makeLine("Lorem ipsum dolor sit amet,", 99, 50, 250, 112),
      makeLine("consectetur adipiscing elit,", 114, 50, 240, 127),
      makeLine("sed do eiusmod.", 129, 50, 160, 142),
    ]

    clusterParagraphsIntoBlocks([p1, p2, p3], lines)

    expect(p1.textAlign).toBeUndefined()
  })

  it("namespaces ids by prefix so spread halves stay separate", () => {
    const left1 = makeParagraph("Left line one", 100, 50)
    const right1 = makeParagraph("Right line one", 100, 600)
    const lines: LineBbox[] = [
      makeLine("Left line one", 100, 50, 150, 112),
    ]
    const linesRight: LineBbox[] = [
      makeLine("Right line one", 100, 600, 700, 112),
    ]

    clusterParagraphsIntoBlocks([left1], lines, "L")
    clusterParagraphsIntoBlocks([right1], linesRight, "R")

    expect(left1.blockId?.startsWith("L")).toBe(true)
    expect(right1.blockId?.startsWith("R")).toBe(true)
    expect(left1.blockId).not.toBe(right1.blockId)
  })
})
