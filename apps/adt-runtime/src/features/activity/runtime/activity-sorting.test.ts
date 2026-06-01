// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { getDefaultStore } from "jotai"
import { initializeSortingActivity } from "./activity-sorting"
import {
  confettiTriggerAtom,
  skipEnabledAtom,
  submitEnabledAtom,
  submitStateAtom,
  validateHandlerAtom,
} from "../state/activity.atoms"
import { pagesAtom, currentSectionIdAtom } from "../../navigation/state/nav.atoms"

const store = getDefaultStore()

function setup(opts?: { sectionId?: string }): void {
  const sectionId = opts?.sectionId ?? "pg004_sec001"
  document.body.innerHTML = `
    <section data-section-type="activity_sorting" data-section-id="${sectionId}">
      <div class="grid grid-cols-3 gap-4">
        <div>
          <div class="grid grid-cols-2 gap-4" role="listbox">
            <p class="word-card" data-activity-item="item-1" draggable="true" tabindex="0" role="option">
              <span data-id="t1">Apple</span>
            </p>
            <p class="word-card" data-activity-item="item-2" draggable="true" tabindex="0" role="option">
              <span data-id="t2">Carrot</span>
            </p>
            <p class="word-card" data-activity-item="item-3" draggable="true" tabindex="0" role="option">
              <span data-id="t3">Banana</span>
            </p>
          </div>
        </div>
        <div class="grid gap-3">
          <div class="category bg-yellow-200" data-activity-category="fruits" tabindex="0" role="listbox">
            <label class="font-semibold" data-id="c1">Fruits</label>
            <ul class="word-list flex flex-wrap"></ul>
          </div>
          <div class="category bg-blue-200" data-activity-category="veggies" tabindex="0" role="listbox">
            <label class="font-semibold" data-id="c2">Vegetables</label>
            <ul class="word-list flex flex-wrap"></ul>
          </div>
        </div>
      </div>
    </section>
  `
  // item-1 (Apple) + item-3 (Banana) are fruits; item-2 (Carrot) is a veggie.
  window.correctAnswers = {
    "item-1": "fruits",
    "item-2": "veggies",
    "item-3": "fruits",
  }
}

function cardFor(itemId: string): HTMLElement {
  return document.querySelector<HTMLElement>(
    `.word-card[data-activity-item='${itemId}']`,
  )!
}

function categoryFor(catId: string): HTMLElement {
  return document.querySelector<HTMLElement>(
    `.category[data-activity-category='${catId}']`,
  )!
}

function placedCardIn(catId: string, itemId: string): HTMLElement | null {
  return categoryFor(catId).querySelector<HTMLElement>(
    `.word-list .word-card[data-activity-item='${itemId}']`,
  )
}

/** Select a bank card, then place it into a category via click. */
function selectAndPlace(itemId: string, catId: string): void {
  cardFor(itemId).click()
  categoryFor(catId).click()
}

beforeEach(() => {
  document.body.innerHTML = ""
  window.correctAnswers = undefined
  store.set(submitEnabledAtom, false)
  store.set(skipEnabledAtom, false)
  store.set(submitStateAtom, "submit")
  store.set(validateHandlerAtom, () => null)
  store.set(confettiTriggerAtom, 0)
  store.set(pagesAtom, [
    { section_id: "pg004_sec001", href: "pg004_sec001.html" },
    { section_id: "pg005_sec001", href: "pg005_sec001.html" },
  ])
  store.set(currentSectionIdAtom, "pg004_sec001")
})

