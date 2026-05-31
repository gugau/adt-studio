import { describe, it, expect } from "vitest"
import {
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

  it("returns null for unregistered fonts and empty input", () => {
    expect(resolveGoogleFont("Palatino")).toBeNull()
    expect(resolveGoogleFont("")).toBeNull()
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
