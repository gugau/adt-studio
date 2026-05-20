import { useStageStatus } from "@/hooks/use-stage-status"
import { CaptionsLandingPage } from "./CaptionsLandingPage"
import { CaptionsView } from "./CaptionsView"

export function CaptionsIndex({
  bookLabel,
  selectedPageId,
  onSelectPage,
}: {
  bookLabel: string
  stageSlug?: string
  selectedPageId?: string
  onSelectPage?: (pageId: string | null) => void
}) {
  const status = useStageStatus("captions")

  if (status.isCompleted || status.isRunning) {
    return (
      <CaptionsView
        bookLabel={bookLabel}
        selectedPageId={selectedPageId}
        onSelectPage={onSelectPage}
      />
    )
  }

  return <CaptionsLandingPage bookLabel={bookLabel} />
}
