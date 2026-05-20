import { useBookRun } from "@/hooks/use-book-run"
import {
  getStageClearOrder,
  STAGE_BY_NAME,
  type StageName,
} from "@adt/types"

/**
 * Returns the slugs of stages downstream of `stageSlug` that have completed
 * output. Drives the cascade warning so users only see names of stages whose
 * committed work would actually be reset — not stages that are merely queued
 * or in-flight, and not `stageSlug` itself. Returns [] for slugs that aren't
 * pipeline stages (e.g., "validation", "preview").
 */
export function useDownstreamWithOutput(stageSlug: string): StageName[] {
  const { stageState } = useBookRun()
  if (!(stageSlug in STAGE_BY_NAME)) return []
  return getStageClearOrder(stageSlug as StageName).filter(
    (slug) => slug !== stageSlug && stageState(slug) === "done",
  )
}
