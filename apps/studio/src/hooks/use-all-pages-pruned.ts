import { useMemo } from "react"
import { usePages } from "@/hooks/use-pages"

/**
 * True when every page that has sections has all its sections pruned —
 * i.e. nothing will reach validation/preview/export.
 */
export function useAllPagesPruned(bookLabel: string) {
  const { data: pages, isLoading } = usePages(bookLabel)
  const allPruned = useMemo(() => {
    if (!pages || pages.length === 0) return false
    const nonEmpty = pages.filter((p) => p.sectionCount > 0)
    if (nonEmpty.length === 0) return false
    return nonEmpty.every((p) => p.prunedSections.length >= p.sectionCount)
  }, [pages])
  return { allPruned, isLoading }
}
