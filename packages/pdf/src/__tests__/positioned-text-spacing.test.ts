import { describe, it, expect } from "vitest"
import {
  cleanParagraphSpacing,
  type AsHtmlParagraph,
  type LineChar,
} from "../positioned-text.js"

interface SyntheticLine {
  top: number
  left: number
  right: number
  bottom: number
  text: string
  chars: LineChar[]
}

/**
 * Build synthetic LineChar geometry from a simple `(char, advance)`
 * recipe — `advance` is the cursor advance contributed by that character
 * (i.e. the next character's origin = this character's origin + advance).
 * For a normal letter this is its glyph width + any letter-spacing;
 * for a zero-advance space this is 0.
 */
function chars(items: Array<[string, number]>): LineChar[] {
  let x = 0
  const out: LineChar[] = []
  for (const [c, advance] of items) {
    // qLeft = origin x; qRight = origin x + the character's own glyph width.
    // For our purposes the "own glyph width" is the advance for letters
    // (no extra letter-spacing) and 0 for zero-advance spaces.
    const isSpace = c === " "
    const ownWidth = isSpace ? advance : advance
    out.push({ c, ox: x, qLeft: x, qRight: x + ownWidth })
    x += advance
  }
  return out
}

/**
 * Same as `chars` but encodes letter-spacing explicitly: each letter has
 * its own `width` and a separate `track` value applied AFTER it. The
 * letter occupies [ox, ox+width]; the next char's ox is at ox+width+track.
 */
function tracked(
  items: Array<{ c: string; width: number; track?: number }>,
): LineChar[] {
  let x = 0
  const out: LineChar[] = []
  for (const it of items) {
    const w = it.width
    out.push({ c: it.c, ox: x, qLeft: x, qRight: x + w })
    x += w + (it.track ?? 0)
  }
  return out
}

function makeLine(chars: LineChar[]): SyntheticLine {
  const text = chars.map((c) => c.c).join("").replace(/\s+$/, "")
  const left = chars[0]?.qLeft ?? 0
  const right = chars[chars.length - 1]?.qRight ?? 0
  return { top: 100, left, right, bottom: 112, text, chars }
}

function makeParagraph(text: string, segments?: AsHtmlParagraph["segments"]): AsHtmlParagraph {
  return {
    top: 100,
    left: 0,
    lineHeight: 12,
    text,
    segments: segments ?? [{ text, style: { "font-family": "Sans" } }],
  }
}

