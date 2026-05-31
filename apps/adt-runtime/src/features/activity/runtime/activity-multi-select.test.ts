// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { getDefaultStore } from "jotai"
import { initializeMultiSelectActivity } from "./activity-multi-select"
import {
  skipEnabledAtom,
  submitEnabledAtom,
  submitStateAtom,
  validateHandlerAtom,
} from "../state/activity.atoms"
import { pagesAtom, currentSectionIdAtom } from "../../navigation/state/nav.atoms"

const store = getDefaultStore()

function setupSingleGroup(opts?: { sectionId?: string }): void {
  const sectionId = opts?.sectionId ?? "pg004_sec001"
  document.body.innerHTML = `
    <section data-section-type="activity_multi_select" data-section-id="${sectionId}">
      <div class="questions grow space-y-4" role="group">
        <p>Select all the animals that live in water.</p>
        <div class="option-container">
          <label class="activity-option">
            <input type="checkbox" name="q1" value="item-1" data-activity-item="item-1" class="sr-only" />
            <div data-id="text-1">Fish</div>
          </label>
        </div>
        <div class="option-container">
          <label class="activity-option">
            <input type="checkbox" name="q1" value="item-2" data-activity-item="item-2" class="sr-only" />
            <div data-id="text-2">Lion</div>
          </label>
        </div>
        <div class="option-container">
          <label class="activity-option">
            <input type="checkbox" name="q1" value="item-3" data-activity-item="item-3" class="sr-only" />
            <div data-id="text-3">Frog</div>
          </label>
        </div>
        <div class="option-container">
          <label class="activity-option">
            <input type="checkbox" name="q1" value="item-4" data-activity-item="item-4" class="sr-only" />
            <div data-id="text-4">Bird</div>
          </label>
        </div>
      </div>
    </section>
  `
  // item-1 (Fish) and item-3 (Frog) are correct.
  window.correctAnswers = {
    "item-1": true,
    "item-2": false,
    "item-3": true,
    "item-4": false,
  }
}

function optionFor(itemId: string): HTMLElement {
  return document
    .querySelector<HTMLInputElement>(`input[data-activity-item='${itemId}']`)!
    .closest<HTMLElement>(".activity-option")!
}

beforeEach(() => {
  document.body.innerHTML = ""
  window.correctAnswers = undefined
  store.set(submitEnabledAtom, false)
  store.set(skipEnabledAtom, false)
  store.set(submitStateAtom, "submit")
  store.set(validateHandlerAtom, () => null)
  store.set(pagesAtom, [
    { section_id: "pg004_sec001", href: "pg004_sec001.html" },
    { section_id: "pg005_sec001", href: "pg005_sec001.html" },
  ])
  store.set(currentSectionIdAtom, "pg004_sec001")
})

