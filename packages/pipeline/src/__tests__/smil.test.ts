import { describe, it, expect } from "vitest"
import { buildSmil, formatMediaDuration } from "../smil.js"

const para = (
  paragraphId: string,
  audioPath: string,
  wordIds: string[],
  whisperWords: { word: string; start: number; end: number }[],
  audioDuration?: number,
) => ({
  paragraphId,
  audioPath,
  audioDuration: audioDuration ?? (whisperWords.length > 0 ? whisperWords[whisperWords.length - 1].end : 0),
  wordIds,
  whisperWords,
})

describe("buildSmil", () => {
  it("emits word-level <par> when source span count matches whisper word count", () => {
    const result = buildSmil({
      pageHref: "../pg001_sec001.xhtml",
      paragraphs: [
        para(
          "pg001_p001",
          "../en/audio/pg001_p001.mp3",
          ["pg001_p001_w001", "pg001_p001_w002", "pg001_p001_w003"],
          [
            { word: "Hello", start: 0, end: 0.4 },
            { word: "there", start: 0.4, end: 0.8 },
            { word: "Pip", start: 0.8, end: 1.2 },
          ],
        ),
      ],
    })

    expect(result).not.toBeNull()
    expect(result!.xml).toContain('xmlns="http://www.w3.org/ns/SMIL"')
    expect(result!.xml).toContain('xmlns:epub="http://www.idpf.org/2007/ops"')
    expect(result!.xml).toContain('version="3.0"')
    // One <par> per word with clipBegin/clipEnd carrying the whisper times.
    expect(result!.xml).toContain('src="../pg001_sec001.xhtml#pg001_p001_w001"')
    expect(result!.xml).toContain('clipBegin="0.000s" clipEnd="0.400s"')
    expect(result!.xml).toContain('src="../pg001_sec001.xhtml#pg001_p001_w002"')
    expect(result!.xml).toContain('clipBegin="0.400s" clipEnd="0.800s"')
    expect(result!.xml).toContain('src="../pg001_sec001.xhtml#pg001_p001_w003"')
    expect(result!.xml).toContain('clipBegin="0.800s" clipEnd="1.200s"')
  })

  it("falls back to a single paragraph-level <par> when counts diverge", () => {
    const result = buildSmil({
      pageHref: "../pg001_sec001.xhtml",
      paragraphs: [
        para(
          "pg001_p002",
          "../en/audio/pg001_p002.mp3",
          ["pg001_p002_w001", "pg001_p002_w002", "pg001_p002_w003"], // 3 source words
          [
            { word: "twenty", start: 0, end: 0.3 }, // 4 whisper words — counts differ
            { word: "three", start: 0.3, end: 0.6 },
            { word: "in", start: 0.6, end: 0.7 },
            { word: "all", start: 0.7, end: 1.0 },
          ],
          1.0,
        ),
      ],
    })

    expect(result).not.toBeNull()
    // Exactly one <par> for this paragraph (paragraph-level fallback),
    // no per-word fragment refs.
    const parMatches = result!.xml.match(/<par id="/g) ?? []
    expect(parMatches).toHaveLength(1)
    expect(result!.xml).toContain('src="../pg001_sec001.xhtml#pg001_p002"')
    expect(result!.xml).not.toContain("pg001_p002_w001")
    // Paragraph-level still emits explicit clip bounds so EPUB readers and
    // EPUBCheck don't have to infer audio duration from the file.
    expect(result!.xml).toContain('clipBegin="0.000s" clipEnd="1.000s"')
  })

  it("falls back to paragraph-level when paragraph has no word ids", () => {
    const result = buildSmil({
      pageHref: "../pg001.xhtml",
      paragraphs: [
        para(
          "pg001_p001",
          "../en/audio/pg001_p001.mp3",
          [], // empty word ids — reflowable / CJK / no whitespace tokenisation
          [{ word: "你好", start: 0, end: 0.5 }],
          0.5,
        ),
      ],
    })

    expect(result).not.toBeNull()
    expect(result!.xml).toContain('src="../pg001.xhtml#pg001_p001"')
    expect(result!.xml).toContain('clipBegin="0.000s" clipEnd="0.500s"')
  })

  it("skips paragraphs with no whisper data and excludes their duration", () => {
    const result = buildSmil({
      pageHref: "../pg001.xhtml",
      paragraphs: [
        para(
          "pg001_p001",
          "../en/audio/pg001_p001.mp3",
          ["pg001_p001_w001"],
          [{ word: "hello", start: 0, end: 0.5 }],
          0.5,
        ),
        para(
          "pg001_p002",
          "../en/audio/pg001_p002.mp3",
          ["pg001_p002_w001"],
          [], // no whisper data — skipped
          1.0,
        ),
      ],
    })

    expect(result).not.toBeNull()
    expect(result!.xml).toContain("seq-pg001_p001")
    expect(result!.xml).not.toContain("seq-pg001_p002")
    // Total duration excludes the skipped paragraph.
    expect(result!.durationSeconds).toBeCloseTo(0.5, 5)
  })

  it("returns null when no paragraph produces audio", () => {
    const result = buildSmil({
      pageHref: "../pg001.xhtml",
      paragraphs: [para("pg001_p001", "../en/audio/pg001_p001.mp3", ["w001"], [], 0)],
    })
    expect(result).toBeNull()
  })

  it("returns null for an empty paragraphs list", () => {
    const result = buildSmil({ pageHref: "../pg001.xhtml", paragraphs: [] })
    expect(result).toBeNull()
  })

  it("emits one <seq> per paragraph in input order, with stable par ids", () => {
    const result = buildSmil({
      pageHref: "../pg001.xhtml",
      paragraphs: [
        para("pg001_p001", "../audio/a.mp3", ["w_a_001"], [{ word: "a", start: 0, end: 0.1 }]),
        para("pg001_p002", "../audio/b.mp3", ["w_b_001"], [{ word: "b", start: 0, end: 0.2 }]),
      ],
    })
    expect(result).not.toBeNull()
    // Sequences appear in input order.
    const seqOrder = (result!.xml.match(/seq id="seq-(pg001_p\d{3})"/g) ?? []).map((m) => m)
    expect(seqOrder).toEqual([
      'seq id="seq-pg001_p001"',
      'seq id="seq-pg001_p002"',
    ])
    // Par ids are zero-padded and unique across sequences.
    expect(result!.xml).toContain('par id="par0001"')
    expect(result!.xml).toContain('par id="par0002"')
  })

  it("attaches epub:textref on <seq> pointing to the paragraph fragment", () => {
    const result = buildSmil({
      pageHref: "../pg001.xhtml",
      paragraphs: [
        para("pg001_p001", "../audio/a.mp3", ["w001"], [{ word: "a", start: 0, end: 0.1 }]),
      ],
    })
    expect(result).not.toBeNull()
    expect(result!.xml).toContain(
      'epub:textref="../pg001.xhtml#pg001_p001"',
    )
  })

  it("formats clock values with millisecond precision", () => {
    const result = buildSmil({
      pageHref: "../pg001.xhtml",
      paragraphs: [
        para(
          "pg001_p001",
          "../audio/a.mp3",
          ["w001"],
          [{ word: "a", start: 1.234567, end: 5.678901 }],
        ),
      ],
    })
    expect(result).not.toBeNull()
    // Three decimal places — matches SMIL convention + epubcheck expectations.
    expect(result!.xml).toContain('clipBegin="1.235s" clipEnd="5.679s"')
  })

  it("escapes XML special chars in ids and paths", () => {
    const result = buildSmil({
      pageHref: '../page&with"quote.xhtml',
      paragraphs: [
        para(
          'p&id"001',
          '../a&b.mp3',
          ['p&id"001_w001'],
          [{ word: "x", start: 0, end: 0.1 }],
        ),
      ],
    })
    expect(result).not.toBeNull()
    expect(result!.xml).toContain("&amp;")
    expect(result!.xml).toContain("&quot;")
    expect(result!.xml).not.toContain('"&"')
  })

  it("aggregates audioDuration across all included paragraphs", () => {
    const result = buildSmil({
      pageHref: "../pg001.xhtml",
      paragraphs: [
        para("pg001_p001", "../a.mp3", ["w001"], [{ word: "a", start: 0, end: 0.5 }], 0.5),
        para("pg001_p002", "../b.mp3", ["w001"], [{ word: "b", start: 0, end: 1.2 }], 1.2),
      ],
    })
    expect(result).not.toBeNull()
    expect(result!.durationSeconds).toBeCloseTo(1.7, 5)
  })
})

describe("formatMediaDuration", () => {
  it("formats seconds as PT{n}S with 3 decimals", () => {
    expect(formatMediaDuration(12.345)).toBe("PT12.345S")
    expect(formatMediaDuration(0)).toBe("PT0.000S")
    expect(formatMediaDuration(123.4567)).toBe("PT123.457S")
  })
})
