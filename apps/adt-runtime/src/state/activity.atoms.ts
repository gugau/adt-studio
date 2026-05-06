/**
 * Activity-level state — selection, validation handlers, and submit/reset
 * visibility. Each page hosts at most one activity, so a single set of atoms
 * is sufficient; there's no "current activity index" because each section is
 * its own HTML page.
 */
import { ephemeralAtom } from "./persist"

export type ValidateHandler = () => void
export type RetryHandler = () => void

export const submitVisibleAtom = ephemeralAtom(false)
export const resetVisibleAtom = ephemeralAtom(false)

export const validateHandlerAtom = ephemeralAtom<ValidateHandler | null>(null)
export const retryHandlerAtom = ephemeralAtom<RetryHandler | null>(null)

export const selectedOptionAtom = ephemeralAtom<string | null>(null)
export const selectedWordAtom = ephemeralAtom<string | null>(null)
export const currentWordAtom = ephemeralAtom<string | null>(null)
