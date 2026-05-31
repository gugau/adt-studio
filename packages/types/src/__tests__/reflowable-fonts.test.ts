import { describe, it, expect } from "vitest"
import {
  resolveReflowableFont,
  reflowableFontFamilyChain,
} from "../reflowable-fonts.js"

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
})
