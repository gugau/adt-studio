/**
 * Approved reflowable body fonts.
 *
 * Reflowable render types (`llm`, `template`, `activity`) reconstruct text into
 * uniform, accessible typography rather than reproducing the PDF's (often
 * many) fonts. We pick ONE book-level base font from this vetted set, chosen
 * for legibility and broad Latin coverage. The book's detected category
 * (serif vs sans — see the extraction font profile) selects the default; a
 * book-level `reflowable_font` config setting can override to any approved id.
 *
 * Fixed-layout / overlay books are unaffected — they keep the original per-run
 * PDF fonts.
 */
import { cssQuoteFamily } from "./google-fonts.js"

export type FontCategory = "serif" | "sans"

export interface ReflowableFont {
  /** Stable id used by the `reflowable_font` config setting. */
  id: string
  /** Google Fonts / CSS family display name. */
  family: string
  category: FontCategory
  /** Per-category default vs. selectable alternate. */
  role: "default" | "alternate"
  /** true → loaded from Google Fonts; false → bundled locally (Merriweather). */
  google: boolean
}

export const REFLOWABLE_FONTS: readonly ReflowableFont[] = [
  { id: "atkinson-hyperlegible", family: "Atkinson Hyperlegible", category: "sans", role: "default", google: true },
  { id: "lexend", family: "Lexend", category: "sans", role: "alternate", google: true },
  { id: "merriweather", family: "Merriweather", category: "serif", role: "default", google: false },
  { id: "lora", family: "Lora", category: "serif", role: "alternate", google: true },
]

/** Valid values for the `reflowable_font` config setting. `auto` (or unset)
 *  uses the detected category's default. */
export const REFLOWABLE_FONT_SETTINGS = [
  "auto",
  "atkinson-hyperlegible",
  "lexend",
  "merriweather",
  "lora",
] as const
export type ReflowableFontSetting = (typeof REFLOWABLE_FONT_SETTINGS)[number]

function defaultForCategory(category: FontCategory): ReflowableFont {
  // Non-null: every category has exactly one default in the table above.
  return REFLOWABLE_FONTS.find((f) => f.category === category && f.role === "default")!
}

/**
 * Resolve the reflowable body font: an explicit `setting` (other than `auto`)
 * wins; otherwise the detected category's default, falling back to serif
 * (Merriweather) when the category is unknown.
 */
export function resolveReflowableFont(
  setting: string | undefined,
  detected: FontCategory | null,
): ReflowableFont {
  if (setting && setting !== "auto") {
    const explicit = REFLOWABLE_FONTS.find((f) => f.id === setting)
    if (explicit) return explicit
  }
  return defaultForCategory(detected ?? "serif")
}

/**
 * CSS font-family chain for a reflowable font: the family, then the always-
 * bundled Merriweather and the category generic as fallbacks (so text is
 * legible before/without the webfont). Merriweather itself needs no extra
 * fallback beyond the generic.
 */
export function reflowableFontFamilyChain(font: ReflowableFont): string {
  const generic = font.category === "serif" ? "serif" : "sans-serif"
  const fam = cssQuoteFamily(font.family)
  return font.family === "Merriweather" ? `${fam},${generic}` : `${fam},'Merriweather',${generic}`
}
