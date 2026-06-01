/**
 * Returns true when an event target represents an element that is currently
 * receiving user typing input — used to suppress global keyboard shortcuts
 * (e.g. ArrowLeft/Right for page nav) while the user is editing text or
 * navigating a focused radio-group activity option.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  if (target.isContentEditable) return true
  // Quiz options listen to arrow keys for radio-group navigation in the
  // legacy a11y pattern; let them keep the keystroke when focused.
  if (target.closest("[data-activity-item]")) return true
  return false
}
