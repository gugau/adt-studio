import { useCallback, useMemo } from "react"
import { useElementContext } from "./element-context"
import type { ClassMap } from "./class-maps/types"

interface UseElementStylesResult<TValue> {
  value: TValue
  setValue: (next: TValue) => void
}

/**
 * Bridges a section's controls to the selected element's class list. Reads
 * via `classMap.fromClasses` on every render — the source of truth is the
 * element. `setValue` strips classes matching `classMap.matches` and appends
 * the new output, then persists via `useElementContext().onClassesChange`.
 */
export function useElementStyles<TValue>(
  classMap: ClassMap<TValue>,
  defaultValue: TValue
): UseElementStylesResult<TValue> {
  const { dataId, classes, onClassesChange } = useElementContext()

  const value = useMemo<TValue>(
    () => classMap.fromClasses(classes) ?? defaultValue,
    [classMap, classes, defaultValue]
  )

  const setValue = useCallback(
    (next: TValue) => {
      const stripped = classes.filter((c) => !classMap.matches(c))
      const additions = classMap.toClasses(next)
      const merged = additions.length > 0 ? [...stripped, ...additions] : stripped
      onClassesChange(dataId, merged)
    },
    [classMap, classes, dataId, onClassesChange]
  )

  return { value, setValue }
}
