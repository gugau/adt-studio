import { LayoutDashboard } from "lucide-react"
import { useLingui } from "@lingui/react/macro"

/**
 * Header toggle that switches the quizzes stage between the generated-quiz
 * preview and the landing page ("overview"). Mirrors the Storyboard overview
 * toggle so the two stages feel consistent.
 */
export function QuizzesOverviewToggle({
  active,
  onToggle,
}: {
  active: boolean
  onToggle: () => void
}) {
  const { t } = useLingui()
  return (
    <button
      type="button"
      onClick={onToggle}
      title={t`Overview`}
      className={`flex items-center justify-center w-7 h-7 rounded transition-colors ${
        active
          ? "bg-white/30 text-white"
          : "bg-white/15 hover:bg-white/25 text-white/70"
      }`}
    >
      <LayoutDashboard className="h-3.5 w-3.5" />
    </button>
  )
}
