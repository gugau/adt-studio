import { describe, it, expect } from "vitest"
import {
  REFLOWABLE_FONTS,
  REFLOWABLE_FONT_SETTINGS,
  resolveReflowableFont,
  reflowableFontFamilyChain,
  classifyFontCategoryByName,
} from "../reflowable-fonts.js"

describe("classifyFontCategoryByName", () => {
  it("classifies common sans fonts by name (mupdf isSerif misflags these)", () => {
    expect(classifyFontCategoryByName("LKHXKC+HelveticaNeueLTStd-Lt")).toBe("sans")
    expect(classifyFontCategoryByName("DYGBCS+MyriadPro-Cond")).toBe("sans")
    expect(classifyFontCategoryByName("Arial-BoldMT")).toBe("sans")
    expect(classifyFontCategoryByName("Calibri")).toBe("sans")
    expect(classifyFontCategoryByName("CenturyGothic")).toBe("sans")
  })

  it("classifies common serif fonts by name", () => {
    expect(classifyFontCategoryByName("TimesNewRomanPSMT")).toBe("serif")
    expect(classifyFontCategoryByName("ABCDEF+MinionPro-Regular")).toBe("serif")
    expect(classifyFontCategoryByName("Georgia")).toBe("serif")
    expect(classifyFontCategoryByName("EB Garamond")).toBe("serif")
  })

  it("returns null when the name carries no signal", () => {
    expect(classifyFontCategoryByName("ABCDEF+Font1")).toBeNull()
    expect(classifyFontCategoryByName("")).toBeNull()
  })
})

describe("resolveReflowableFont", () => {
  it("picks the category default when set to auto / unset", () => {
    expect(resolveReflowableFont("auto", "sans").family).toBe("Atkinson Hyperlegible")
    expect(resolveReflowableFont("auto", "serif").family).toBe("Merriweather")
    expect(resolveReflowableFont(undefined, "sans").family).toBe("Atkinson Hyperlegible")
  })

  it("falls back to serif (Merriweather) when the category is unknown", () => {
    expect(resolveReflowableFont(undefined, null).family).toBe("Merriweather")
    expect(resolveReflowableFont("auto", null).family).toBe("Merriweather")
  })

  it("honors an explicit override regardless of category", () => {
    expect(resolveReflowableFont("lexend", "serif").family).toBe("Lexend")
    expect(resolveReflowableFont("lora", "sans").family).toBe("Lora")
    expect(resolveReflowableFont("merriweather", "sans").family).toBe("Merriweather")
  })

  it("ignores an unknown id and uses the category default", () => {
    expect(resolveReflowableFont("bogus", "sans").family).toBe("Atkinson Hyperlegible")
  })

  it("resolves the added sans/serif/handwriting/mono options by id", () => {
    expect(resolveReflowableFont("open-sans", null).family).toBe("Open Sans")
    expect(resolveReflowableFont("roboto", null).family).toBe("Roboto")
    expect(resolveReflowableFont("inter", null).family).toBe("Inter")
    expect(resolveReflowableFont("noto-serif", null).family).toBe("Noto Serif")
    expect(resolveReflowableFont("pt-sans", null).family).toBe("PT Sans")
    expect(resolveReflowableFont("patrick-hand", null).family).toBe("Patrick Hand")
    expect(resolveReflowableFont("edu-nsw-act-foundation", null).family).toBe("Edu NSW ACT Foundation")
    expect(resolveReflowableFont("noto-sans-mono", null).family).toBe("Noto Sans Mono")
  })
})

describe("reflowableFontFamilyChain", () => {
  it("quotes multi-word families and appends Merriweather + generic", () => {
    const sans = resolveReflowableFont("auto", "sans")
    expect(reflowableFontFamilyChain(sans)).toBe(
      "'Atkinson Hyperlegible','Merriweather',sans-serif",
    )
  })

  it("does not double up Merriweather", () => {
    const serif = resolveReflowableFont("auto", "serif")
    expect(reflowableFontFamilyChain(serif)).toBe("Merriweather,serif")
  })

  it("uses the serif generic for serif alternates", () => {
    const lora = resolveReflowableFont("lora", "serif")
    expect(reflowableFontFamilyChain(lora)).toBe("Lora,'Merriweather',serif")
  })

  it("uses cursive/monospace generics (no Merriweather) for handwriting & mono", () => {
    expect(reflowableFontFamilyChain(resolveReflowableFont("patrick-hand", null)))
      .toBe("'Patrick Hand',cursive")
    expect(reflowableFontFamilyChain(resolveReflowableFont("noto-sans-mono", null)))
      .toBe("'Noto Sans Mono',monospace")
  })

  it("inserts Merriweather + sans-serif for sans alternates", () => {
    expect(reflowableFontFamilyChain(resolveReflowableFont("open-sans", null)))
      .toBe("'Open Sans','Merriweather',sans-serif")
  })
})

describe("registry invariants", () => {
  it("keeps REFLOWABLE_FONT_SETTINGS in sync with the font ids (+ auto)", () => {
    expect(REFLOWABLE_FONT_SETTINGS).toEqual(["auto", ...REFLOWABLE_FONTS.map((f) => f.id)])
  })

  it("has exactly one default for each auto-detected category", () => {
    for (const cat of ["serif", "sans"] as const) {
      const defaults = REFLOWABLE_FONTS.filter((f) => f.category === cat && f.role === "default")
      expect(defaults).toHaveLength(1)
    }
  })
})
