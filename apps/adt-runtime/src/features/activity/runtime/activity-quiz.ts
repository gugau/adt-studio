import { getDefaultStore } from "jotai"
import { translationsAtom } from "@/features/language/state/language.atoms"
import { pagesAtom, currentSectionIdAtom } from "@/features/navigation/state/nav.atoms"
import {
  confettiTriggerAtom,
  skipEnabledAtom,
  skipHandlerAtom,
  submitEnabledAtom,
  submitLabelAtom,
  submitStateAtom,
  validateHandlerAtom,
} from "@/features/activity/state/activity.atoms"
import { playActivitySound } from "@/features/activity/runtime/sounds"

/**
 * Quiz (standalone `activity_quiz` page) and in-page `activity_multiple_choice`
 * share the same option-selection model: one set of `.activity-option` labels,
 * each carrying a unique `data-activity-item`, with a correctness map keyed by
 * those item IDs. The two diverge in:
 *   - where the correct-answers map lives (`data-correct-answers` attribute /
 *     embedded <script> for quiz; `window.correctAnswers` for MC),
 *   - what "Next activity" means (jump to next `qz` page for quiz; advance
 *     one page for MC),
 *   - cardinality: a section may host MULTIPLE multiple-choice question
 *     groups, each identified by its inner radio's `name` attribute. Each
 *     group tracks its own selection + validation state independently.
 *     Standalone quiz pages use a single synthetic group.
 */
const QUIZ_SELECTOR =
  'section[data-section-type="activity_quiz"], section[data-section-type="activity_multiple_choice"]'
const CORRECT_ANSWERS_SCRIPT_ID = "quiz-correct-answers"
const DEFAULT_GROUP_KEY = "__default__"

function tr(key: string, fallback: string): string {
  const dict = getDefaultStore().get(translationsAtom)
  return dict[key] || fallback
}

declare global {
  interface Window {
    /**
     * Map of item id → correctness. Multiple-choice ships boolean values;
     * other text-input activities ship strings. Injected by
     * `packages/pipeline/src/package-web.ts:renderPageHtml`.
     */
    correctAnswers?: Record<string, unknown>
  }
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
      // fall through to window global
    }
  }
  // Multiple-choice sections rely on the global written by renderPageHtml.
  if (typeof window !== "undefined" && window.correctAnswers) {
    const out: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(window.correctAnswers)) out[k] = Boolean(v)
    return out
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

function getOptionItemId(option: HTMLElement): string | null {
  // Standalone quiz puts `data-activity-item` on the `.activity-option` label
  // itself; multiple-choice puts it on the inner radio input.
  return (
    option.getAttribute("data-activity-item") ??
    option
      .querySelector<HTMLElement>("[data-activity-item]")
      ?.getAttribute("data-activity-item") ??
    null
  )
}

// Standalone-quiz selection styling. The standalone quiz template bakes
// `.selected-option { ... }` into its inline CSS; these utility classes are
// the runtime supplement that gives the same visual identity for image-only
// or image-plus-text option layouts.
const SELECTION_HIGHLIGHT_CLASSES = ["ring-2", "ring-blue-400", "bg-blue-50"]
const VERDICT_CLASSES = [
  "bg-green-50",
  "bg-red-50",
  "border-green-500",
  "border-red-500",
]

// Multiple-choice (embedded `activity_multiple_choice`) visual states. The
// runtime owns these so the look is consistent regardless of how the LLM
// laid out the option (image card, text row, inline pill). Class definitions
// live in `assets/adt/tailwind_css.css`.
const MC_SELECTED_CLASS = "activity-option-selected"
const MC_CORRECT_CLASS = "activity-option-correct"
const MC_INCORRECT_CLASS = "activity-option-incorrect"
const MC_BADGE_ATTR = "data-mc-status-badge"

function clearMcBadge(option: HTMLElement): void {
  option
    .querySelectorAll<HTMLElement>(`[${MC_BADGE_ATTR}]`)
    .forEach((b) => b.remove())
}

