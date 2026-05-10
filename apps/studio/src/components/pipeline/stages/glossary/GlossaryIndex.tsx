import { useStageStatus } from "@/hooks/use-stage-status"
import { GlossaryLandingPage } from "./GlossaryLandingPage"
import { GlossaryView } from "./GlossaryView"

export function GlossaryIndex({ bookLabel }: { bookLabel: string }) {
  const status = useStageStatus("glossary")

  if (status.isCompleted || status.isRunning) {
    return <GlossaryView bookLabel={bookLabel} />
  }

  return <GlossaryLandingPage bookLabel={bookLabel} />
}
