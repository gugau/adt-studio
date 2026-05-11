/**
 * Quiz activity wiring — replaces the deleted
 * `assets/adt/modules/activities/quiz.js` from the vanilla runtime.
 *
 * The static page HTML ships an `.activity-option` label per choice with
 * `data-activity-item` ids and a `data-correct-answers` JSON map on the
 * section. The React chrome owns the Submit/Retry button in the dock but
 * relies on this module to:
 *
 *   1. Wire click + keyboard selection on `.activity-option` labels.
 *   2. Push `validateHandler` / `retryHandler` into the activity atoms so
 *      the dock's submit button appears and routes to the right action.
 *   3. Render correct/incorrect feedback + explanation in-place.
 *   4. After a correct answer, switch the submit button to "next-activity"
 *      and navigate to the next page in `pagesAtom`.
 *
 * Single-question multiple-choice only — multi-question groups
 * (`[data-quiz-question-group]`) aren't used by current books.
 */
import { getDefaultStore } from "jotai"
import { translationsAtom } from "@/state/language.atoms"
import { pagesAtom, currentSectionIdAtom } from "@/state/nav.atoms"
import {
  resetVisibleAtom,
  retryHandlerAtom,
  submitLabelAtom,
  submitStateAtom,
  submitVisibleAtom,
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

function selectOption(option: HTMLElement, section: HTMLElement): void {
  // Single-select: clear other selections first.
  section.querySelectorAll<HTMLElement>(".activity-option").forEach((opt) => {
    opt.classList.remove("selected-option")
    opt.setAttribute("aria-checked", "false")
    const input = opt.querySelector<HTMLInputElement>('input[type="radio"]')
    if (input) input.checked = false
  })
  option.classList.add("selected-option")
  option.setAttribute("aria-checked", "true")
  const input = option.querySelector<HTMLInputElement>('input[type="radio"]')
  if (input) input.checked = true

  const store = getDefaultStore()
  store.set(submitStateAtom, "submit")
  store.set(submitLabelAtom, null)
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

export function initializeQuizActivity(): (() => void) | null {
  if (typeof document === "undefined") return null
  const section = document.querySelector<HTMLElement>(QUIZ_SELECTOR)
  if (!section) return null

  const store = getDefaultStore()
  const correctAnswers = readCorrectAnswers(section)

  const retry = () => {
    clearOptionStyles(section)
    playActivitySound("reset")
    store.set(submitStateAtom, "submit")
    store.set(submitLabelAtom, null)
    store.set(submitVisibleAtom, false)
    store.set(resetVisibleAtom, false)
  }

  const handleSelect = (option: HTMLElement) => {
    // Quizzes validate on click — no separate submit step. Selecting a
    // different option after an attempt wipes the previous feedback first.
    clearOptionStyles(section)
    selectOption(option, section)
    playActivitySound("drop")

    const itemId = option.getAttribute("data-activity-item")
    if (!itemId) return
    const isCorrect = Boolean(correctAnswers[itemId])
    applyValidationStyle(option, isCorrect)
    showFeedback(option, isCorrect)
    playActivitySound(isCorrect ? "success" : "error")

    if (isCorrect) {
      // Surface a "next activity" button in the dock if there is a next page.
      const hasNext = findNextPageHref() !== null
      store.set(submitStateAtom, "next")
      store.set(submitLabelAtom, null)
      store.set(submitVisibleAtom, hasNext)
      store.set(resetVisibleAtom, false)
    } else {
      // Wrong answer — let the user reset and try again.
      store.set(submitStateAtom, "submit")
      store.set(submitLabelAtom, null)
      store.set(submitVisibleAtom, false)
      store.set(resetVisibleAtom, true)
    }
  }

  const handleValidate = () => {
    const state = store.get(submitStateAtom)
    if (state === "next") {
      const href = findNextPageHref()
      if (href) window.location.href = href
    }
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

  // Wire the dock's submit/retry buttons.
  store.set(validateHandlerAtom, handleValidate)
  store.set(retryHandlerAtom, retry)
  store.set(submitVisibleAtom, false)
  store.set(resetVisibleAtom, false)
  store.set(submitStateAtom, "submit")
  store.set(submitLabelAtom, null)

  return () => {
    listeners.forEach((off) => off())
    store.set(validateHandlerAtom, null)
    store.set(retryHandlerAtom, null)
    store.set(submitVisibleAtom, false)
    store.set(resetVisibleAtom, false)
  }
}
