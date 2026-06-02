// @vitest-environment jsdom
import { describe, expect, it } from "vitest"

import { applyPlainTextWithLineBreaks } from "./text-formatting"

describe("Easy Read text formatting", () => {
  it("renders newline-separated Easy Read bullets as text plus real line breaks", () => {
    document.body.innerHTML = "<p></p>"
    const element = document.querySelector("p")
    expect(element).not.toBeNull()

    applyPlainTextWithLineBreaks(
      element as HTMLElement,
      "Por ejemplo:\n- politica\n- social\n- cultural",
    )

    expect(element?.textContent).toBe("Por ejemplo:- politica- social- cultural")
    expect(element?.innerHTML).toBe("Por ejemplo:<br>- politica<br>- social<br>- cultural")
  })

  it("does not interpret generated Easy Read text as HTML", () => {
    document.body.innerHTML = "<p></p>"
    const element = document.querySelector("p")
    expect(element).not.toBeNull()

    applyPlainTextWithLineBreaks(
      element as HTMLElement,
      "Texto <strong>simple</strong>",
    )

    expect(element?.querySelector("strong")).toBeNull()
    expect(element?.innerHTML).toBe("Texto &lt;strong&gt;simple&lt;/strong&gt;")
  })
})