describe("initializeMultiSelectActivity — single question group", () => {
  it("does nothing when no multi-select section is present", () => {
    document.body.innerHTML = `<section data-section-type="text_only"></section>`
    expect(initializeMultiSelectActivity()).toBeNull()
  })

  it("enables submit when at least one option is checked", () => {
    setupSingleGroup()
    initializeMultiSelectActivity()
    expect(store.get(submitEnabledAtom)).toBe(false)
    optionFor("item-1").click()
    expect(store.get(submitEnabledAtom)).toBe(true)
  })

  it("toggles selection off when the same option is clicked twice", () => {
    setupSingleGroup()
    initializeMultiSelectActivity()
    const opt = optionFor("item-1")
    opt.click()
    expect(opt.getAttribute("aria-checked")).toBe("true")
    opt.click()
    expect(opt.getAttribute("aria-checked")).toBe("false")
    expect(store.get(submitEnabledAtom)).toBe(false)
  })

  it("flips to next when the selected set EQUALS the correct set", () => {
    setupSingleGroup()
    initializeMultiSelectActivity()
    optionFor("item-1").click()
    optionFor("item-3").click()
    store.get(validateHandlerAtom)?.()
    expect(store.get(submitStateAtom)).toBe("next")
  })

  it("stays in submit when a correct option is missed", () => {
    setupSingleGroup()
    initializeMultiSelectActivity()
    optionFor("item-1").click() // only one of the two correct items
    store.get(validateHandlerAtom)?.()
    expect(store.get(submitStateAtom)).toBe("submit")
  })

  it("stays in submit when an incorrect option is also picked", () => {
    setupSingleGroup()
    initializeMultiSelectActivity()
    optionFor("item-1").click()
    optionFor("item-2").click() // wrong
    optionFor("item-3").click()
    store.get(validateHandlerAtom)?.()
    expect(store.get(submitStateAtom)).toBe("submit")
  })

  it("marks only the learner's picks (correct or incorrect) — never reveals the answer key on unchecked options", () => {
    setupSingleGroup()
    initializeMultiSelectActivity()
    // Pick one correct (item-1) and one wrong (item-2); leave item-3 (correct)
    // and item-4 (wrong) unchecked.
    optionFor("item-1").click()
    optionFor("item-2").click()
    store.get(validateHandlerAtom)?.()

    expect(optionFor("item-1").getAttribute("data-ms-style-state")).toBe("correct")
    expect(optionFor("item-2").getAttribute("data-ms-style-state")).toBe("incorrect")
    // Unchecked options get no styling regardless of correctness — the toast
    // tells the learner how many are right and they iterate from there.
    expect(optionFor("item-3").hasAttribute("data-ms-style-state")).toBe(false)
    expect(optionFor("item-4").hasAttribute("data-ms-style-state")).toBe(false)
  })

  it("injects status badges on the learner's picks only — never on unchecked options", () => {
    setupSingleGroup()
    initializeMultiSelectActivity()
    optionFor("item-1").click() // correct
    optionFor("item-2").click() // wrong
    store.get(validateHandlerAtom)?.()

    expect(optionFor("item-1").querySelector("[data-ms-status-badge='correct']")).not.toBeNull()
    expect(optionFor("item-2").querySelector("[data-ms-status-badge='incorrect']")).not.toBeNull()
    // Unchecked correct item: no badge, no outline — the answer key stays hidden.
    expect(optionFor("item-3").querySelector("[data-ms-status-badge]")).toBeNull()
  })

  it("clears verdict styling on the next toggle while preserving the learner's prior selections", () => {
    setupSingleGroup()
    initializeMultiSelectActivity()
    // First attempt: one correct pick + one wrong pick.
    optionFor("item-1").click() // correct
    optionFor("item-2").click() // wrong
    store.get(validateHandlerAtom)?.()
    expect(optionFor("item-1").getAttribute("data-ms-style-state")).toBe("correct")
    expect(optionFor("item-2").getAttribute("data-ms-style-state")).toBe("incorrect")
    expect(optionFor("item-2").querySelector("[data-ms-status-badge]")).not.toBeNull()

    // Toggle a NEW option (item-3 — the missed correct one). Verdict styling
    // and badges should drop across the group, but the two prior picks must
    // stay selected — the learner edits, not starts over.
    optionFor("item-3").click()

    expect(optionFor("item-1").getAttribute("data-ms-style-state")).toBe("selected")
    expect(optionFor("item-2").getAttribute("data-ms-style-state")).toBe("selected")
    expect(optionFor("item-3").getAttribute("data-ms-style-state")).toBe("selected")
    expect(optionFor("item-1").querySelector("[data-ms-status-badge]")).toBeNull()
    expect(optionFor("item-2").querySelector("[data-ms-status-badge]")).toBeNull()
    expect(optionFor("item-1").getAttribute("aria-checked")).toBe("true")
    expect(optionFor("item-2").getAttribute("aria-checked")).toBe("true")
    expect(optionFor("item-3").getAttribute("aria-checked")).toBe("true")
  })

  it("lets the learner deselect a wrong pick after submit without losing the rest", () => {
    setupSingleGroup()
    initializeMultiSelectActivity()
    // First attempt: two correct + one wrong.
    optionFor("item-1").click()
    optionFor("item-2").click() // wrong
    optionFor("item-3").click()
    store.get(validateHandlerAtom)?.()
    expect(store.get(submitStateAtom)).toBe("submit")

    // Uncheck the wrong pick. The two correct picks must remain selected,
    // and re-submitting should now flip to "next" since the selected set
    // matches the correct set.
    optionFor("item-2").click()
    expect(optionFor("item-2").getAttribute("aria-checked")).toBe("false")
    expect(optionFor("item-1").getAttribute("aria-checked")).toBe("true")
    expect(optionFor("item-3").getAttribute("aria-checked")).toBe("true")

    store.get(validateHandlerAtom)?.()
    expect(store.get(submitStateAtom)).toBe("next")
  })

  it("assigns checkbox ARIA semantics to the section and each option", () => {
    setupSingleGroup()
    initializeMultiSelectActivity()
    const section = document.querySelector<HTMLElement>("section")!
    expect(section.getAttribute("role")).toBe("group")
    expect(section.hasAttribute("aria-label")).toBe(true)
    const opt = optionFor("item-1")
    expect(opt.getAttribute("role")).toBe("checkbox")
    expect(opt.getAttribute("aria-checked")).toBe("false")
    opt.click()
    expect(opt.getAttribute("aria-checked")).toBe("true")
  })

  it("syncs selection when the inner checkbox fires `change` (keyboard activation)", () => {
    setupSingleGroup()
    initializeMultiSelectActivity()
    const inner = document.querySelector<HTMLInputElement>(
      "input[data-activity-item='item-1']",
    )!
    inner.checked = true
    inner.dispatchEvent(new Event("change", { bubbles: true }))
    expect(optionFor("item-1").getAttribute("aria-checked")).toBe("true")
    expect(store.get(submitEnabledAtom)).toBe(true)
  })
})

