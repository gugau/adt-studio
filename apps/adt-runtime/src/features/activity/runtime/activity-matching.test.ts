// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { getDefaultStore } from "jotai"
import { initializeMatchingActivity } from "./activity-matching"
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
    <section data-section-type="activity_matching" data-section-id="${sectionId}">
      <div class="flex flex-row gap-4">
        <div class="grow grid grid-cols-1 gap-4 text-center">
          <div class="bg-yellow-100 activity-item" data-activity-item="item-1"
               data-id="t1" draggable="true" tabindex="0" role="button" aria-label="Apple" id="apple">Apple</div>
          <div class="bg-teal-100 activity-item" data-activity-item="item-2"
               data-id="t2" draggable="true" tabindex="0" role="button" aria-label="Banana" id="banana">Banana</div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="border dropzone" tabindex="0" role="button" aria-label="Apple image" id="target1">
            <img src="images/apple.png" alt="apple" data-id="img1" />
            <div id="dropzone-1" class="dropzone-slot" aria-live="polite"></div>
          </div>
          <div class="border dropzone" tabindex="0" role="button" aria-label="Banana image" id="target2">
            <img src="images/banana.png" alt="banana" data-id="img2" />
            <div id="dropzone-2" class="dropzone-slot" aria-live="polite"></div>
          </div>
        </div>
      </div>
    </section>
  `
  window.correctAnswers = {
    "item-1": "dropzone-1",
    "item-2": "dropzone-2",
  }
}

function itemFor(itemId: string): HTMLElement {
  return document.querySelector<HTMLElement>(`.activity-item[data-activity-item='${itemId}']`)!
}

function zoneFor(slotId: string): HTMLElement {
  return document.getElementById(slotId)!.closest<HTMLElement>(".dropzone")!
}

function slotContains(slotId: string, itemId: string): boolean {
  return !!document
    .getElementById(slotId)!
    .querySelector(`.activity-item[data-activity-item='${itemId}']`)
}

/** Select an item, then click a drop zone to place it. */
function selectAndPlace(itemId: string, slotId: string): void {
  itemFor(itemId).click()
  zoneFor(slotId).click()
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

describe("initializeMatchingActivity", () => {
  it("does nothing when no matching section is present", () => {
    document.body.innerHTML = `<section data-section-type="text_only"></section>`
    expect(initializeMatchingActivity()).toBeNull()
  })

  it("returns null when there are items but no drop zones", () => {
    document.body.innerHTML = `
      <section data-section-type="activity_matching">
        <div class="activity-item" data-activity-item="item-1">Apple</div>
      </section>`
    expect(initializeMatchingActivity()).toBeNull()
  })

  it("places a selected item into a drop zone and enables submit", () => {
    setup()
    initializeMatchingActivity()
    expect(store.get(submitEnabledAtom)).toBe(false)

    selectAndPlace("item-1", "dropzone-1")

    expect(slotContains("dropzone-1", "item-1")).toBe(true)
    expect(itemFor("item-1").classList.contains("placed-in-dropzone")).toBe(true)
    expect(store.get(submitEnabledAtom)).toBe(true)
  })

  it("returns a placed item to the bank when clicked", () => {
    setup()
    initializeMatchingActivity()
    selectAndPlace("item-1", "dropzone-1")
    expect(store.get(submitEnabledAtom)).toBe(true)

    itemFor("item-1").click()

    expect(slotContains("dropzone-1", "item-1")).toBe(false)
    expect(itemFor("item-1").classList.contains("placed-in-dropzone")).toBe(false)
    expect(store.get(submitEnabledAtom)).toBe(false)
  })

  it("evicts the existing card when a slot already holds one (1:1 matching)", () => {
    setup()
    initializeMatchingActivity()
    selectAndPlace("item-1", "dropzone-1")
    // Now place item-2 into the same slot — item-1 should be evicted home.
    selectAndPlace("item-2", "dropzone-1")

    expect(slotContains("dropzone-1", "item-2")).toBe(true)
    expect(slotContains("dropzone-1", "item-1")).toBe(false)
    expect(itemFor("item-1").classList.contains("placed-in-dropzone")).toBe(false)
  })

  it("marks all items correct and advances to next when fully matched", () => {
    setup()
    initializeMatchingActivity()
    selectAndPlace("item-1", "dropzone-1")
    selectAndPlace("item-2", "dropzone-2")

    const before = store.get(confettiTriggerAtom)
    store.get(validateHandlerAtom)?.()

    expect(itemFor("item-1").querySelector(".validation-mark")?.textContent).toBe("✓")
    expect(itemFor("item-2").querySelector(".validation-mark")?.textContent).toBe("✓")
    expect(store.get(submitStateAtom)).toBe("next")
    expect(store.get(confettiTriggerAtom)).toBe(before + 1)
  })

  it("marks a wrong match incorrect and stays in submit state", () => {
    setup()
    initializeMatchingActivity()
    selectAndPlace("item-1", "dropzone-2") // wrong
    selectAndPlace("item-2", "dropzone-1") // wrong

    store.get(validateHandlerAtom)?.()

    expect(itemFor("item-1").querySelector(".validation-mark")?.textContent).toBe("✗")
    expect(itemFor("item-1").getAttribute("aria-invalid")).toBe("true")
    expect(store.get(submitStateAtom)).toBe("submit")
  })

  it("does not advance when not every item is matched", () => {
    setup()
    initializeMatchingActivity()
    selectAndPlace("item-1", "dropzone-1") // correct, but item-2 unplaced

    store.get(validateHandlerAtom)?.()

    expect(itemFor("item-1").querySelector(".validation-mark")?.textContent).toBe("✓")
    expect(store.get(submitStateAtom)).toBe("submit")
    expect(store.get(confettiTriggerAtom)).toBe(0)
  })

  it("clears verdict styling when an item is moved after validation", () => {
    setup()
    initializeMatchingActivity()
    selectAndPlace("item-1", "dropzone-2") // wrong
    selectAndPlace("item-2", "dropzone-1") // wrong
    store.get(validateHandlerAtom)?.()
    expect(document.querySelectorAll(".validation-mark").length).toBe(2)

    itemFor("item-1").click() // remove → verdicts wiped

    expect(document.querySelectorAll(".validation-mark").length).toBe(0)
  })

  it("supports the legacy role=region slot selector", () => {
    document.body.innerHTML = `
      <section data-section-type="activity_matching" data-section-id="pg004_sec001">
        <div class="grow grid">
          <div class="activity-item" data-activity-item="item-1" aria-label="Apple">Apple</div>
        </div>
        <div class="dropzone" id="target1">
          <div id="dropzone-1" role="region"></div>
        </div>
      </section>`
    window.correctAnswers = { "item-1": "dropzone-1" }
    initializeMatchingActivity()
    selectAndPlace("item-1", "dropzone-1")
    expect(slotContains("dropzone-1", "item-1")).toBe(true)
  })
})
