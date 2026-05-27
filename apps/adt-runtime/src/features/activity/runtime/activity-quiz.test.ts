// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { getDefaultStore } from "jotai"
import { initializeQuizActivity } from "./activity-quiz"
import {
  skipEnabledAtom,
  submitEnabledAtom,
  submitStateAtom,
  validateHandlerAtom,
} from "../state/activity.atoms"
import { pagesAtom, currentSectionIdAtom } from "../../navigation/state/nav.atoms"

const store = getDefaultStore()

function setupStandaloneQuiz(): void {
  document.body.innerHTML = `
    <section data-section-type="activity_quiz" data-section-id="qz001"
             data-correct-answers='{"item-1":true,"item-2":false}'>
      <label class="activity-option" data-activity-item="item-1">
        <div class="feedback-container hidden"><div><span class="feedback-icon"></span><span class="feedback-text"></span></div></div>
        <span>Option 1</span>
      </label>
      <label class="activity-option" data-activity-item="item-2">
        <div class="feedback-container hidden"><div><span class="feedback-icon"></span><span class="feedback-text"></span></div></div>
        <span>Option 2</span>
      </label>
    </section>
  `
}

function setupMultipleChoice(): void {
  document.body.innerHTML = `
    <section data-section-type="activity_multiple_choice" data-section-id="pg002_sec001">
      <div class="questions grow space-y-4" role="group">
        <p>Which is correct?</p>
        <div class="option-container">
          <label class="activity-option">
            <input type="radio" name="q1" value="item-1" data-activity-item="item-1" class="sr-only" />
            <div data-id="text-1">Option 1</div>
            <div class="feedback-container hidden"><div><span class="feedback-icon"></span><span class="feedback-text"></span></div></div>
          </label>
        </div>
        <div class="option-container">
          <label class="activity-option">
            <input type="radio" name="q1" value="item-2" data-activity-item="item-2" class="sr-only" />
            <div data-id="text-2">Option 2</div>
            <div class="feedback-container hidden"><div><span class="feedback-icon"></span><span class="feedback-text"></span></div></div>
          </label>
        </div>
      </div>
    </section>
  `
  window.correctAnswers = { "item-1": true, "item-2": false }
}

beforeEach(() => {
  document.body.innerHTML = ""
  window.correctAnswers = undefined
  store.set(submitEnabledAtom, false)
  store.set(skipEnabledAtom, false)
  store.set(submitStateAtom, "submit")
  store.set(validateHandlerAtom, () => null)
})

describe("initializeQuizActivity — standalone activity_quiz", () => {
  beforeEach(() => {
    store.set(pagesAtom, [
      { section_id: "pg001_sec001", href: "pg001_sec001.html" },
      { section_id: "qz001", href: "qz001.html" },
      { section_id: "pg002_sec001", href: "pg002_sec001.html" },
      { section_id: "qz002", href: "qz002.html" },
    ])
    store.set(currentSectionIdAtom, "qz001")
  })

  it("validates the selected option against data-correct-answers", () => {
    setupStandaloneQuiz()
    initializeQuizActivity()

    const option = document.querySelector<HTMLElement>(
      ".activity-option[data-activity-item='item-1']",
    )!
    option.click()
    expect(store.get(submitEnabledAtom)).toBe(true)

    store.get(validateHandlerAtom)?.()
    expect(store.get(submitStateAtom)).toBe("next")
    expect(store.get(submitEnabledAtom)).toBe(true) // next qz exists
  })

  it("disables next when there is no further quiz to jump to", () => {
    store.set(currentSectionIdAtom, "qz002") // last qz
    setupStandaloneQuiz()
    document.querySelector("section")!.setAttribute("data-section-id", "qz002")
    initializeQuizActivity()

    document
      .querySelector<HTMLElement>(".activity-option[data-activity-item='item-1']")!
      .click()
    store.get(validateHandlerAtom)?.()
    expect(store.get(submitStateAtom)).toBe("next")
    expect(store.get(submitEnabledAtom)).toBe(false)
  })
})

describe("initializeQuizActivity — embedded activity_multiple_choice", () => {
  beforeEach(() => {
    store.set(pagesAtom, [
      { section_id: "pg002_sec001", href: "pg002_sec001.html" },
      { section_id: "pg003_sec001", href: "pg003_sec001.html" },
    ])
    store.set(currentSectionIdAtom, "pg002_sec001")
  })

  it("reads correct answers from window.correctAnswers", () => {
    setupMultipleChoice()
    initializeQuizActivity()

    document
      .querySelector<HTMLInputElement>("input[data-activity-item='item-1']")!
      .closest<HTMLElement>(".activity-option")!
      .click()
    store.get(validateHandlerAtom)?.()
    expect(store.get(submitStateAtom)).toBe("next")
  })

  it("treats a wrong pick as incorrect and stays in submit state", () => {
    setupMultipleChoice()
    initializeQuizActivity()

    document
      .querySelector<HTMLInputElement>("input[data-activity-item='item-2']")!
      .closest<HTMLElement>(".activity-option")!
      .click()
    store.get(validateHandlerAtom)?.()
    expect(store.get(submitStateAtom)).toBe("submit")
  })

  it("post-correct, submit enables for the next sequential page (not the next quiz)", () => {
    setupMultipleChoice()
    initializeQuizActivity()

    document
      .querySelector<HTMLInputElement>("input[data-activity-item='item-1']")!
      .closest<HTMLElement>(".activity-option")!
      .click()
    store.get(validateHandlerAtom)?.()
    expect(store.get(submitStateAtom)).toBe("next")
    // Next page exists in the page list above (pg003_sec001), so enabled.
    expect(store.get(submitEnabledAtom)).toBe(true)
  })
})
