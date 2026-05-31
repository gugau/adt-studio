/**
 * Google Fonts registry.
 *
 * PDFs name their fonts by PostScript name (e.g. `MouseMemoirs`,
 * `ABCDEF+MouseMemoirs-Regular`). When that font is available on Google
 * Fonts we want to (a) emit the *Google* family name as the CSS
 * `font-family` so it matches the `@font-face` we load, and (b) load that
 * family from Google Fonts. Fonts not in this registry keep their declared
 * name and fall back to the bundled Merriweather.
 *
 * This is pure constant data plus small string helpers — shared by
 * extraction (`@adt/pdf` `cssFontFamily`, which emits the family name) and
 * packaging/preview (`@adt/pipeline`, which loads the font). Add entries as
 * new source fonts are encountered; only include families that genuinely
 * exist on Google Fonts.
 */

export interface GoogleFontEntry {
  /** Normalized lookup key (lowercase, alphanumerics only). */
  key: string
  /** Google Fonts family display name, used verbatim as the CSS family
   *  name AND (space→`+`) in the css2 request URL. */
  family: string
}

/**
 * Known PDF-font-name → Google-Fonts-family mappings. Keys are normalized
 * (see `normalizeFontKey`); list both the spaced and unspaced spellings is
 * unnecessary because lookup normalizes the query too.
 */
export const GOOGLE_FONTS: readonly GoogleFontEntry[] = [
  { key: "mousememoirs", family: "Mouse Memoirs" },
]

/** Normalize a font name to a lookup key: drop everything but letters and
 *  digits, lowercase. So `Mouse Memoirs`, `MouseMemoirs`, `MOUSEMEMOIRS-Regular`
 *  (after suffix stripping) all collapse to `mousememoirs`. */
export function normalizeFontKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "")
}

/**
 * Resolve a declared font name (or a CSS font-family chain — only the first
 * token is considered) to a known Google Fonts family, or null. Strips
 * surrounding quotes and a PDF subset prefix (`ABCDEF+`) before matching.
 */
export function resolveGoogleFont(declared: string): GoogleFontEntry | null {
  if (!declared) return null
  // First token of a comma chain, unquoted.
  let token = declared.split(",")[0].trim().replace(/^["']|["']$/g, "")
  // Drop a PDF subset prefix like "ABCDEF+".
  token = token.replace(/^[A-Z]{6}\+/, "")
  // Drop a PostScript style suffix ("-Regular", "-Bold", …).
  const dash = token.indexOf("-")
  if (dash > 0) token = token.slice(0, dash)
  const key = normalizeFontKey(token)
  if (!key) return null
  return GOOGLE_FONTS.find((f) => f.key === key) ?? null
}

/** Wrap a CSS family name in SINGLE quotes when it contains whitespace.
 *  Single quotes (not double) because these values are serialized into
 *  double-quoted inline `style="..."` attributes — an embedded double quote
 *  would terminate the attribute and drop the whole style. CSS accepts
 *  either quote style for family names. */
export function cssQuoteFamily(family: string): string {
  return /\s/.test(family) ? `'${family}'` : family
}

/**
 * Build a Google Fonts css2 stylesheet URL for the given family display
 * names, or null when the list is empty. Families are de-duplicated and
 * emitted in input order. `display=swap` matches the bundled Merriweather.
 */
export function googleFontsCss2Url(families: string[]): string | null {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const f of families) {
    if (!f || seen.has(f)) continue
    seen.add(f)
    unique.push(f)
  }
  if (unique.length === 0) return null
  const params = unique
    .map((f) => `family=${f.trim().replace(/\s+/g, "+")}`)
    .join("&")
  return `https://fonts.googleapis.com/css2?${params}&display=swap`
}

/**
 * Scan arbitrary rendered HTML/CSS text and return the Google Fonts family
 * display names referenced in it (those whose `@font-face` we should load).
 * Matches the family name verbatim (the extractor emits the Google family
 * name), so a page that uses `font-family:"Mouse Memoirs",...` is detected.
 */
export function googleFontsReferencedIn(text: string): string[] {
  if (!text) return []
  const found: string[] = []
  for (const f of GOOGLE_FONTS) {
    if (text.includes(f.family)) found.push(f.family)
  }
  return found
}
