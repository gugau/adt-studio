import { useStageStatus } from "@/hooks/use-stage-status"
import { SectioningLandingPage } from "./SectioningLandingPage"
import { SectioningView } from "./SectioningView"

export function SectioningIndex({
  bookLabel,
  selectedPageId,
  onSelectPage,
}: {
  bookLabel: string
  stageSlug?: string
  selectedPageId?: string
  onSelectPage?: (pageId: string | null) => void
}) {
  const status = useStageStatus("sectioning")

  if (status.isCompleted || status.isRunning) {
    return (
      <SectioningView
        bookLabel={bookLabel}
        selectedPageId={selectedPageId}
        onSelectPage={onSelectPage}
      />
    )
  }

  return <SectioningLandingPage bookLabel={bookLabel} />
}
