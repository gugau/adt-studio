/**
 * Per-input feedback DOM helpers shared by text-input activities (fill-in-the-blank,
 * open-ended, fill-in-a-table). The legacy `validation.js` + `utils.js` shipped
 * three nearly-identical icon-positioning paths — this consolidates them into
 * one `applyFeedback` driven by `FeedbackKind`.
 *
 * Note: the dock-driven submit button now owns the "next activity" / "submit"
 * state via atoms, so this module deliberately drops the legacy global toast,
 * submit-button manipulation, and `window.utils` registration.
 */

import { getDefaultStore } from "jotai"
import { translationsAtom } from "../../language/state/language.atoms"

export type FeedbackKind = "correct" | "incorrect" | "gibberish" | "profanity"

interface FeedbackStyle {
  borderClasses: string[]
  iconClass: string
  ariaInvalid: boolean
  /** i18n key for the appended aria-label suffix. */
  ariaLabelKey: string
  ariaLabelFallback: string
  /** Optional text feedback element (shown only for gibberish/profanity). */
  text?: { i18nKey: string; fallback: string; classes: string[] }
}

const GREEN = [
  "border-green-500",
  "focus:border-green-500",
  "focus:ring-green-200",
]
const RED = [
  "border-red-500",
  "focus:border-red-500",
  "focus:ring-red-200",
]
const ORANGE = [
  "border-orange-500",
  "focus:border-orange-500",
  "focus:ring-orange-200",
]

const STYLES: Record<FeedbackKind, FeedbackStyle> = {
  correct: {
    borderClasses: GREEN,
    iconClass: "fas fa-check-circle text-green-600 feedback-icon",
    ariaInvalid: false,
    ariaLabelKey: "fill-in-the-blank-correct-answer",
    ariaLabelFallback: "Correct answer",
  },
  incorrect: {
    borderClasses: RED,
    iconClass: "fas fa-times-circle text-red-600 feedback-icon",
    ariaInvalid: true,
    ariaLabelKey: "fill-in-the-blank-try-again",
    ariaLabelFallback: "Try again",
  },
  gibberish: {
    borderClasses: ORANGE,
    iconClass: "fas fa-question-circle text-orange-500 feedback-icon",
    ariaInvalid: true,
    ariaLabelKey: "validation-check-spelling",
    ariaLabelFallback: "Check your spelling",
    text: {
      i18nKey: "validation-check-spelling",
      fallback: "Check your spelling",
      classes: ["text-orange-500"],
    },
  },
  profanity: {
    borderClasses: RED,
    iconClass: "fas fa-exclamation-circle text-red-600 feedback-icon",
    ariaInvalid: true,
    ariaLabelKey: "validation-inappropriate-language",
    ariaLabelFallback: "Inappropriate language",
    text: {
      i18nKey: "validation-inappropriate-language",
      fallback: "Inappropriate language",
      classes: ["text-red-600"],
    },
  },
}

const ALL_BORDER_CLASSES = [...GREEN, ...RED, ...ORANGE, "focus:ring"]

function translate(key: string, fallback: string): string {
  const dict = getDefaultStore().get(translationsAtom)
  return dict[key] || fallback
}

function inputAriaId(input: HTMLInputElement | HTMLTextAreaElement): string {
  return (
    input.getAttribute("data-aria-id") ||
    input.id ||
    input.getAttribute("data-activity-item") ||
    "feedback"
  )
}

/**
 * Find the right place to drop a multi-line feedback text element. Flex/grid
 * containers (e.g. label-beside-input rows) need feedback to live BELOW the
 * row, not inside it — otherwise the icon and message squash the input.
 */
export function findAppropriateParentForFeedback(
  input: HTMLInputElement | HTMLTextAreaElement,
): HTMLElement {
  const parent = input.parentElement
  if (!parent) return input as unknown as HTMLElement

  const display = window.getComputedStyle(parent).display
  if (display === "flex" || display === "grid") {
    const containerParent = parent.parentElement
    if (containerParent) {
      const wrapper = document.createElement("div")
      wrapper.className = "feedback-container w-full mt-2"
      if (containerParent.lastChild === parent) {
        containerParent.appendChild(wrapper)
      } else {
        containerParent.insertBefore(wrapper, parent.nextSibling)
      }
      return wrapper
    }
  }

  if (input.tagName.toLowerCase() === "textarea") {
    const wrapper = document.createElement("div")
    wrapper.className = "feedback-container w-full"
    parent.insertBefore(wrapper, input.nextSibling)
    return wrapper
  }

  return parent
}

/**
 * Clear any feedback that was previously applied to `input`: removes icons,
 * resets border classes, strips ARIA-label suffixes, and removes any text
 * feedback spans living next to it.
 */
