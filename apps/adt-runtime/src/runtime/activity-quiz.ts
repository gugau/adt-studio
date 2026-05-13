import { getDefaultStore } from "jotai"
import { translationsAtom } from "@/state/language.atoms"
import { pagesAtom, currentSectionIdAtom } from "@/state/nav.atoms"
import {
  skipEnabledAtom,
  skipHandlerAtom,
  submitEnabledAtom,
  submitLabelAtom,
  submitStateAtom,
  validateHandlerAtom,
} from "@/state/activity.atoms"

const QUIZ_SELECTOR = 'section[data-section-type="activity_quiz"]'
const CORRECT_ANSWERS_SCRIPT_ID = "quiz-correct-answers"

type ActivitySoundKey = "drop" | "success" | "error" | "reset"

let activitySounds: Record<ActivitySoundKey, HTMLAudioElement> | null = null

function initActivitySounds(): Record<ActivitySoundKey, HTMLAudioElement> {
  if (activitySounds) return activitySounds
  const make = (file: string) => {
    const a = new Audio(`./assets/sounds/${file}`)
    a.volume = 0.5
    a.preload = "auto"
    return a
  }
  activitySounds = {
    drop: make("drop.mp3"),
    success: make("success.mp3"),
    error: make("error.mp3"),
    reset: make("reset.mp3"),
  }
  return activitySounds
}

function playActivitySound(key: ActivitySoundKey): void {
  const sounds = initActivitySounds()
  const audio = sounds[key]
  try {
    audio.pause()
    audio.currentTime = 0
    void audio.play().catch(() => {
      // Autoplay can be blocked until the user interacts — silently ignore.
    })
  } catch {
    // ignore
  }
}

function tr(key: string, fallback: string): string {
  const dict = getDefaultStore().get(translationsAtom)
  return dict[key] || fallback
}

function readCorrectAnswers(section: HTMLElement): Record<string, boolean> {
  const attr = section.getAttribute("data-correct-answers")
  if (attr) {
    try {
      return JSON.parse(attr) as Record<string, boolean>
    } catch {
      // fall through to script tag
    }
  }
  const scriptEl = document.getElementById(CORRECT_ANSWERS_SCRIPT_ID)
  if (scriptEl?.textContent) {
    try {
      return JSON.parse(scriptEl.textContent) as Record<string, boolean>
    } catch {
      // ignore
    }
  }
  return {}
}

function resolveExplanation(option: HTMLElement): string | null {
  const explanationId = option.getAttribute("data-explanation-id")
  if (explanationId) {
    const dict = getDefaultStore().get(translationsAtom)
    if (dict[explanationId]) return dict[explanationId]
  }
  return option.getAttribute("data-explanation")
}

function clearOptionStyles(section: HTMLElement): void {
  section.querySelectorAll<HTMLElement>(".activity-option").forEach((opt) => {
    opt.classList.remove(
      "selected-option",
      "bg-green-50",
      "bg-red-50",
      "border-green-500",
      "border-red-500",
    )
    opt.removeAttribute("aria-invalid")
    opt.setAttribute("aria-checked", "false")
    const input = opt.querySelector<HTMLInputElement>('input[type="radio"]')
    if (input) input.checked = false
    const feedback = opt.querySelector<HTMLElement>(".feedback-container")
    if (feedback) {
      feedback.classList.add("hidden")
      const text = feedback.querySelector<HTMLElement>(".feedback-text")
      if (text) {
        text.textContent = ""
        text.className = "feedback-text"
      }
    }
  })
}

function markSelection(option: HTMLElement, section: HTMLElement): void {
  clearOptionStyles(section)
  option.classList.add("selected-option")
  option.setAttribute("aria-checked", "true")
  const input = option.querySelector<HTMLInputElement>('input[type="radio"]')
  if (input) input.checked = true
}

function applyValidationStyle(option: HTMLElement, isCorrect: boolean): void {
  option.classList.remove("selected-option")
  option.classList.add(isCorrect ? "bg-green-50" : "bg-red-50")
  option.setAttribute("aria-invalid", isCorrect ? "false" : "true")
}

function showFeedback(option: HTMLElement, isCorrect: boolean): void {
  const container = option.querySelector<HTMLElement>(".feedback-container")
  if (!container) return
  container.classList.remove("hidden")
  const text = container.querySelector<HTMLElement>(".feedback-text")
  if (!text) return
  const explanation = resolveExplanation(option)
  text.textContent =
    explanation ||
    (isCorrect
      ? tr("multiple-choice-correct-answer", "Correct!")
      : tr("multiple-choice-try-again", "Try again"))
  text.className = `feedback-text text-lg font-semibold ${
    isCorrect ? "text-green-800" : "text-red-800"
  }`
  container.setAttribute("role", isCorrect ? "status" : "alert")
  container.setAttribute("aria-live", "polite")
}