/**
 * Inject a small green/red badge with a check or cross icon at the option's
 * top-right corner. This is the non-color WCAG 1.4.1 cue that pairs with the
 * outline color — even if the learner can't perceive the green/red outline,
 * the icon shape says "correct" or "incorrect" plainly.
 */
function attachMcBadge(option: HTMLElement, isCorrect: boolean): void {
  clearMcBadge(option)
  const badge = document.createElement("span")
  badge.setAttribute(MC_BADGE_ATTR, isCorrect ? "correct" : "incorrect")
  badge.setAttribute(
    "aria-label",
    isCorrect
      ? tr("multiple-choice-correct-answer", "Correct")
      : tr("multiple-choice-try-again", "Incorrect"),
  )
  badge.setAttribute("role", "status")
  // Inline styles so the badge doesn't depend on additional CSS classes.
  badge.style.position = "absolute"
  badge.style.top = "-10px"
  badge.style.right = "-10px"
  badge.style.width = "22px"
  badge.style.height = "22px"
  badge.style.borderRadius = "9999px"
  badge.style.display = "flex"
  badge.style.alignItems = "center"
  badge.style.justifyContent = "center"
  badge.style.fontSize = "12px"
  badge.style.color = "white"
  badge.style.zIndex = "10"
  badge.style.pointerEvents = "none"
  badge.style.background = isCorrect ? "rgb(22, 163, 74)" : "rgb(220, 38, 38)"
  badge.style.boxShadow = "0 1px 3px rgba(0,0,0,0.2)"

  const icon = document.createElement("i")
  icon.className = isCorrect ? "fas fa-check" : "fas fa-times"
  icon.setAttribute("aria-hidden", "true")
  badge.appendChild(icon)

  // Option must establish a positioning context for the absolute badge.
  if (window.getComputedStyle(option).position === "static") {
    option.style.position = "relative"
  }
  option.appendChild(badge)
}

/**
 * Locate the option's `.feedback-container`. If the LLM didn't emit one,
 * inject one at the end of the option so feedback always sits on its own
 * line below the option content (LLM-emitted containers sometimes end up
 * inside a flex row and squash sideways).
 */
function ensureMcFeedbackContainer(option: HTMLElement): HTMLElement {
  let container = option.querySelector<HTMLElement>(".feedback-container")
  if (!container) {
    container = document.createElement("div")
    container.className = "feedback-container mt-2"
    const text = document.createElement("div")
    text.className = "feedback-text"
    container.appendChild(text)
    option.appendChild(container)
  }
  // Force block + full-width so the feedback line never gets eaten by an
  // ambient flex layout.
  container.style.display = "block"
  container.style.width = "100%"
  return container
}

interface QuestionGroup {
  key: string
  options: HTMLElement[]
  selected: HTMLElement | null
  validated: boolean
}

function groupKeyForOption(option: HTMLElement): string {
  const radio = option.querySelector<HTMLInputElement>('input[type="radio"]')
  return radio?.name || DEFAULT_GROUP_KEY
}

function buildGroups(section: HTMLElement): QuestionGroup[] {
  const byKey = new Map<string, HTMLElement[]>()
  section.querySelectorAll<HTMLElement>(".activity-option").forEach((opt) => {
    const key = groupKeyForOption(opt)
    const list = byKey.get(key) ?? []
    list.push(opt)
    byKey.set(key, list)
  })
  const groups: QuestionGroup[] = []
  byKey.forEach((options, key) => {
    groups.push({ key, options, selected: null, validated: false })
  })
  return groups
}

function findGroupForOption(
  groups: QuestionGroup[],
  option: HTMLElement,
): QuestionGroup | null {
  const key = groupKeyForOption(option)
  return groups.find((g) => g.key === key) ?? null
}

