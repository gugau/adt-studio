import { useBookRun } from "@/hooks/use-book-run"
import { usePages } from "@/hooks/use-pages"

export function usePrerequisiteChecks(bookLabel: string) {
  const { stageState } = useBookRun()
  const { data: pages } = usePages(bookLabel, { refetchOnMount: "always" })

  const storyboardReady = stageState("storyboard") === "done"
  const hasNoPages = pages != null && pages.length === 0
  const allPagesPruned =
    pages != null &&
    pages.length > 0 &&
    pages.every((p) => p.sectionCount > 0 && p.prunedSections.length >= p.sectionCount)
  const canRun = storyboardReady && !allPagesPruned && !hasNoPages

  return { storyboardReady, hasNoPages, allPagesPruned, canRun, pages }
}