export function clearInputValidationFeedback(
  input: HTMLInputElement | HTMLTextAreaElement,
): void {
  const ariaId = inputAriaId(input)

  // Remove any icon we previously added (matched by class on the wrapper div).
  document.querySelectorAll(`.feedback-icon-for-${cssIdent(ariaId)}`).forEach((el) => {
    if (el.parentNode === input.parentNode) el.remove()
  })

  // Remove text feedback spans inside the parent (and any sibling
  // .feedback-container). Must mirror `findAppropriateParentForFeedback`'s
  // placement: it inserts the wrapper as a sibling of the parent for BOTH
  // flex and grid layouts — so the cleanup has to walk the grandparent for
  // both, not just flex.
  const parent = input.parentElement
  if (parent) {
    parent.querySelectorAll<HTMLElement>(".feedback").forEach((el) => el.remove())
    const display = window.getComputedStyle(parent).display
    if (display === "flex" || display === "grid") {
      const grand = parent.parentElement
      grand?.querySelectorAll<HTMLElement>(".feedback-container").forEach((el) => el.remove())
    }
  }

  input.classList.remove(...ALL_BORDER_CLASSES)
  input.setAttribute("aria-invalid", "false")
  input.removeAttribute("data-has-profanity-feedback")
  input.removeAttribute("data-has-gibberish-feedback")

  // The base aria-label may have had a " - validation message" suffix appended;
  // restore the prefix.
  const label = input.getAttribute("aria-label")
  if (label?.includes(" - ")) {
    input.setAttribute("aria-label", label.split(" - ")[0])
  }
  input.style.paddingRight = ""
}

/**
 * Apply visual feedback to a text input. Idempotent — clears previous feedback
 * before applying, so callers don't have to.
 */
export function applyFeedback(
  input: HTMLInputElement | HTMLTextAreaElement,
  kind: FeedbackKind,
): void {
  clearInputValidationFeedback(input)
  const style = STYLES[kind]

  input.classList.add(...style.borderClasses, "focus:ring")
  input.setAttribute("aria-invalid", style.ariaInvalid ? "true" : "false")

  const suffix = translate(style.ariaLabelKey, style.ariaLabelFallback)
  // Append the suffix to the existing label rather than replacing it — the
  // hydrated FITB inputs carry a "Blank N of M" prefix that must survive
  // repeated validations. clearInputValidationFeedback above already stripped
  // any prior " - suffix" so we're appending to the bare base label.
  const baseLabel = input.getAttribute("aria-label") ?? ""
  input.setAttribute(
    "aria-label",
    baseLabel ? `${baseLabel} - ${suffix}` : suffix,
  )
  if (kind === "gibberish") input.setAttribute("data-has-gibberish-feedback", "true")
  if (kind === "profanity") input.setAttribute("data-has-profanity-feedback", "true")

  input.style.paddingRight = "30px"
  attachIcon(input, kind, style)

  if (style.text) {
    const text = document.createElement("span")
    text.className = ["feedback", ...style.text.classes].join(" ")
    text.textContent = translate(style.text.i18nKey, style.text.fallback)
    text.style.display = "block"
    text.style.width = "100%"
    text.style.textAlign = "left"
    text.setAttribute("role", "alert")
    text.id = `feedback-${cssIdent(inputAriaId(input))}`
    input.setAttribute("aria-describedby", text.id)

    const target = findAppropriateParentForFeedback(input)
    target.appendChild(text)
  }
}

function attachIcon(
  input: HTMLInputElement | HTMLTextAreaElement,
  kind: FeedbackKind,
  style: FeedbackStyle,
): void {
  const parent = input.parentElement
  if (!parent) return

  const wrapper = document.createElement("div")
  wrapper.className = `feedback-icon-for-${cssIdent(inputAriaId(input))}`
  wrapper.style.position = "absolute"
  wrapper.style.pointerEvents = "none"
  wrapper.style.zIndex = "10"
  wrapper.setAttribute("data-feedback-kind", kind)

  const i = document.createElement("i")
  i.className = style.iconClass
  i.setAttribute("aria-hidden", "true")
  wrapper.appendChild(i)

  // Position the icon at the right edge of the input. Use getBoundingClientRect
  // relative to the parent so it survives layout shifts from added text.
  const rect = input.getBoundingClientRect()
  const parentRect = parent.getBoundingClientRect()
  wrapper.style.top = `${rect.top - parentRect.top + (rect.height - 24) / 2}px`
  wrapper.style.right = `${parentRect.right - rect.right + 10}px`

  if (window.getComputedStyle(parent).position === "static") {
    parent.style.position = "relative"
  }
  parent.insertBefore(wrapper, input.nextSibling)
}

/**
 * Strip the section's leftover validation icons and text — used at the start
 * of a "Submit" pass to make sure stale state from a previous attempt is gone.
 */
export function clearSectionFeedback(section: HTMLElement): void {
  section
    .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input[type="text"]:not(#filter-input), textarea:not(#filter-input)',
    )
    .forEach((input) => clearInputValidationFeedback(input))
}

/**
 * Escape a value for use in a CSS class name. data-aria-id values can contain
 * hyphens and digits which are already class-safe; the legacy code relied on
 * them being plain ASCII slugs, so guard against anything unusual.
 */
function cssIdent(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_")
}