function clearOptionState(option: HTMLElement, isStandaloneQuiz: boolean): void {
  option.classList.remove(
    "selected-option",
    ...SELECTION_HIGHLIGHT_CLASSES,
    ...VERDICT_CLASSES,
    MC_SELECTED_CLASS,
    MC_CORRECT_CLASS,
    MC_INCORRECT_CLASS,
  )
  option.removeAttribute("aria-invalid")
  option.setAttribute("aria-checked", "false")
  const input = option.querySelector<HTMLInputElement>('input[type="radio"]')
  if (input) input.checked = false
  if (!isStandaloneQuiz) clearMcBadge(option)
  const feedback = option.querySelector<HTMLElement>(".feedback-container")
  if (feedback) {
    feedback.classList.add("hidden")
    const text = feedback.querySelector<HTMLElement>(".feedback-text")
    if (text) {
      text.textContent = ""
      text.className = "feedback-text"
    }
  }
}

function clearGroupStyles(group: QuestionGroup, isStandaloneQuiz: boolean): void {
  group.options.forEach((opt) => clearOptionState(opt, isStandaloneQuiz))
}

function markSelection(
  option: HTMLElement,
  group: QuestionGroup,
  isStandaloneQuiz: boolean,
): void {
  clearGroupStyles(group, isStandaloneQuiz)
  if (isStandaloneQuiz) {
    option.classList.add("selected-option", ...SELECTION_HIGHLIGHT_CLASSES)
  } else {
    option.classList.add(MC_SELECTED_CLASS)
  }
  option.setAttribute("aria-checked", "true")
  const input = option.querySelector<HTMLInputElement>('input[type="radio"]')
  if (input) input.checked = true
}

function applyValidationStyle(
  option: HTMLElement,
  isCorrect: boolean,
  isStandaloneQuiz: boolean,
): void {
  if (isStandaloneQuiz) {
    // Strip the blue selection ring so it doesn't fight the green/red verdict.
    option.classList.remove("selected-option", ...SELECTION_HIGHLIGHT_CLASSES)
    option.classList.add(isCorrect ? "bg-green-50" : "bg-red-50")
  } else {
    option.classList.remove(MC_SELECTED_CLASS)
    option.classList.add(isCorrect ? MC_CORRECT_CLASS : MC_INCORRECT_CLASS)
    attachMcBadge(option, isCorrect)
  }
  option.setAttribute("aria-invalid", isCorrect ? "false" : "true")
}

