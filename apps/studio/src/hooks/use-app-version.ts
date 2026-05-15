import { useMemo } from "react"
import { isElectron } from "@/lib/utils"

/**
 * App version exposed by the Electron main process. Returns `null` in the web build.
 * Stable across renders.
 */
export function useAppVersion(): string | null {
  return useMemo(() => {
    if (!isElectron() || typeof window === "undefined") return null
    return window.api?.version ?? null
  }, [])
}
