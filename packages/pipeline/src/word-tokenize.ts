/**
 * Word-boundary tokenizer. Single source of truth for how text is split into
 * words anywhere a `<span id="…_wNNN">` is emitted — the fixed-layout
 * renderer, its translation runtime mirror, and packaging-time reflowable
 * word-wrapping all consume this. Whisper word counts and SMIL
 * `<text src="…#…"/>` fragment ids only line up if all of those use the
 * same boundary rule.
 *
 * The pattern matches one or more Unicode letters/numbers/marks, optionally
 * extended via apostrophe (straight or curly) or hyphen, so contractions
 * (`don't`, `it's`) and hyphenated compounds (`well-known`) stay as single
 * words. Punctuation, whitespace, and `<br/>` substitutions become
 * separators — they sit outside word spans so word measurement / contrast
 * checks aren't affected by surrounding glyphs.
 *
 * Mirrors `WORD_PATTERN` in `assets/adt/modules/tts_highlighter_utils.js`;
 * the viewer runtime can't import from TS yet, so the regex is duplicated.
 * The parity assertion in `__tests__/word-tokenize.test.ts` guards drift.
 *
 * Scripts that don't separate words by whitespace (Chinese, Japanese, Thai)
 * are out of scope here — they need a dedicated segmenter and Whisper
 * alignment is unreliable for those anyway.
 */
export const WORD_PATTERN = /[\p{L}\p{N}\p{M}]+(?:[’'-][\p{L}\p{N}\p{M}]+)*/gu

export interface WordToken {
  type: "word"
  /** The matched word text. */
  text: string
  /** 0-based character offset into the tokenized string. */
  start: number
  /** Exclusive end offset. */
  end: number
  /** 0-based index across the word tokens of this string. */
  wordIndex: number
}

export interface SeparatorToken {
  type: "separator"
  text: string
  start: number
  end: number
}

export type TokenSegment = WordToken | SeparatorToken

/**
 * Tokenise `text` into alternating word / separator segments with character
 * offsets. Concatenating segment `.text` reproduces the input exactly, so
 * callers can re-emit the text losslessly while wrapping only words.
 *
 * Use the offsets to map back to a parent data model (e.g. style-run
 * segments in a fixed-layout paragraph) — see
 * `fixed-layout-rendering.ts:renderSegmentsToHtml` for the overlap-mapping
 * pattern.
 */
export function tokenizeWords(text: string): TokenSegment[] {
  const segments: TokenSegment[] = []
  // Local regex instance so concurrent callers don't share `.lastIndex`.
  const re = new RegExp(WORD_PATTERN.source, WORD_PATTERN.flags)
  let lastIndex = 0
  let wordIndex = 0

  for (let match = re.exec(text); match !== null; match = re.exec(text)) {
    const start = match.index
    const end = start + match[0].length
    if (start > lastIndex) {
      segments.push({
        type: "separator",
        text: text.slice(lastIndex, start),
        start: lastIndex,
        end: start,
      })
    }
    segments.push({
      type: "word",
      text: match[0],
      start,
      end,
      wordIndex,
    })
    wordIndex += 1
    lastIndex = end
  }

  if (lastIndex < text.length) {
    segments.push({
      type: "separator",
      text: text.slice(lastIndex),
      start: lastIndex,
      end: text.length,
    })
  }

  return segments
}

/** Convenience: just the word strings, in order. */
export function extractWords(text: string): string[] {
  return tokenizeWords(text).flatMap((s) => (s.type === "word" ? [s.text] : []))
}
