// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import TextValidator from "../../../../assets/adt/modules/activities/textvalidator.js"

declare global {
  interface Window {
    appConfig?: {
      languages?: {
        default?: string
      }
    }
  }
}

afterEach(() => {
  document.documentElement.lang = ""
  window.localStorage.clear()
  delete window.appConfig
})

describe("activity TextValidator", () => {
  it("accepts ordinary English short answers when English is selected", async () => {
    document.documentElement.lang = "en"

    const validator = new TextValidator()
    await validator.ensureInitialized()

    await expect(validator.isValidText("trust")).resolves.toBe(true)
    await expect(validator.isValidText("fire")).resolves.toBe(true)
    await expect(validator.isValidText("sleep")).resolves.toBe(true)
  })

  it("uses the configured default language when document lang is not set", async () => {
    window.appConfig = { languages: { default: "en" } }

    const validator = new TextValidator()
    await validator.ensureInitialized()

    await expect(validator.isValidText("trust")).resolves.toBe(true)
  })

  it("still rejects obvious keyboard mashing for English answers", async () => {
    document.documentElement.lang = "en"

    const validator = new TextValidator()
    await validator.ensureInitialized()

    await expect(validator.isValidText("asdf")).resolves.toBe(false)
  })
})