describe("initializeMultiSelectActivity — accessibility", () => {
  it("uses a multi-select-specific section label that conveys 'select all that apply'", () => {
    setupSingleGroup()
    initializeMultiSelectActivity()
    const section = document.querySelector<HTMLElement>("section")!
    expect(section.getAttribute("role")).toBe("group")
    expect(section.getAttribute("aria-label")).toMatch(/select all that apply/i)
  })

  it("hides the inner native checkbox from the accessibility tree and removes its tab stop", () => {
    document.body.innerHTML = `
      <section data-section-type="activity_multi_select" data-section-id="pg004_sec030">
        <div role="group">
          <p>Pick all that apply.</p>
          <label class="activity-option">
            <input type="checkbox" name="q1" value="item-1" data-activity-item="item-1" class="sr-only" tabindex="0" aria-label="Fish" />
            <div>Fish</div>
          </label>
        </div>
      </section>
    `
    window.correctAnswers = { "item-1": true }
    initializeMultiSelectActivity()

    const inner = document.querySelector<HTMLInputElement>(
      "input[data-activity-item='item-1']",
    )!
    // Without these two attributes, screen readers announce the checkbox
    // twice (once for the wrapping label, once for the native input) and
    // keyboard users hit two tab stops per option.
    expect(inner.getAttribute("aria-hidden")).toBe("true")
    expect(inner.getAttribute("tabindex")).toBe("-1")
  })

  it("derives an explicit accessible name on the option from the inner aria-label", () => {
    document.body.innerHTML = `
      <section data-section-type="activity_multi_select" data-section-id="pg004_sec031">
        <div role="group">
          <label class="activity-option">
            <input type="checkbox" name="q1" value="item-1" data-activity-item="item-1" class="sr-only" aria-label="Pelican" />
            <div>Pelican</div>
          </label>
        </div>
      </section>
    `
    window.correctAnswers = { "item-1": true }
    initializeMultiSelectActivity()

    const opt = document
      .querySelector<HTMLInputElement>("input[data-activity-item='item-1']")!
      .closest<HTMLElement>(".activity-option")!
    // The wrapping label is the canonical role="checkbox" surface — AT needs
    // a deterministic name on it, not on the hidden native input.
    expect(opt.getAttribute("aria-label")).toBe("Pelican")
  })

  it("falls back to the option's visible text when the inner input has no aria-label", () => {
    document.body.innerHTML = `
      <section data-section-type="activity_multi_select" data-section-id="pg004_sec032">
        <div role="group">
          <label class="activity-option">
            <input type="checkbox" name="q1" value="item-1" data-activity-item="item-1" class="sr-only" />
            <span>   Frog   </span>
          </label>
        </div>
      </section>
    `
    window.correctAnswers = { "item-1": true }
    initializeMultiSelectActivity()

    const opt = document
      .querySelector<HTMLInputElement>("input[data-activity-item='item-1']")!
      .closest<HTMLElement>(".activity-option")!
    expect(opt.getAttribute("aria-label")).toBe("Frog")
  })

  it("does not overwrite a pre-existing aria-label on the option", () => {
    document.body.innerHTML = `
      <section data-section-type="activity_multi_select" data-section-id="pg004_sec033">
        <div role="group">
          <label class="activity-option" aria-label="Option labelled by the prompt">
            <input type="checkbox" name="q1" value="item-1" data-activity-item="item-1" class="sr-only" aria-label="Inner label" />
            <span>Visible text</span>
          </label>
        </div>
      </section>
    `
    window.correctAnswers = { "item-1": true }
    initializeMultiSelectActivity()

    const opt = document
      .querySelector<HTMLInputElement>("input[data-activity-item='item-1']")!
      .closest<HTMLElement>(".activity-option")!
    expect(opt.getAttribute("aria-label")).toBe("Option labelled by the prompt")
  })

  it("flips aria-invalid on wrong picks and clears it on correct picks after submit", () => {
    setupSingleGroup()
    initializeMultiSelectActivity()
    optionFor("item-1").click() // correct
    optionFor("item-2").click() // wrong
    store.get(validateHandlerAtom)?.()
    // aria-invalid is the standardized non-color cue AT users get when they
    // tab back to a wrong pick after submit.
    expect(optionFor("item-1").getAttribute("aria-invalid")).toBe("false")
    expect(optionFor("item-2").getAttribute("aria-invalid")).toBe("true")
  })

  it("attaches a polite status badge with a localized aria-label per verdict", () => {
    setupSingleGroup()
    initializeMultiSelectActivity()
    optionFor("item-1").click() // correct
    optionFor("item-2").click() // wrong
    store.get(validateHandlerAtom)?.()

    const correctBadge = optionFor("item-1").querySelector<HTMLElement>(
      "[data-ms-status-badge]",
    )!
    const wrongBadge = optionFor("item-2").querySelector<HTMLElement>(
      "[data-ms-status-badge]",
    )!
    // role=status creates an implicit polite live region — the verdict is
    // announced when the badge is injected.
    expect(correctBadge.getAttribute("role")).toBe("status")
    expect(wrongBadge.getAttribute("role")).toBe("status")
    expect(correctBadge.getAttribute("aria-label")).toMatch(/correct/i)
    expect(wrongBadge.getAttribute("aria-label")).toMatch(/incorrect/i)
  })

  it("marks each badge's icon as aria-hidden so AT reads only the badge label", () => {
    setupSingleGroup()
    initializeMultiSelectActivity()
    optionFor("item-1").click()
    store.get(validateHandlerAtom)?.()

    const icon = optionFor("item-1").querySelector<HTMLElement>(
      "[data-ms-status-badge] i",
    )!
    expect(icon.getAttribute("aria-hidden")).toBe("true")
  })
})

