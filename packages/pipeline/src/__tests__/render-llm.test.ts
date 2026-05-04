import { describe, expect, it } from "vitest"
import { collectOptionalTextIds } from "../render-llm.js"

describe("collectOptionalTextIds", () => {
  it("marks single-underscore blank-cell leaves as optional (crossword cells)", () => {
    const optional = collectOptionalTextIds([
      { text_id: "n1", text_type: "activity_fill_in_the_blank", text: "_" },
      { text_id: "n2", text_type: "activity_fill_in_the_blank", text: "__" },
      { text_id: "n3", text_type: "activity_fill_in_the_blank", text: "___" },
    ])
    expect(optional.has("n1")).toBe(true)
    expect(optional.has("n2")).toBe(true)
    expect(optional.has("n3")).toBe(true)
  })

  it("marks visible letters as required (not optional)", () => {
    const optional = collectOptionalTextIds([
      { text_id: "n1", text_type: "activity_fill_in_the_blank", text: "R" },
      { text_id: "n2", text_type: "activity_fill_in_the_blank", text: "E" },
    ])
    expect(optional.has("n1")).toBe(false)
    expect(optional.has("n2")).toBe(false)
  })

  it("marks footer/header/page_number roles as optional", () => {
    const optional = collectOptionalTextIds([
      { text_id: "f1", text_type: "footer", text: "Some footer text" },
      { text_id: "h1", text_type: "header", text: "Header" },
      { text_id: "p1", text_type: "page_number", text: "42" },
    ])
    expect(optional.has("f1")).toBe(true)
    expect(optional.has("h1")).toBe(true)
    expect(optional.has("p1")).toBe(true)
  })

  it("marks placeholder-only text with underscores and separators as optional", () => {
    const optional = collectOptionalTextIds([
      { text_id: "n1", text_type: "activity_fill_in_the_blank", text: "_ _ _" },
      { text_id: "n2", text_type: "activity_fill_in_the_blank", text: "___/___/___" },
      { text_id: "n3", text_type: "activity_fill_in_the_blank", text: "..." },
    ])
    expect(optional.has("n1")).toBe(true)
    expect(optional.has("n2")).toBe(true)
    expect(optional.has("n3")).toBe(true)
  })

  it("does not mark mixed text-with-blank leaves as optional", () => {
    const optional = collectOptionalTextIds([
      { text_id: "n1", text_type: "activity_fill_in_the_blank", text: "Nombre: ___" },
      { text_id: "n2", text_type: "activity_fill_in_the_blank", text: "El Sol es una ___" },
    ])
    expect(optional.has("n1")).toBe(false)
    expect(optional.has("n2")).toBe(false)
  })

  it("does not match a single dot (normal punctuation)", () => {
    const optional = collectOptionalTextIds([
      { text_id: "n1", text_type: "text", text: "." },
    ])
    expect(optional.has("n1")).toBe(false)
  })

  it("matches a stateful regex consistently across repeated calls", () => {
    const leaves = [
      { text_id: "n1", text_type: "activity_fill_in_the_blank", text: "_" },
    ]
    expect(collectOptionalTextIds(leaves).has("n1")).toBe(true)
    expect(collectOptionalTextIds(leaves).has("n1")).toBe(true)
    expect(collectOptionalTextIds(leaves).has("n1")).toBe(true)
  })
})
