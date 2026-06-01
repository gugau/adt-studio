/**
 * mupdf colour → CSS hex conversion. Shared by structured-text styling
 * (`positioned-text.ts`) and the page-stream recorder so a path op's paint
 * and a text run's colour are derived identically.
 */
import { type Color } from "mupdf"

/**
 * Convert a mupdf Color (1, 3, or 4 floats in 0..1 — Gray / RGB / CMYK)
 * to `#rrggbb`. CMYK uses the naive `r=(1-c)(1-k)` conversion (known
 * limitation: ignores ICC profiles; matches what the rest of extraction
 * does so colours stay consistent across text and vectors).
 */
export function colorToCss(color: Color): string {
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
