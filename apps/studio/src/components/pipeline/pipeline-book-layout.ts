import { PIPELINE, type StageName } from "@adt/types"
import { getPipelineStages, type PipelineStageSlug } from "./stage-config"

/**
 * Pipeline stages that depend only on Storyboard — independent branches in the DAG
 * until Text & Speech (they are ordered in the API runner but not dependent on each other).
 */
export function parallelEnrichmentStageNames(): StageName[] {
  return PIPELINE.filter(
    (s) => s.dependsOn.length === 1 && s.dependsOn[0] === "storyboard"
  ).map((s) => s.name)
}

export type BookPipelineSegment =
  | { kind: "spine"; slug: PipelineStageSlug }
  | { kind: "parallel"; slugs: PipelineStageSlug[] }

/**
 * Book hub layout segments: single-column “spine” rows plus one grouped parallel band,
 * following UI stage order from {@link getPipelineStages}.
 */
export function buildBookPipelineSegments(): BookPipelineSegment[] {
  const parallel = new Set(parallelEnrichmentStageNames())
  const ordered = getPipelineStages().map((s) => s.slug)

  const segments: BookPipelineSegment[] = []
  let parallelBuf: PipelineStageSlug[] = []

  const flushParallel = () => {
    if (parallelBuf.length > 0) {
      segments.push({ kind: "parallel", slugs: parallelBuf })
      parallelBuf = []
    }
  }

  for (const slug of ordered) {
    if (parallel.has(slug as StageName)) {
      parallelBuf.push(slug)
    } else {
      flushParallel()
      segments.push({ kind: "spine", slug })
    }
  }
  flushParallel()

  return segments
}
