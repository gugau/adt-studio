import { describe, it, expect } from "vitest"
import { tokenizeWords, extractWords, WORD_PATTERN } from "../word-tokenize.js"

describe("tokenizeWords", () => {
  it("preserves the original text losslessly across segments", () => {
    const text = 'During lunch, she buys food. "Always."'
    const segs = tokenizeWords(text)
    expect(segs.map((s) => s.text).join("")).toBe(text)
  })

  it("splits punctuation off as separators", () => {
    const segs = tokenizeWords("Hello, world.")
    expect(segs).toEqual([
      { type: "word", text: "Hello", start: 0, end: 5, wordIndex: 0 },
      { type: "separator", text: ", ", start: 5, end: 7 },
      { type: "word", text: "world", start: 7, end: 12, wordIndex: 1 },
      { type: "separator", text: ".", start: 12, end: 13 },
    ])
  })

  it("keeps contractions and curly-apostrophe contractions as single words", () => {
    expect(extractWords("don't can't it's")).toEqual(["don't", "can't", "it's"])
    expect(extractWords("don’t can’t it’s")).toEqual(["don’t", "can’t", "it’s"])
  })

  it("keeps hyphenated compounds as single words", () => {
    expect(extractWords("well-known mother-in-law")).toEqual([
      "well-known",
      "mother-in-law",
    ])
  })

  it("treats trailing punctuation after a contraction as a separator", () => {
    // Regression guard: ensure the regex's optional contraction tail doesn't
    // greedily swallow trailing punctuation.
    expect(extractWords('"Always."')).toEqual(["Always"])
  })

  it("handles non-ASCII letters with marks (combining characters)", () => {
    expect(extractWords("café Straße naïve")).toEqual(["café", "Straße", "naïve"])
  })

  it("returns an empty array for whitespace-only input", () => {
    expect(extractWords("   \n  \t")).toEqual([])
    const segs = tokenizeWords("   \n  \t")
    expect(segs).toEqual([
      { type: "separator", text: "   \n  \t", start: 0, end: 7 },
    ])
  })

  it("returns nothing for empty input", () => {
    expect(tokenizeWords("")).toEqual([])
  })

  it("assigns sequential wordIndex starting at 0", () => {
    const segs = tokenizeWords("one two three")
    const words = segs.filter((s) => s.type === "word")
    expect(words.map((w) => (w as { wordIndex: number }).wordIndex)).toEqual([
      0, 1, 2,
    ])
  })

  it("uses a local regex instance so concurrent calls don't share lastIndex", () => {
    // If we used WORD_PATTERN directly without cloning, the second call would
    // resume from the first call's leftover .lastIndex.
    const a = extractWords("alpha bravo")
    const b = extractWords("charlie delta")
    expect(a).toEqual(["alpha", "bravo"])
    expect(b).toEqual(["charlie", "delta"])
  })
})

describe("WORD_PATTERN parity with viewer runtime", () => {
  // Mirrors `assets/adt/modules/tts_highlighter_utils.js`. If this drifts,
  // SMIL fragment ids and Whisper word counts will disagree across sites.
  it("uses the same regex source as the viewer runtime tokenizer", () => {
    const viewerPattern = /[\p{L}\p{N}\p{M}]+(?:[’'-][\p{L}\p{N}\p{M}]+)*/gu
    expect(WORD_PATTERN.source).toBe(viewerPattern.source)
    expect(WORD_PATTERN.flags).toBe(viewerPattern.flags)
  })
})