describe("initializeSortingActivity", () => {
  it("does nothing when no sorting section is present", () => {
    document.body.innerHTML = `<section data-section-type="text_only"></section>`
    expect(initializeSortingActivity()).toBeNull()
  })

  it("returns null when a section has cards but no categories", () => {
    document.body.innerHTML = `
      <section data-section-type="activity_sorting">
        <p class="word-card" data-activity-item="item-1"><span>Apple</span></p>
      </section>`
    expect(initializeSortingActivity()).toBeNull()
  })

  it("places a selected card into a category and enables submit", () => {
    setup()
    initializeSortingActivity()
    expect(store.get(submitEnabledAtom)).toBe(false)

    selectAndPlace("item-1", "fruits")

    expect(placedCardIn("fruits", "item-1")).not.toBeNull()
    expect(cardFor("item-1").classList.contains("placed-word")).toBe(true)
    expect(store.get(submitEnabledAtom)).toBe(true)
  })

  it("returns a placed card to the bank when clicked, disabling submit", () => {
    setup()
    initializeSortingActivity()
    selectAndPlace("item-1", "fruits")
    expect(store.get(submitEnabledAtom)).toBe(true)

    // Click the now-placed card to remove it.
    cardFor("item-1").click()

    expect(placedCardIn("fruits", "item-1")).toBeNull()
    expect(cardFor("item-1").classList.contains("placed-word")).toBe(false)
    expect(store.get(submitEnabledAtom)).toBe(false)
  })

  it("marks all cards correct and advances to next when fully correct", () => {
    setup()
    initializeSortingActivity()
    selectAndPlace("item-1", "fruits")
    selectAndPlace("item-2", "veggies")
    selectAndPlace("item-3", "fruits")

    const before = store.get(confettiTriggerAtom)
    store.get(validateHandlerAtom)?.()

    expect(cardFor("item-1").querySelector(".validation-mark")?.textContent).toBe("✓")
    expect(cardFor("item-2").querySelector(".validation-mark")?.textContent).toBe("✓")
    expect(cardFor("item-3").querySelector(".validation-mark")?.textContent).toBe("✓")
    expect(store.get(submitStateAtom)).toBe("next")
    expect(store.get(confettiTriggerAtom)).toBe(before + 1)
  })

  it("marks a wrong placement incorrect and stays in submit state", () => {
    setup()
    initializeSortingActivity()
    selectAndPlace("item-1", "veggies") // wrong — Apple is a fruit
    selectAndPlace("item-2", "veggies")
    selectAndPlace("item-3", "fruits")

    store.get(validateHandlerAtom)?.()

    const mark = cardFor("item-1").querySelector(".validation-mark")
    expect(mark?.textContent).toBe("✗")
    expect(cardFor("item-1").getAttribute("aria-invalid")).toBe("true")
    expect(store.get(submitStateAtom)).toBe("submit")
  })

  it("does not advance when not every card is placed", () => {
    setup()
    initializeSortingActivity()
    selectAndPlace("item-1", "fruits") // only one of three placed, and correct

    store.get(validateHandlerAtom)?.()

    // The single placed card is correct, but the activity isn't complete.
    expect(cardFor("item-1").querySelector(".validation-mark")?.textContent).toBe("✓")
    expect(store.get(submitStateAtom)).toBe("submit")
    expect(store.get(confettiTriggerAtom)).toBe(0)
  })

  it("clears verdict styling when a card is moved after validation", () => {
    setup()
    initializeSortingActivity()
    selectAndPlace("item-1", "veggies") // wrong
    selectAndPlace("item-2", "veggies")
    selectAndPlace("item-3", "fruits")
    store.get(validateHandlerAtom)?.()
    expect(cardFor("item-1").querySelector(".validation-mark")).not.toBeNull()

    // Remove the wrong card — verdict marks should be wiped from all cards.
    cardFor("item-1").click()

    expect(document.querySelectorAll(".validation-mark").length).toBe(0)
  })

  it("toggles selection off when the selected card is clicked again", () => {
    setup()
    initializeSortingActivity()
    const apple = cardFor("item-1")
    apple.click()
    expect(apple.style.outline).not.toBe("") // blue selection outline applied
    apple.click()
    expect(apple.style.outline).toBe("") // outline cleared on deselect
  })

  it("enforces a clear bordered, rounded card look regardless of generated classes", () => {
    setup()
    sortingCardBorderProbe()
  })
})

/**
 * The runtime overrides faint renderer borders with inline styles so a card is
 * unmistakably a draggable card. Verifies the base look, the placed (blue)
 * look, and verdict (green/red) borders.
 */
function sortingCardBorderProbe(): void {
  initializeSortingActivity()
  const apple = cardFor("item-1")

  // Base: visible 2px border + rounded corners in the bank.
  expect(apple.style.border).toContain("2px solid")
  expect(apple.style.borderRadius).not.toBe("")

  // Placed: border switches to the blue "placed" color.
  selectAndPlace("item-1", "fruits")
  expect(apple.style.border).toContain("rgb(37, 99, 235)")

  // Validate everything correct → green border on the correct card.
  selectAndPlace("item-2", "veggies")
  selectAndPlace("item-3", "fruits")
  store.get(validateHandlerAtom)?.()
  expect(apple.style.border).toContain("rgb(22, 163, 74)")
}
