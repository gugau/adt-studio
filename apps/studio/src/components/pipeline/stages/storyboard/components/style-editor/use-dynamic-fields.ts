import { useEffect, useState } from "react"

export interface OptionalFieldDef<T extends string> {
  key: T
  /**
   * Pattern that matches a Tailwind class (with or without breakpoint prefix)
   * indicating this field has a value already. When any class matches, the
   * field auto-appears even though the user hasn't manually added it.
   */
  classMatch: RegExp
}

interface DynamicFieldsApi<T extends string> {
  has: (key: T) => boolean
  enable: (key: T) => void
  disable: (key: T) => void
  enabled: ReadonlySet<T>
}

/**
 * Manages the set of optional fields a section is currently showing.
 *
 * Seeds the set from class detection so that an element with e.g. `min-w-32`
 * already in its class list opens the "Min width" field on mount. Re-seeds
 * whenever the element identity (and therefore the classes coming in) changes.
 */
export function useDynamicFields<T extends string>(
  optionals: ReadonlyArray<OptionalFieldDef<T>>,
  classes: string[],
  resetKey: string = ""
): DynamicFieldsApi<T> {
  const [enabled, setEnabled] = useState<Set<T>>(() => seed(optionals, classes))

  // resetKey ties the auto-seed to the element identity. classes/optionals are
  // intentionally not deps so the user's manual add/disable choices stick for
  // the duration of editing a single element.
  useEffect(() => {
    setEnabled(seed(optionals, classes))
  }, [resetKey])

  return {
    has: (key) => enabled.has(key),
    enable: (key) => setEnabled((prev) => new Set([...prev, key])),
    disable: (key) =>
      setEnabled((prev) => {
        if (!prev.has(key)) return prev
        const next = new Set(prev)
        next.delete(key)
        return next
      }),
    enabled,
  }
}

function seed<T extends string>(
  optionals: ReadonlyArray<OptionalFieldDef<T>>,
  classes: string[]
): Set<T> {
  const out = new Set<T>()
  for (const f of optionals) {
    if (classes.some((c) => f.classMatch.test(c))) out.add(f.key)
  }
  return out
}