describe("cleanParagraphSpacing", () => {
  it("leaves a normal paragraph untouched (no zero-advance spaces)", () => {
    // "Hi there" — letters with normal glyph widths, single real space (~3pt).
    const c = chars([
      ["H", 6],
      ["i", 3],
      [" ", 3],
      ["t", 3],
      ["h", 6],
      ["e", 6],
      ["r", 4],
      ["e", 6],
    ])
    const line = makeLine(c)
    const p = makeParagraph("Hi there")
    cleanParagraphSpacing([p], [line])
    expect(p.text).toBe("Hi there")
    expect(p.segments).toEqual([{ text: "Hi there", style: { "font-family": "Sans" } }])
  })

  it("strips intra-word spaces whose advance ≤ paragraph letter-spacing", () => {
    // "U n iversity" — letters at 22pt with ~3pt letter-spacing, single
    // zero-advance spaces between U-n and n-i. Cluster advance (~3pt) is
    // close to letter-spacing (3pt), so it strips.
    // Build by tracking: letter widths ~10, track ~3 between letters of
    // a tracked title. Then a zero-advance space sits between selected
    // pairs, tracked exactly the same.
    const charsArr: LineChar[] = []
    let x = 0
    function pushLetter(c: string, width: number, track: number) {
      charsArr.push({ c, ox: x, qLeft: x, qRight: x + width })
      x += width + track
    }
    function pushZeroSpace() {
      // Zero-advance space placed at the cursor — qLeft == qRight, no advance.
      charsArr.push({ c: " ", ox: x, qLeft: x, qRight: x })
    }
    pushLetter("U", 10, 3)
    pushZeroSpace()
    pushLetter("n", 8, 3)
    pushZeroSpace()
    pushLetter("i", 4, 3)
    pushLetter("v", 8, 3)
    pushLetter("e", 8, 0)

    const line = makeLine(charsArr)
    const p = makeParagraph("U n ive")
    cleanParagraphSpacing([p], [line])
    // Both intra-word spaces stripped.
    expect(p.text).toBe("Unive")
  })

  it("collapses multi-space cluster at a real word boundary into one space", () => {
    // "ity  of" — letterspaced "ity" finishes, then TWO zero-advance
    // spaces wider than letter-spacing in total, then "of".
    const charsArr: LineChar[] = []
    let x = 0
    function pushLetter(c: string, width: number, track: number) {
      charsArr.push({ c, ox: x, qLeft: x, qRight: x + width })
      x += width + track
    }
    function pushSpace(width: number) {
      charsArr.push({ c: " ", ox: x, qLeft: x, qRight: x + width })
      x += width
    }
    pushLetter("i", 4, 3)
    pushLetter("t", 4, 3)
    pushLetter("y", 8, 0)
    pushSpace(3)
    pushSpace(8) // Cluster total = 11pt — well above letter-spacing (3pt).
    pushLetter("o", 8, 3)
    pushLetter("f", 6, 0)

    const line = makeLine(charsArr)
    const p = makeParagraph("ity  of")
    cleanParagraphSpacing([p], [line])
    expect(p.text).toBe("ity of")
  })

  it("handles a mixed paragraph: intra-word strips, real boundary kept", () => {
    // Sketch of "U n  of" — intra-word space U-n (1 zero-advance, narrow),
    // then real word boundary "n→of" via 2 spaces totalling much more.
    const charsArr: LineChar[] = []
    let x = 0
    function L(c: string, w: number, t: number) {
      charsArr.push({ c, ox: x, qLeft: x, qRight: x + w })
      x += w + t
    }
    function S(w: number) {
      charsArr.push({ c: " ", ox: x, qLeft: x, qRight: x + w })
      x += w
    }
    L("U", 10, 3)
    S(0)        // narrow zero-advance space (intra-word artefact)
    L("n", 8, 0)
    S(3)        // first space at boundary
    S(8)        // second space at boundary — together > letter-spacing
    L("o", 8, 3)
    L("f", 6, 0)

    const line = makeLine(charsArr)
    const p = makeParagraph("U n  of")
    cleanParagraphSpacing([p], [line])
    expect(p.text).toBe("Un of")
  })

  it("applies stripping to per-segment text (preserving style boundaries)", () => {
    // "U n" but split across two styled segments: "U " styled red,
    // "n" styled black. The space lives at the end of the first segment.
    const charsArr: LineChar[] = []
    let x = 0
    charsArr.push({ c: "U", ox: x, qLeft: x, qRight: x + 10 })
    x += 10 + 3
    charsArr.push({ c: " ", ox: x, qLeft: x, qRight: x }) // zero-advance
    charsArr.push({ c: "n", ox: x, qLeft: x, qRight: x + 8 })

    const line = makeLine(charsArr)
    const p: AsHtmlParagraph = {
      top: 100,
      left: 0,
      lineHeight: 12,
      text: "U n",
      segments: [
        { text: "U ", style: { color: "#ff0000" } },
        { text: "n", style: { color: "#000000" } },
      ],
    }
    cleanParagraphSpacing([p], [line])
    expect(p.text).toBe("Un")
    expect(p.segments).toEqual([
      { text: "U", style: { color: "#ff0000" } },
      { text: "n", style: { color: "#000000" } },
    ])
  })

  it("keeps single space at a real boundary in plain (no letter-spacing) text", () => {
    // Letter-spacing = 0 (medianLS = 0), threshold = max(0×1.6, 1) = 1pt.
    // Real space of 2.4pt is well above → kept.
    const c = chars([
      ["a", 5],
      [" ", 2.4],
      ["b", 5],
    ])
    const line = makeLine(c)
    const p = makeParagraph("a b")
    cleanParagraphSpacing([p], [line])
    expect(p.text).toBe("a b")
  })
})