function findNextPageHref(): string | null {
  const store = getDefaultStore()
  const pages = store.get(pagesAtom)
  const currentId = store.get(currentSectionIdAtom)
  if (!currentId) return null
  const idx = pages.findIndex((p) => p.section_id === currentId)
  if (idx < 0 || idx >= pages.length - 1) return null
  return pages[idx + 1].href
}

/**
 * Next page whose `section_id` starts with `qz` — same activity convention
 * used by `packages/pipeline/src/package-web.ts:collectActivityIds`.
 * Drives the post-correct "Next activity" jump (skip past any reading
 * pages between this activity and the next one).
 */
function findNextActivityHref(): string | null {
  const store = getDefaultStore()
  const pages = store.get(pagesAtom)
  const currentId = store.get(currentSectionIdAtom)
  if (!currentId) return null
  const idx = pages.findIndex((p) => p.section_id === currentId)
  if (idx < 0) return null
  for (let i = idx + 1; i < pages.length; i++) {
    if (pages[i].section_id.startsWith("qz")) return pages[i].href
  }
  return null
}

export function initializeQuizActivity(): (() => void) | null {
  if (typeof document === "undefined") return null
  const section = document.querySelector<HTMLElement>(QUIZ_SELECTOR)
  if (!section) return null

  const store = getDefaultStore()
  const correctAnswers = readCorrectAnswers(section)

  let selected: HTMLElement | null = null
  let validated = false
  const hasNextPage = findNextPageHref() !== null
  const hasNextActivity = findNextActivityHref() !== null

  const resetState = () => {
    selected = null
    validated = false
    store.set(submitStateAtom, "submit")
    store.set(submitLabelAtom, null)
    store.set(submitEnabledAtom, false)
    store.set(skipEnabledAtom, hasNextPage)
  }

  const handleSelect = (option: HTMLElement) => {
    if (validated) clearOptionStyles(section)
    markSelection(option, section)
    playActivitySound("drop")
    selected = option
    validated = false
    store.set(submitStateAtom, "submit")
    store.set(submitLabelAtom, null)
    store.set(submitEnabledAtom, true)
  }

  const handleValidate = () => {
    const state = store.get(submitStateAtom)
    if (state === "next") {
      // Post-correct: submit jumps to the next activity, skipping reading pages
      // in between. The sibling "Next page" button handles plain sequential nav.
      const href = findNextActivityHref()
      if (href) window.location.href = href
      return
    }
    if (!selected || validated) return

    const itemId = selected.getAttribute("data-activity-item")
    if (!itemId) return
    const isCorrect = Boolean(correctAnswers[itemId])
    applyValidationStyle(selected, isCorrect)
    showFeedback(selected, isCorrect)
    playActivitySound(isCorrect ? "success" : "error")
    validated = true

    if (isCorrect) {
      store.set(submitStateAtom, "next")
      store.set(submitLabelAtom, null)
      // Submit becomes "Next activity" — enabled only when one exists.
      store.set(submitEnabledAtom, hasNextActivity)
    } else {
      store.set(submitStateAtom, "submit")
      store.set(submitLabelAtom, null)
      store.set(submitEnabledAtom, false)
    }
  }

  const handleSkip = () => {
    const href = findNextPageHref()
    if (href) window.location.href = href
  }

  // WCAG 4.1.2: a list of `role="radio"` options is meaningless to screen
  // readers without a `role="radiogroup"` container that names the group.
  // The section ships with `role="article"` from the template — override it
  // since the section's primary semantic here IS the radio group.
  section.setAttribute("role", "radiogroup")
  if (!section.hasAttribute("aria-label")) {
    section.setAttribute(
      "aria-label",
      tr("activity-options-label", "Answer options"),
    )
  }

  const options = section.querySelectorAll<HTMLElement>(".activity-option")
  const listeners: Array<() => void> = []
  options.forEach((option) => {
    const onClick = () => handleSelect(option)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        handleSelect(option)
      }
    }
    option.addEventListener("click", onClick)
    option.addEventListener("keydown", onKey)
    option.setAttribute("role", "radio")
    option.setAttribute("aria-checked", "false")
    listeners.push(() => {
      option.removeEventListener("click", onClick)
      option.removeEventListener("keydown", onKey)
    })
  })

  store.set(validateHandlerAtom, () => handleValidate)
  store.set(skipHandlerAtom, () => handleSkip)
  resetState()

  return () => {
    listeners.forEach((off) => off())
    store.set(validateHandlerAtom, () => null)
    store.set(skipHandlerAtom, () => null)
    store.set(submitEnabledAtom, false)
    store.set(skipEnabledAtom, false)
  }
}
