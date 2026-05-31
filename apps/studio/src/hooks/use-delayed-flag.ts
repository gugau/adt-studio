import { useEffect, useState } from "react"

/** True only after `value` has been true continuously for `delayMs`. Use to
 * suppress a UI signal (e.g. a loader) when the underlying condition is
 * expected to resolve within the grace period. */
export function useDelayedFlag(value: boolean, delayMs: number): boolean {
  const [delayed, setDelayed] = useState(false)
  useEffect(() => {
    if (!value) {
      setDelayed(false)
      return
    }
    const timer = setTimeout(() => setDelayed(true), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return delayed
}
