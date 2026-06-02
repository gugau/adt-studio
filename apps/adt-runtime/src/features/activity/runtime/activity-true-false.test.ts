// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { getDefaultStore } from "jotai"
import { initializeTrueFalseActivity } from "./activity-true-false"
import {
  skipEnabledAtom,
  submitEnabledAtom,
  submitStateAtom,
  validateHandlerAtom,
} from "../state/activity.atoms"
import { pagesAtom, currentSectionIdAtom } from "../../navigation/state/nav.atoms"

const store = getDefaultStore()

function setupTwoQuestions(): void {
  document.body.innerHTML = `
    <section data-section-type="activity_true_false" data-section-id="pg005_sec001">
      <fieldset class="border-0 m-0 p-0">
        <legend><span data-id="text-1">Q1 statement.</span></legend>
        <label for="q1-yes">
          <input id="q1-yes" name="q1" type="radio" value="true" data-activity-item="item-1" />
          <div>Yes<span class="validation-mark hidden"></span></div>
        </label>
        <label for="q1-no">
          <input id="q1-no" name="q1" type="radio" value="false" data-activity-item="item-1" />
          <div>No<span class="validation-mark hidden"></span></div>
        </label>
      </fieldset>
      <fieldset class="border-0 m-0 p-0">
        <legend><span data-id="text-2">Q2 statement.</span></legend>
        <label for="q2-yes">
          <input id="q2-yes" name="q2" type="radio" value="true" data-activity-item="item-2" />
          <div>Yes<span class="validation-mark hidden"></span></div>
        </label>
        <label for="q2-no">
          <input id="q2-no" name="q2" type="radio" value="false" data-activity-item="item-2" />
          <div>No<span class="validation-mark hidden"></span></div>
        </label>
      </fieldset>
    </section>
  `
  window.correctAnswers = { "item-1": "true", "item-2": "false" }
}

beforeEach(() => {
  document.body.innerHTML = ""
  window.correctAnswers = undefined
  store.set(submitEnabledAtom, false)
  store.set(skipEnabledAtom, false)
  store.set(submitStateAtom, "submit")
  store.set(validateHandlerAtom, () => null)
  store.set(pagesAtom, [
    { section_id: "pg005_sec001", href: "pg005_sec001.html" },
    { section_id: "next", href: "next.html" },
  ])
  store.set(currentSectionIdAtom, "pg005_sec001")
})

describe("initializeTrueFalseActivity", () => {
  it("returns null when there is no true-false section on the page", () => {
    document.body.innerHTML = "<main>plain page</main>"
    expect(initializeTrueFalseActivity()).toBeNull()
  })

  it("enables submit only after the user picks an option", () => {
    setupTwoQuestions()
    initializeTrueFalseActivity()
    expect(store.get(submitEnabledAtom)).toBe(false)

    const radio = document.querySelector<HTMLInputElement>("#q1-yes")!
    radio.checked = true
    radio.dispatchEvent(new Event("change", { bubbles: true }))
    expect(store.get(submitEnabledAtom)).toBe(true)
  })

  it("flips to next state when every question is answered correctly", () => {
    setupTwoQuestions()
    initializeTrueFalseActivity()

    const q1yes = document.querySelector<HTMLInputElement>("#q1-yes")!
    q1yes.checked = true
    q1yes.dispatchEvent(new Event("change", { bubbles: true }))
    const q2no = document.querySelector<HTMLInputElement>("#q2-no")!
    q2no.checked = true
    q2no.dispatchEvent(new Event("change", { bubbles: true }))

    store.get(validateHandlerAtom)?.()
    expect(store.get(submitStateAtom)).toBe("next")
  })

  it("marks the wrong pick with a cross and stays in submit state", () => {
    setupTwoQuestions()
    initializeTrueFalseActivity()

    const q1no = document.querySelector<HTMLInputElement>("#q1-no")!
    q1no.checked = true
    q1no.dispatchEvent(new Event("change", { bubbles: true }))
    const q2no = document.querySelector<HTMLInputElement>("#q2-no")!
    q2no.checked = true
    q2no.dispatchEvent(new Event("change", { bubbles: true }))

    store.get(validateHandlerAtom)?.()
    expect(store.get(submitStateAtom)).toBe("submit")

    const wrongMark = q1no.closest("label")!.querySelector(".validation-mark")!
    expect(wrongMark.classList.contains("hidden")).toBe(false)
    expect(wrongMark.innerHTML).toContain("fa-times-circle")
    const rightMark = q2no.closest("label")!.querySelector(".validation-mark")!
    expect(rightMark.innerHTML).toContain("fa-check-circle")
  })

  it("clears the validation mark on the affected question when the user changes their pick", () => {
    setupTwoQuestions()
    initializeTrueFalseActivity()

    const q1no = document.querySelector<HTMLInputElement>("#q1-no")!
    q1no.checked = true
    q1no.dispatchEvent(new Event("change", { bubbles: true }))
    store.get(validateHandlerAtom)?.()
    const wrongMark = q1no.closest("label")!.querySelector(".validation-mark")!
    expect(wrongMark.classList.contains("hidden")).toBe(false)

    const q1yes = document.querySelector<HTMLInputElement>("#q1-yes")!
    q1yes.checked = true
    q1no.checked = false
    q1yes.dispatchEvent(new Event("change", { bubbles: true }))

    expect(wrongMark.classList.contains("hidden")).toBe(true)
    expect(wrongMark.innerHTML).toBe("")
  })

  it("counts an unanswered question as unfilled, not incorrect", () => {
    setupTwoQuestions()
    initializeTrueFalseActivity()

    const q1yes = document.querySelector<HTMLInputElement>("#q1-yes")!
    q1yes.checked = true
    q1yes.dispatchEvent(new Event("change", { bubbles: true }))
    // q2 left blank.
    store.get(validateHandlerAtom)?.()
    expect(store.get(submitStateAtom)).toBe("submit")
    // q1 should still get its correct mark.
    const okMark = q1yes.closest("label")!.querySelector(".validation-mark")!
    expect(okMark.innerHTML).toContain("fa-check-circle")
  })
})