describe("initializeMultiSelectActivity — multiple question groups", () => {
  function setupMultiGroup(): void {
    document.body.innerHTML = `
      <section data-section-type="activity_multi_select" data-section-id="pg004_sec010">
        <div role="group">
          <p>Question 1 — pick all that apply.</p>
          <label class="activity-option">
            <input type="checkbox" name="question-group-1" value="item-1" data-activity-item="item-1" class="sr-only" />
            <div data-id="text-1">Q1A (correct)</div>
          </label>
          <label class="activity-option">
            <input type="checkbox" name="question-group-1" value="item-2" data-activity-item="item-2" class="sr-only" />
            <div data-id="text-2">Q1B (correct)</div>
          </label>
          <label class="activity-option">
            <input type="checkbox" name="question-group-1" value="item-3" data-activity-item="item-3" class="sr-only" />
            <div data-id="text-3">Q1C (wrong)</div>
          </label>
        </div>
        <div role="group">
          <p>Question 2 — pick all that apply.</p>
          <label class="activity-option">
            <input type="checkbox" name="question-group-2" value="item-4" data-activity-item="item-4" class="sr-only" />
            <div data-id="text-4">Q2A (wrong)</div>
          </label>
          <label class="activity-option">
            <input type="checkbox" name="question-group-2" value="item-5" data-activity-item="item-5" class="sr-only" />
            <div data-id="text-5">Q2B (correct)</div>
          </label>
        </div>
      </section>
    `
    window.correctAnswers = {
      "item-1": true,
      "item-2": true,
      "item-3": false,
      "item-4": false,
      "item-5": true,
    }
  }

  it("requires every group to satisfy set equality before flipping to next", () => {
    setupMultiGroup()
    initializeMultiSelectActivity()
    // Q1: correct (both correct items picked, no wrong picks).
    optionFor("item-1").click()
    optionFor("item-2").click()
    // Q2: only pick a wrong item — group should be marked wrong.
    optionFor("item-4").click()
    store.get(validateHandlerAtom)?.()
    expect(store.get(submitStateAtom)).toBe("submit")
  })

  it("does not cross-contaminate verdict styling between groups", () => {
    setupMultiGroup()
    initializeMultiSelectActivity()
    optionFor("item-1").click()
    optionFor("item-2").click()
    optionFor("item-5").click()
    store.get(validateHandlerAtom)?.()

    // All three picks are correct, all uncheckeds are distractors.
    expect(store.get(submitStateAtom)).toBe("next")
    expect(optionFor("item-1").getAttribute("data-ms-style-state")).toBe("correct")
    expect(optionFor("item-2").getAttribute("data-ms-style-state")).toBe("correct")
    expect(optionFor("item-5").getAttribute("data-ms-style-state")).toBe("correct")
  })

  it("does NOT reveal the answer key for a group the learner left untouched", () => {
    setupMultiGroup()
    initializeMultiSelectActivity()
    // Only attempt Q1 (correctly); leave Q2 entirely untouched.
    optionFor("item-1").click()
    optionFor("item-2").click()
    store.get(validateHandlerAtom)?.()

    expect(optionFor("item-1").getAttribute("data-ms-style-state")).toBe("correct")
    // Q2 had zero selections — no styling on any option.
    expect(optionFor("item-4").hasAttribute("data-ms-style-state")).toBe(false)
    expect(optionFor("item-5").hasAttribute("data-ms-style-state")).toBe(false)
    expect(store.get(submitStateAtom)).toBe("submit")
  })

  it("does not reveal missed correct options when the learner submits an incomplete set", () => {
    setupMultiGroup()
    initializeMultiSelectActivity()
    // Q1 has TWO correct items (item-1, item-2). Pick only one.
    optionFor("item-1").click()
    optionFor("item-5").click()
    store.get(validateHandlerAtom)?.()

    expect(optionFor("item-1").getAttribute("data-ms-style-state")).toBe("correct")
    expect(optionFor("item-5").getAttribute("data-ms-style-state")).toBe("correct")
    // item-2 was correct but unchecked — must NOT receive any verdict styling.
    expect(optionFor("item-2").hasAttribute("data-ms-style-state")).toBe(false)
    expect(optionFor("item-2").querySelector("[data-ms-status-badge]")).toBeNull()
    expect(store.get(submitStateAtom)).toBe("submit")
  })
})

