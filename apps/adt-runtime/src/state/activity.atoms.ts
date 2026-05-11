/**
 * Activity-level state — selection, validation handlers, and submit/reset
 * visibility. Each page hosts at most one activity, so a single set of atoms
 * is sufficient; there's no "current activity index" because each section is
 * its own HTML page.
 *
 * Legacy parity: the single `#submit-button` from `interface.html` morphed
 * between three states (submit → retry → next-activity); the React runtime
 * tracks that explicitly via `submitStateAtom`, with `submitLabelAtom` as an
 * optional override for activity-specific labels.
 */
import { atom } from "jotai"
import { ephemeralAtom } from "./persist"

export type ValidateHandler = () => void
export type RetryHandler = () => void
export type SubmitState = "submit" | "retry" | "next"

export const submitVisibleAtom = ephemeralAtom(false)
export const resetVisibleAtom = ephemeralAtom(false)

export const validateHandlerAtom = ephemeralAtom<ValidateHandler | null>(null)
export const retryHandlerAtom = ephemeralAtom<RetryHandler | null>(null)

export const submitStateAtom = ephemeralAtom<SubmitState>("submit")
export const submitLabelAtom = ephemeralAtom<string | null>(null)

/** True whenever an activity exposes either submit or reset to the user. */
export const activityModeAtom = atom(
  (get) => get(submitVisibleAtom) || get(resetVisibleAtom),
)

export const selectedOptionAtom = ephemeralAtom<string | null>(null)
export const selectedWordAtom = ephemeralAtom<string | null>(null)
export const currentWordAtom = ephemeralAtom<string | null>(null)
