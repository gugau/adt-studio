import { useBookRun } from "@/hooks/use-book-run"

export function useStageStatus(stageSlug: string) {
  const { stageState } = useBookRun()
  const state = stageState(stageSlug)

  return {
    state,
    isRunning: state === "running" || state === "queued",
    isCompleted: state === "done",
    hasError: state === "error",
  }
}
