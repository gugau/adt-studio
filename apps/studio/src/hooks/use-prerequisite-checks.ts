import { useBookRun } from "@/hooks/use-book-run"
import { usePages } from "@/hooks/use-pages"

export function usePrerequisiteChecks(bookLabel: string) {
  const { stageState, isStatusLoading } = useBookRun()
  const { data: pages, isPending: pagesPending } = usePages(bookLabel, { refetchOnMount: "always" })

  const isLoading = isStatusLoading || pagesPending
  const storyboardReady = stageState("storyboard") === "done"
  const hasNoPages = pages != null && pages.length === 0
  const allPagesPruned =
    pages != null &&
    pages.length > 0 &&
    pages.every((p) => p.sectionCount > 0 && p.prunedSections.length >= p.sectionCount)
  const canRun = storyboardReady && !allPagesPruned && !hasNoPages

  return { storyboardReady, hasNoPages, allPagesPruned, canRun, pages, isLoading }
}
