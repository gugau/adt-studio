import { useAtomValue, useSetAtom } from "jotai"
import { RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  resetVisibleAtom,
  retryHandlerAtom,
  submitLabelAtom,
  submitStateAtom,
  submitVisibleAtom,
  validateHandlerAtom,
} from "@/state/activity.atoms"
import { useTranslation } from "@/hooks/useTranslation"
import { cn } from "@/lib/utils"
import { DockIconButton } from "./DockIconButton"

/**
 * Activity controls rendered inline at the right of the dock when the page
 * hosts an activity. Mirrors the legacy `#submit-button` + `#reset-button`
 * pair from `interface.html`, including the three submit-button states
 * (submit / retry / next-activity).
 */
export function DockActivityActions() {
  const submitVisible = useAtomValue(submitVisibleAtom)
  const resetVisible = useAtomValue(resetVisibleAtom)
  const validate = useAtomValue(validateHandlerAtom)
  const retry = useAtomValue(retryHandlerAtom)
  const submitState = useAtomValue(submitStateAtom)
  const submitLabelOverride = useAtomValue(submitLabelAtom)
  const setSubmitVisible = useSetAtom(submitVisibleAtom)
  const setResetVisible = useSetAtom(resetVisibleAtom)
  const { t } = useTranslation()

  if (!submitVisible && !resetVisible) return null

  const defaultLabel =
    submitState === "next"
      ? t("next-activity") || "Next activity"
      : submitState === "retry"
        ? t("retry") || "Try again"
        : t("submit-text") || "Submit"

  const submitLabel = submitLabelOverride ?? defaultLabel

  const exitActivityMode = () => {
    // First clear the underlying activity state, then drop the visibility
    // flags so the dock returns to the normal (non-activity) layout.
    retry?.()
    setSubmitVisible(false)
    setResetVisible(false)
  }

  return (
    <div className="flex items-center gap-1 pl-1">
      <DockIconButton
        ariaLabel={t("exit-activity-mode") || "Exit activity mode"}
        onClick={exitActivityMode}
        size="sm"
      >
        <X className="w-4 h-4" />
      </DockIconButton>
      {resetVisible && retry ? (
        <DockIconButton
          ariaLabel={t("reset-text") || "Reset"}
          onClick={retry}
          size="sm"
        >
          <RefreshCw className="w-4 h-4" />
        </DockIconButton>
      ) : null}
      {submitVisible && validate ? (
        <Button
          onClick={validate}
          size="sm"
          className={cn(
            "h-9 px-4 font-medium",
            submitState === "next"
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : "bg-blue-600 hover:bg-blue-700 text-white",
          )}
        >
          {submitLabel}
        </Button>
      ) : null}
    </div>
  )
}