function showFeedback(
  option: HTMLElement,
  isCorrect: boolean,
  isStandaloneQuiz: boolean,
): void {
  const container = isStandaloneQuiz
    ? option.querySelector<HTMLElement>(".feedback-container")
    : ensureMcFeedbackContainer(option)
  if (!container) return
  container.classList.remove("hidden")
  let text = container.querySelector<HTMLElement>(".feedback-text")
  if (!text) {
    text = document.createElement("div")
    text.className = "feedback-text"
    container.appendChild(text)
  }
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

  // Standalone quiz pages jump to the next `qz` page on success; embedded
  // multiple-choice activities just advance one page like any other content.
  const sectionType = section.getAttribute("data-section-type")
  const isStandaloneQuiz = sectionType === "activity_quiz"
  const findPostCorrectHref = isStandaloneQuiz
    ? findNextActivityHref
    : findNextPageHref

  const groups = buildGroups(section)
  const hasNextPage = findNextPageHref() !== null
  const hasPostCorrectTarget = findPostCorrectHref() !== null

  function anyGroupSelected(): boolean {
    return groups.some((g) => g.selected !== null)
  }

  const resetState = () => {
    for (const g of groups) {
      g.selected = null
      g.validated = false
    }
    store.set(submitStateAtom, "submit")
    store.set(submitLabelAtom, null)
    store.set(submitEnabledAtom, false)
    store.set(skipEnabledAtom, hasNextPage)
  }

  const handleSelect = (option: HTMLElement) => {
    const group = findGroupForOption(groups, option)
    if (!group) return
    if (group.validated) clearGroupStyles(group, isStandaloneQuiz)
    markSelection(option, group, isStandaloneQuiz)
    playActivitySound("drop")
    group.selected = option
    group.validated = false
    store.set(submitStateAtom, "submit")
    store.set(submitLabelAtom, null)
    store.set(submitEnabledAtom, anyGroupSelected())
  }

  const handleValidate = () => {
    const state = store.get(submitStateAtom)
    if (state === "next") {
      // Post-correct: standalone quiz jumps to the next quiz, skipping reading
      // pages between them; embedded MC just advances one page.
      const href = findPostCorrectHref()
      if (href) window.location.href = href
      return
    }
    if (!anyGroupSelected()) return

    // Validate every group that has a selection. The section flips to the
    // post-correct state only when EVERY group is answered AND every selection
    // is correct — partial successes stay in submit so the user can fix wrong
    // picks or fill missing ones.
    let allCorrect = true
    for (const group of groups) {
      if (!group.selected) {
        allCorrect = false
        continue
      }
      const itemId = getOptionItemId(group.selected)
      if (!itemId) {
        allCorrect = false
        continue
      }
      const isCorrect = Boolean(correctAnswers[itemId])
      applyValidationStyle(group.selected, isCorrect, isStandaloneQuiz)
      showFeedback(group.selected, isCorrect, isStandaloneQuiz)
      group.validated = true
      if (!isCorrect) allCorrect = false
    }

    playActivitySound(allCorrect ? "success" : "error")

    if (allCorrect) {
      store.set(confettiTriggerAtom, store.get(confettiTriggerAtom) + 1)
      store.set(submitStateAtom, "next")
      store.set(submitLabelAtom, null)
      // Submit becomes "Next activity" — enabled only when a target exists.
      store.set(submitEnabledAtom, hasPostCorrectTarget)
    } else {
      store.set(submitStateAtom, "submit")
      store.set(submitLabelAtom, null)
      store.set(submitEnabledAtom, anyGroupSelected())
    }
  }

  const handleSkip = () => {
    const href = findNextPageHref()
    if (href) window.location.href = href
  }

  // WCAG 4.1.2: a list of `role="radio"` options is meaningless to screen
  // readers without a `role="radiogroup"` container that names the group.
  // The section ships with `role="article"` from the template — override it
  // since the section's primary semantic here IS the radio group. For
  // multi-group sections this is best-effort: ideally each <fieldset>/<div>
  // around a single question would carry the radiogroup, but the prompt
  // doesn't currently emit that container.
  section.setAttribute("role", "radiogroup")
  const applyLocalizedAria = () => {
    section.setAttribute(
      "aria-label",
      tr("activity-options-label", "Answer options"),
    )
  }
  applyLocalizedAria()

  const listeners: Array<() => void> = []
  for (const group of groups) {
    for (const option of group.options) {
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

      // Arrow-key navigation between native radios fires `change` on the new
      // radio without firing `click` on its label. Listen here too so keyboard
      // users actually see selection state update.
      const innerRadio = option.querySelector<HTMLInputElement>(
        'input[type="radio"]',
      )
      if (innerRadio) {
        const onChange = () => {
          if (innerRadio.checked) handleSelect(option)
        }
        innerRadio.addEventListener("change", onChange)
        listeners.push(() =>
          innerRadio.removeEventListener("change", onChange),
        )
      }

      listeners.push(() => {
        option.removeEventListener("click", onClick)
        option.removeEventListener("keydown", onKey)
      })
    }
  }

  store.set(validateHandlerAtom, () => handleValidate)
  store.set(skipHandlerAtom, () => handleSkip)
  resetState()

  // The feedback text and the section's aria-label are written into the DOM
  // imperatively (no `[data-id]`), so `applyTranslationsToDOM` won't touch
  // them on a language switch. Re-render them whenever the translation map
  // changes so the visible result message stays in sync with the chrome.
  const unsubTranslations = store.sub(translationsAtom, () => {
    applyLocalizedAria()
    for (const group of groups) {
      if (!group.validated || !group.selected) continue
      const itemId = getOptionItemId(group.selected)
      if (!itemId) continue
      showFeedback(
        group.selected,
        Boolean(correctAnswers[itemId]),
        isStandaloneQuiz,
      )
    }
  })

  return () => {
    listeners.forEach((off) => off())
    unsubTranslations()
    store.set(validateHandlerAtom, () => null)
    store.set(skipHandlerAtom, () => null)
    store.set(submitEnabledAtom, false)
    store.set(skipEnabledAtom, false)
  }
}