describe("cleanParagraphSpacing — per-font-run analysis (Volcanologists case)", () => {
  /**
   * Build chars where each letter has an explicit `width` and `track`
   * (extra letter-spacing applied AFTER the glyph), and spaces have an
   * explicit `width` that contributes to cursor advance. This produces
   * realistic geometry where the per-run median letter-spacing reflects
   * the title's actual typeset tracking.
   */
  function buildLine(
    items: Array<{ c: string; width: number; track?: number; font: string }>,
  ): LineChar[] {
    let x = 0
    const out: LineChar[] = []
    for (const it of items) {
      out.push({ c: it.c, ox: x, qLeft: x, qRight: x + it.width, font: it.font })
      x += it.width + (it.track ?? 0)
    }
    return out
  }

  function L(c: string, width: number, track: number, font: string) {
    return { c, width, track, font }
  }
  function S(width: number, font: string) {
    return { c: " ", width, track: 0, font }
  }

  it("strips letter-spaced single spaces in a decorative font run", () => {
    // Chokle@22 with ~3pt letter-tracking between every letter, fragment
    // boundaries marked by single ~3pt-wide spaces — the Volcanologists
    // pattern. Per-run median LS = 3pt, threshold = 4.8pt, single-space
    // cluster (3pt) sub-threshold → strip.
    const c = buildLine([
      L("V", 7, 3, "Chokle@22"), L("o", 7, 3, "Chokle@22"),
      S(3, "Chokle@22"),
      L("l", 4, 3, "Chokle@22"), L("c", 6, 3, "Chokle@22"), L("a", 6, 3, "Chokle@22"),
      S(3, "Chokle@22"),
      L("n", 6, 3, "Chokle@22"),
      S(3, "Chokle@22"),
      L("o", 7, 3, "Chokle@22"),
      S(3, "Chokle@22"),
      L("l", 4, 3, "Chokle@22"), L("o", 7, 3, "Chokle@22"),
      S(3, "Chokle@22"),
      L("g", 7, 3, "Chokle@22"),
      S(3, "Chokle@22"),
      L("i", 4, 3, "Chokle@22"),
      S(3, "Chokle@22"),
      L("s", 6, 3, "Chokle@22"),
      S(3, "Chokle@22"),
      L("t", 5, 3, "Chokle@22"), L("s", 6, 0, "Chokle@22"),
    ])
    const line = makeLine(c)
    const p = makeParagraph("Vo lca n o lo g i s ts")
    cleanParagraphSpacing([p], [line])
    expect(p.text).toBe("Volcanologists")
  })

  it("leaves a body-font run alone — even short fragments stay intact", () => {
    // Body text: zero tracking, real spaces of 3pt. Per-run median LS = 0,
    // threshold = 1pt, real-space cluster (3pt) supra-threshold → keep.
    const c = buildLine([
      L("a", 5, 0, "Body"), L("s", 5, 0, "Body"),
      S(3, "Body"),
      L("t", 4, 0, "Body"), L("w", 8, 0, "Body"), L("o", 6, 0, "Body"),
      S(3, "Body"),
      L("w", 8, 0, "Body"), L("e", 6, 0, "Body"), L("r", 4, 0, "Body"), L("e", 6, 0, "Body"),
    ])
    const line = makeLine(c)
    const p = makeParagraph("as two were")
    cleanParagraphSpacing([p], [line])
    expect(p.text).toBe("as two were")
  })

  it("only strips spaces inside the decorative run of a mixed-font line", () => {
    // Body (no tracking) | Chokle (3pt tracking) | Body (no tracking).
    // Only the Chokle run's intra-word spaces should disappear; body-side
    // word spaces and the font-transition space stay.
    const c = buildLine([
      L("a", 5, 0, "Body"), L("s", 5, 0, "Body"),
      S(3, "Body"),
      L("t", 4, 0, "Body"), L("w", 8, 0, "Body"), L("o", 6, 0, "Body"),
      // Font-transition space — surrounded by Body 'o' and Chokle 'V',
      // different fonts → kept regardless of cluster width.
      S(3, "Body"),
      L("V", 7, 3, "Chokle@22"), L("o", 7, 3, "Chokle@22"),
      S(3, "Chokle@22"),
      L("l", 4, 3, "Chokle@22"), L("c", 6, 3, "Chokle@22"), L("a", 6, 3, "Chokle@22"),
      S(3, "Chokle@22"),
      L("n", 6, 3, "Chokle@22"),
      S(3, "Chokle@22"),
      L("o", 7, 3, "Chokle@22"),
      // Font-transition space — Chokle 'o' to Body 'w', different fonts → kept.
      S(3, "Body"),
      L("w", 8, 0, "Body"), L("e", 6, 0, "Body"), L("r", 4, 0, "Body"), L("e", 6, 0, "Body"),
    ])
    const line = makeLine(c)
    const p = makeParagraph("as two Vo lca n o were")
    cleanParagraphSpacing([p], [line])
    expect(p.text).toBe("as two Volcano were")
  })

  it("strips when ≥60% of fragments are single-char even if metric ambiguous", () => {
    // "L E A V E  N O  O N E  B E H I N D." — every letter separated by
    // a single space, with double-spaces (TWO U+0020 chars) at word
    // boundaries. A single accidental D→. pair gives a misleading
    // non-zero medianLS that's below the actual single-space advances,
    // so the metric alone would inconsistently strip/keep. The
    // single-char-fragment ratio (15/16 ≈ 94%) catches it unambiguously.
    // Single-space clusters → strip; double-space clusters → collapse to one.
    const SP = (): { c: string; width: number; track?: number; font: string } =>
      ({ c: " ", width: 4, track: 0, font: "Chokle@22" })
    const c = buildLine([
      L("L", 8, 0, "Chokle@22"), SP(),
      L("E", 7, 0, "Chokle@22"), SP(),
      L("A", 7, 0, "Chokle@22"), SP(),
      L("V", 7, 0, "Chokle@22"), SP(),
      L("E", 7, 0, "Chokle@22"), SP(), SP(),
      L("N", 7, 0, "Chokle@22"), SP(),
      L("O", 7, 0, "Chokle@22"), SP(), SP(),
      L("O", 7, 0, "Chokle@22"), SP(),
      L("N", 7, 0, "Chokle@22"), SP(),
      L("E", 7, 0, "Chokle@22"), SP(), SP(),
      L("B", 7, 0, "Chokle@22"), SP(),
      L("E", 7, 0, "Chokle@22"), SP(),
      L("H", 7, 0, "Chokle@22"), SP(),
      L("I", 4, 0, "Chokle@22"), SP(),
      L("N", 7, 0, "Chokle@22"), SP(),
      L("D", 7, 2, "Chokle@22"),
      L(".", 3, 0, "Chokle@22"),
    ])
    const line = makeLine(c)
    const p = makeParagraph("L E A V E  N O  O N E  B E H I N D.")
    cleanParagraphSpacing([p], [line])
    expect(p.text).toBe("LEAVE NO ONE BEHIND.")
  })

  it("strips when run is entirely single-char fragments (medianLS=0)", () => {
    // "e v a c u a t i o n" — every char is its own fragment, no
    // consecutive non-space pairs. medianLS=0, threshold=1pt; without
    // the fallback the 4pt-advance spaces would be kept.
    const c = buildLine([
      L("e", 6, 0, "Chokle@22"),
      S(4, "Chokle@22"),
      L("v", 7, 0, "Chokle@22"),
      S(4, "Chokle@22"),
      L("a", 6, 0, "Chokle@22"),
      S(4, "Chokle@22"),
      L("c", 6, 0, "Chokle@22"),
      S(4, "Chokle@22"),
      L("u", 6, 0, "Chokle@22"),
    ])
    const line = makeLine(c)
    const p = makeParagraph("e v a c u")
    cleanParagraphSpacing([p], [line])
    expect(p.text).toBe("evacu")
  })

  it("keeps real word-spacing in a tracked font when cluster advance is wide enough", () => {
    // Tracked Chokle@22 with median LS 3pt → threshold 4.8pt. A genuine
    // word boundary inside this run (encoded as a wide ~10pt space)
    // exceeds the threshold and stays.
    const c = buildLine([
      L("T", 7, 3, "Chokle@22"), L("h", 7, 3, "Chokle@22"), L("e", 7, 3, "Chokle@22"),
      S(10, "Chokle@22"), // real word break, well above 4.8pt threshold
      L("o", 7, 3, "Chokle@22"), L("n", 7, 3, "Chokle@22"), L("e", 7, 0, "Chokle@22"),
    ])
    const line = makeLine(c)
    const p = makeParagraph("The one")
    cleanParagraphSpacing([p], [line])
    expect(p.text).toBe("The one")
  })
})
