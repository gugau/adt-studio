import { describe, it, expect } from "vitest"
import { sectionFixedLayoutPage, renderFixedLayoutPage, contrastRatio, addContrastStrokes, createBackgroundSampler } from "../fixed-layout-rendering.js"
import type { PositionedTextOutput } from "@adt/types"
import { PNG } from "pngjs"

describe("sectionFixedLayoutPage", () => {
  it("produces one section per page with illustration images as content", () => {
    const result = sectionFixedLayoutPage("pg001", 1, ["pg001_im001"])

    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].sectionId).toBe("pg001_sec001")
    expect(result.sections[0].sectionType).toBe("fixed-layout-page")
    expect(result.sections[0].isPruned).toBe(false)
    expect(result.sections[0].pageNumber).toBe(1)
    expect(result.sections[0].parts[0]).toEqual({
      type: "image",
      imageId: "pg001_im001",
      isPruned: false,
    })
  })

  it("uses the pageId in section IDs", () => {
    const result = sectionFixedLayoutPage("pg005006", 5, ["pg005006_im001_spread"])

    expect(result.sections[0].sectionId).toBe("pg005006_sec001")
    expect(result.sections[0].parts[0]).toEqual(
      expect.objectContaining({ imageId: "pg005006_im001_spread" })
    )
  })
})

describe("renderFixedLayoutPage", () => {
  const positionedText: PositionedTextOutput = {
    paragraphs: [
      {
        top: 200,
        left: 144,
        lineHeight: 96,
        html: '<span style="font-family:Palatino,serif;font-size:48.0pt;color:#000000">I am a little girl.</span>',
      },
      {
        top: 316,
        left: 144,
        lineHeight: 96,
        html: '<span style="font-family:Palatino,serif;font-size:48.0pt;color:#000000">My name is Sue.</span>',
      },
    ],
    pageWidth: 400,
    pageHeight: 300,
    renderWidth: 800,
    renderHeight: 600,
  }

  const images = [{ imageId: "pg001_im001", url: "/images/pg001_im001" }]
  // Viewport at 1x (page dimensions) — positions scale from 2x render to 1x
  const viewport = { width: 400, height: 300 }

  it("produces a single section with fixed-layout-page type", () => {
    const result = renderFixedLayoutPage("pg001", positionedText, images, 1, viewport)

    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].sectionType).toBe("fixed-layout-page")
    expect(result.sections[0].sectionIndex).toBe(0)
  })

  it("includes viewport dimensions in the HTML", () => {
    const result = renderFixedLayoutPage("pg001", positionedText, images, 1, viewport)
    const html = result.sections[0].html

    expect(html).toContain("width:400px")
    expect(html).toContain("height:300px")
  })

  it("includes illustration image reference", () => {
    const result = renderFixedLayoutPage("pg001", positionedText, images, 1, viewport)
    const html = result.sections[0].html

    expect(html).toContain('src="/images/pg001_im001"')
    expect(html).toContain('data-id="pg001_im001"')
  })

  it("includes positioned paragraphs with data-id attributes", () => {
    const result = renderFixedLayoutPage("pg001", positionedText, images, 1, viewport)
    const html = result.sections[0].html

    expect(html).toContain('data-id="pg001_p000"')
    expect(html).toContain('data-id="pg001_p001"')
    expect(html).toContain("I am a little girl.")
    expect(html).toContain("My name is Sue.")
  })

  it("preserves font styling from mupdf", () => {
    const result = renderFixedLayoutPage("pg001", positionedText, images, 1, viewport)
    const html = result.sections[0].html

    expect(html).toContain("font-family:Palatino,serif")
    expect(html).toContain("color:#000000")
  })

  it("scales text positions from render pixels to viewport coordinates", () => {
    const result = renderFixedLayoutPage("pg001", positionedText, images, 1, viewport)
    const html = result.sections[0].html

    // Positions scaled from 2x render (200, 144, 316) to 1x viewport (100, 72, 158)
    expect(html).toContain("top:100px")
    expect(html).toContain("left:72px")
    expect(html).toContain("top:158px")
  })

  it("makes text transparent when transparentText option is set", () => {
    const result = renderFixedLayoutPage("pg001", positionedText, images, 1, viewport, { transparentText: true })
    const html = result.sections[0].html

    expect(html).toContain("color:transparent")
  })

  it("renders visible text by default", () => {
    const result = renderFixedLayoutPage("pg001", positionedText, images, 1, viewport)
    const html = result.sections[0].html

    expect(html).not.toContain("color:transparent")
  })

  it("adds contrast stroke for white text on light background", () => {
    const whiteTextOutput: PositionedTextOutput = {
      paragraphs: [
        {
          top: 200,
          left: 144,
          lineHeight: 96,
          html: '<span style="font-family:Palatino,serif;font-size:48.0pt;color:#ffffff">white</span>',
        },
      ],
      pageWidth: 400,
      pageHeight: 300,
      renderWidth: 800,
      renderHeight: 600,
    }

    // Create a white background sampler (2x2 white PNG)
    const png = new PNG({ width: 800, height: 600 })
    png.data.fill(255) // all white RGBA
    const pngBuffer = PNG.sync.write(png)
    const sampler = createBackgroundSampler(pngBuffer)!

    const result = renderFixedLayoutPage("pg001", whiteTextOutput, images, 1, viewport, {
      backgroundSampler: sampler,
    })
    const html = result.sections[0].html

    expect(html).toContain("-webkit-text-stroke")
    expect(html).toContain("paint-order:stroke fill")
  })

  it("does not add contrast stroke for black text on white background", () => {
    // Create a white background sampler
    const png = new PNG({ width: 800, height: 600 })
    png.data.fill(255)
    const pngBuffer = PNG.sync.write(png)
    const sampler = createBackgroundSampler(pngBuffer)!

    const result = renderFixedLayoutPage("pg001", positionedText, images, 1, viewport, {
      backgroundSampler: sampler,
    })
    const html = result.sections[0].html

    // Black text on white — high contrast, no stroke needed
    expect(html).not.toContain("-webkit-text-stroke")
  })

  it("does not add contrast stroke when text is transparent", () => {
    const whiteTextOutput: PositionedTextOutput = {
      paragraphs: [
        {
          top: 200,
          left: 144,
          lineHeight: 96,
          html: '<span style="font-family:Palatino,serif;font-size:48.0pt;color:#ffffff">white</span>',
        },
      ],
      pageWidth: 400,
      pageHeight: 300,
      renderWidth: 800,
      renderHeight: 600,
    }

    const png = new PNG({ width: 800, height: 600 })
    png.data.fill(255)
    const pngBuffer = PNG.sync.write(png)
    const sampler = createBackgroundSampler(pngBuffer)!

    const result = renderFixedLayoutPage("pg001", whiteTextOutput, images, 1, viewport, {
      transparentText: true,
      backgroundSampler: sampler,
    })
    const html = result.sections[0].html

    // Transparent mode — no stroke regardless of contrast
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

  it("returns low ratio for white on white", () => {
    const ratio = contrastRatio({ r: 255, g: 255, b: 255 }, { r: 255, g: 255, b: 255 })
    expect(ratio).toBeCloseTo(1, 1)
  })

  it("detects insufficient contrast for white text on light gray", () => {
    const ratio = contrastRatio({ r: 255, g: 255, b: 255 }, { r: 220, g: 220, b: 220 })
    expect(ratio).toBeLessThan(3)
  })
})

