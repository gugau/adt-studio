import { useStageStatus } from "@/hooks/use-stage-status"
import { StoryboardLandingPage } from "./StoryboardLandingPage"
import { StoryboardView } from "./StoryboardView"

export function StoryboardIndex({
  bookLabel,
  selectedPageId,
  onSelectPage,
}: {
  bookLabel: string
  stageSlug?: string
  selectedPageId?: string
  onSelectPage?: (pageId: string | null) => void
}) {
  const status = useStageStatus("storyboard")

  if (status.isCompleted || status.isRunning) {
    return (
      <StoryboardView
        bookLabel={bookLabel}
        selectedPageId={selectedPageId}
        onSelectPage={onSelectPage}
      />
    )
  }

  return <StoryboardLandingPage bookLabel={bookLabel} />
}