describe("initializeMultiSelectActivity — fallback structural detection", () => {
  it("picks up options when the LLM omits `.activity-option`", () => {
    document.body.innerHTML = `
      <section data-section-type="activity_multi_select" data-section-id="pg004_sec020">
        <div role="group">
          <div class="grid grid-cols-2 gap-4">
            <label class="relative flex items-center justify-center cursor-pointer">
              <input type="checkbox" name="question-group-1" value="item-1" data-activity-item="item-1" class="sr-only" />
              <img data-id="img-1" src="images/a.png" alt="A" />
            </label>
            <label class="relative flex items-center justify-center cursor-pointer">
              <input type="checkbox" name="question-group-1" value="item-2" data-activity-item="item-2" class="sr-only" />
              <img data-id="img-2" src="images/b.png" alt="B" />
            </label>
          </div>
        </div>
      </section>
    `
    window.correctAnswers = { "item-1": true, "item-2": true }
    initializeMultiSelectActivity()

    const labels = Array.from(
      document.querySelectorAll<HTMLLabelElement>("section label"),
    )
    labels.forEach((l) => l.click())
    expect(store.get(submitEnabledAtom)).toBe(true)
    store.get(validateHandlerAtom)?.()
    expect(store.get(submitStateAtom)).toBe("next")
  })
})
