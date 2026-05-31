import { describe, it, expect } from "vitest"
import {
  GOOGLE_FONTS,
  resolveGoogleFont,
  googleFontsCss2Url,
  googleFontsReferencedIn,
  cssQuoteFamily,
  normalizeFontKey,
} from "../google-fonts.js"

describe("resolveGoogleFont", () => {
  it("matches a known font regardless of spacing/case/suffix", () => {
    expect(resolveGoogleFont("MouseMemoirs")?.family).toBe("Mouse Memoirs")
    expect(resolveGoogleFont("Mouse Memoirs")?.family).toBe("Mouse Memoirs")
    expect(resolveGoogleFont("MOUSEMEMOIRS-Regular")?.family).toBe("Mouse Memoirs")
  })

  it("matches the first token of a css font-family chain, unquoted", () => {
    expect(resolveGoogleFont(`"Mouse Memoirs",Merriweather,serif`)?.family).toBe(
      "Mouse Memoirs",
    )
  })

  it("strips a PDF subset prefix before matching", () => {
    expect(resolveGoogleFont("ABCDEF+MouseMemoirs")?.family).toBe("Mouse Memoirs")
  })

  it("returns null for empty input", () => {
    expect(resolveGoogleFont("")).toBeNull()
  })

  it("maps well-known proprietary/system fonts to close Google families", () => {
    expect(resolveGoogleFont("Arial")?.family).toBe("Arimo")
    expect(resolveGoogleFont("Helvetica")?.family).toBe("Arimo")
    expect(resolveGoogleFont("TimesNewRomanPSMT")?.family).toBe("Tinos")
    expect(resolveGoogleFont("Times New Roman")?.family).toBe("Tinos")
    expect(resolveGoogleFont("CourierNew")?.family).toBe("Cousine")
    expect(resolveGoogleFont("Calibri")?.family).toBe("Carlito")
    expect(resolveGoogleFont("Cambria")?.family).toBe("Caladea")
    expect(resolveGoogleFont("Georgia")?.family).toBe("Gelasio")
    expect(resolveGoogleFont("ComicSansMS")?.family).toBe("Comic Neue")
  })

  it("falls back to a category close-match for unrecognized sans/mono/script", () => {
    expect(resolveGoogleFont("FuturaBT")?.family).toBe("Arimo") // sans token
    expect(resolveGoogleFont("ProximaNova")?.family).toBe("Arimo")
    expect(resolveGoogleFont("SomeMonoFont")?.family).toBe("Cousine")
    expect(resolveGoogleFont("BrushScriptStd")?.family).toBe("Caveat")
  })

  it("keeps serif / unknown fonts unmapped (bundled Merriweather fallback)", () => {
    expect(resolveGoogleFont("Palatino")).toBeNull()
    expect(resolveGoogleFont("Garamond")).toBeNull()
    expect(resolveGoogleFont("Baskerville")).toBeNull()
  })

  it("only resolves to loadable families (every result is in GOOGLE_FONTS)", () => {
    const names = ["Arial", "Calibri", "ComicSansMS", "FuturaBT", "SomeMonoFont", "BrushScript"]
    for (const n of names) {
      const r = resolveGoogleFont(n)
      if (r) expect(GOOGLE_FONTS.some((f) => f.family === r.family)).toBe(true)
    }
  })
})

describe("googleFontsCss2Url", () => {
  it("builds a css2 url with + for spaces and display=swap", () => {
    expect(googleFontsCss2Url(["Mouse Memoirs"])).toBe(
      "https://fonts.googleapis.com/css2?family=Mouse+Memoirs&display=swap",
    )
  })

  it("de-duplicates families and joins with &family=", () => {
    expect(googleFontsCss2Url(["Mouse Memoirs", "Mouse Memoirs"])).toBe(
      "https://fonts.googleapis.com/css2?family=Mouse+Memoirs&display=swap",
    )
  })

  it("returns null for an empty list", () => {
    expect(googleFontsCss2Url([])).toBeNull()
  })
})

describe("googleFontsReferencedIn", () => {
  it("detects the Google family name in rendered html", () => {
    const html = `<span style="font-family:&quot;Mouse Memoirs&quot;,serif">x</span>`
    expect(googleFontsReferencedIn(html)).toEqual(["Mouse Memoirs"])
  })

  it("returns nothing when no registered family appears", () => {
    expect(googleFontsReferencedIn(`font-family:Palatino,serif`)).toEqual([])
  })
})

describe("cssQuoteFamily / normalizeFontKey", () => {
  it("single-quotes families with whitespace only (safe inside style=\"...\")", () => {
    expect(cssQuoteFamily("Mouse Memoirs")).toBe("'Mouse Memoirs'")
    expect(cssQuoteFamily("Mouse Memoirs")).not.toContain('"')
    expect(cssQuoteFamily("Merriweather")).toBe("Merriweather")
  })

  it("normalizes to lowercase alphanumerics", () => {
    expect(normalizeFontKey("Mouse Memoirs-Regular")).toBe("mousememoirsregular")
  })
})
