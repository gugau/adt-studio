import { useStageStatus } from "@/hooks/use-stage-status"
import { ExtractLandingPage } from "./ExtractLandingPage"
import { ExtractView } from "./ExtractView"

export function ExtractIndex({
  bookLabel,
  selectedPageId,
  onSelectPage,
}: {
  bookLabel: string
  stageSlug?: string
  selectedPageId?: string
  onSelectPage?: (pageId: string | null) => void
}) {
  const status = useStageStatus("extract")

  if (status.isCompleted || status.isRunning) {
    return (
      <ExtractView
        bookLabel={bookLabel}
        selectedPageId={selectedPageId}
        onSelectPage={onSelectPage}
      />
    )
  }

  return <ExtractLandingPage bookLabel={bookLabel} />
}
