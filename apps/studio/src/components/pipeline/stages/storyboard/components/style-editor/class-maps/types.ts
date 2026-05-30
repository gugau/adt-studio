/**
 * Bidirectional mapping between a control's value and the Tailwind classes
 * that produce it. Array-shaped on both sides so multi-class shorthand
 * properties (padding, border, etc.) fit naturally.
 *
 * `matches` is the strip-predicate: every class for which it returns true is
 * removed before `toClasses` output is appended. Step 7 will layer
 * breakpoint-prefix handling on top of these base helpers.
 */
export interface ClassMap<TValue> {
  matches: (cls: string) => boolean
  fromClasses: (classes: string[]) => TValue | null
  toClasses: (value: TValue) => string[]
}
