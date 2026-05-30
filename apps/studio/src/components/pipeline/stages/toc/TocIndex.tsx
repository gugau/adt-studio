import { useStageStatus } from "@/hooks/use-stage-status"
import { TocLandingPage } from "./TocLandingPage"
import { TocView } from "./TocView"

export function TocIndex({
  bookLabel,
}: {
  bookLabel: string
  stageSlug?: string
  selectedPageId?: string
  onSelectPage?: (pageId: string | null) => void
}) {
  const status = useStageStatus("toc")

  if (status.isCompleted || status.isRunning) {
    return <TocView bookLabel={bookLabel} />
  }

  return <TocLandingPage bookLabel={bookLabel} />
}