describe("addContrastStrokes", () => {
  it("adds stroke for white text on white background", () => {
    const html = '<span style="font-size:96px;color:#ffffff">white</span>'
    const result = addContrastStrokes(html, { r: 255, g: 255, b: 255 }, 96)

    expect(result).toContain("-webkit-text-stroke")
    expect(result).toContain("rgba(0,0,0,0.6)") // dark stroke on light bg
  })

  it("does not add stroke for black text on white background", () => {
    const html = '<span style="font-size:96px;color:#000000">text</span>'
    const result = addContrastStrokes(html, { r: 255, g: 255, b: 255 }, 96)

    expect(result).not.toContain("-webkit-text-stroke")
  })

  it("adds light stroke for dark text on dark background", () => {
    const html = '<span style="font-size:96px;color:#1a1a1a">text</span>'
    const result = addContrastStrokes(html, { r: 30, g: 30, b: 30 }, 96)

    expect(result).toContain("-webkit-text-stroke")
    expect(result).toContain("rgba(255,255,255,0.6)") // light stroke on dark bg
  })

  it("handles mixed-color paragraphs — only strokes low-contrast spans", () => {
    const html =
      '<span style="font-size:96px;color:#000000">Look at the </span>' +
      '<span style="font-size:96px;color:#ffffff">white</span>' +
      '<span style="font-size:96px;color:#000000"> walls</span>'
    const result = addContrastStrokes(html, { r: 240, g: 240, b: 240 }, 96)

    // White text (#ffffff) on light bg should get stroke
    expect(result).toContain("color:#ffffff;-webkit-text-stroke")
    // Black text (#000000) on light bg should NOT get stroke
    expect(result).not.toMatch(/color:#000000;-webkit-text-stroke/)
  })
})
