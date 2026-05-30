import { useCallback, useEffect, useState } from "react"
import { Trans } from "@lingui/react/macro"
import { useQuizzes } from "@/hooks/use-quizzes"
import { useStepHeader } from "../../components/StepViewRouter"
import { QuizzesLandingPage } from "./QuizzesLandingPage"
import { QuizzesView } from "./QuizzesView"
import { QuizzesOverviewToggle } from "./components/QuizzesOverviewToggle"

/**
 * Overview mode: the landing page shown from inside the quizzes stage, with the
 * header toggle wired to flip back to the quiz preview.
 */
function QuizzesOverview({
  bookLabel,
  onClose,
}: {
  bookLabel: string
  onClose: () => void
}) {
  const { setExtra, setOnLabelClick } = useStepHeader()

  useEffect(() => {
    setOnLabelClick(null)
    setExtra(
      <>
        <span className="text-white/40 text-sm">/</span>
        <span className="text-sm font-medium">
          <Trans>Overview</Trans>
        </span>
        <div className="ml-auto flex gap-1">
          <QuizzesOverviewToggle active onToggle={onClose} />
        </div>
      </>
    )
    return () => {
      setExtra(null)
      setOnLabelClick(null)
    }
  }, [setExtra, setOnLabelClick, onClose])

  return <QuizzesLandingPage bookLabel={bookLabel} />
}

export function QuizzesIndex({
  bookLabel,
  selectedPageId,
  onSelectPage,
}: {
  bookLabel: string
  selectedPageId?: string
  onSelectPage?: (pageId: string | null) => void
}) {
  const { data } = useQuizzes(bookLabel)
  const hasQuizzes = (data?.quizzes?.quizzes?.length ?? 0) > 0
  const [overview, setOverview] = useState(false)

  // Opening the overview clears any selected page so the landing takes over;
  // selecting a page from the sidebar always returns to that item's preview.
  const showOverview = useCallback(() => {
    setOverview(true)
    onSelectPage?.(null)
  }, [onSelectPage])
  const hideOverview = useCallback(() => setOverview(false), [])

  // A selected page always shows that item's editable preview — never the
  // landing — so picking a quiz from the sidebar opens its edit view.
  if (selectedPageId) {
    return (
      <QuizzesView
        bookLabel={bookLabel}
        selectedPageId={selectedPageId}
        onShowOverview={hasQuizzes ? showOverview : undefined}
      />
    )
  }

  // No page selected: show the landing when explicitly in overview, or when no
  // quizzes have been generated yet (the only meaningful screen).
  if (overview || !hasQuizzes) {
    return hasQuizzes ? (
      <QuizzesOverview bookLabel={bookLabel} onClose={hideOverview} />
    ) : (
      <QuizzesLandingPage bookLabel={bookLabel} />
    )
  }

  // Quizzes exist and no page is selected: the preview is the main screen, with
  // an "Overview" toggle in the header that opens the landing page.
  return <QuizzesView bookLabel={bookLabel} onShowOverview={showOverview} />
}
