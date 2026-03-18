import { describe, expect, it } from "vitest"
import { getReviewerValidationDefaultReason } from "./reviewer-validation-defaults"

describe("getReviewerValidationDefaultReason", () => {
  it("returns consistent copy for non-language-specific defaults", () => {
    expect(getReviewerValidationDefaultReason("page-has-no-images")).toBe(
      "Defaulted to N/A because this page does not contain any images.",
    )
    expect(getReviewerValidationDefaultReason("page-has-no-activity")).toBe(
      "Defaulted to N/A because this page does not contain an interactive activity or exercise.",
    )
    expect(getReviewerValidationDefaultReason("easy-read-unavailable")).toBe(
      "Defaulted to N/A because Easy Read output is not currently available for this book.",
    )
    expect(getReviewerValidationDefaultReason("sign-language-unavailable")).toBe(
      "Defaulted to N/A because sign language is not enabled for this book.",
    )
    expect(getReviewerValidationDefaultReason("glossary-unavailable")).toBe(
      "Defaulted to N/A because Glossary has not been generated for this book yet.",
    )
  })

  it("supports language-aware default reasons", () => {
    expect(
      getReviewerValidationDefaultReason("text-and-speech-language-unavailable", { language: "sw" }),
    ).toBe("Defaulted to N/A because no Text & Speech audio is available for sw.")
    expect(
      getReviewerValidationDefaultReason("translation-language-unavailable", { language: "fr" }),
    ).toBe("Defaulted to N/A because no translation output is available for fr.")
  })
})
