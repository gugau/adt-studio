import { useCallback } from "react"
import { useBookConfig, useUpdateBookConfig } from "@/hooks/use-book-config"

/**
 * Returns a `persist` function that merges a partial patch into the book's
 * existing config and dispatches the mutation. Used by every landing-page form
 * to write a single field (or a small group of fields) without duplicating the
 * spread + mutate boilerplate.
 */
export function usePersistConfig(bookLabel: string) {
  const { data: bookConfigData } = useBookConfig(bookLabel)
  const updateConfig = useUpdateBookConfig()
  return useCallback(
    (patch: Record<string, unknown>) => {
      const base = bookConfigData?.config ?? {}
      updateConfig.mutate({ label: bookLabel, config: { ...base, ...patch } })
    },
    [bookConfigData, bookLabel, updateConfig],
  )
}
