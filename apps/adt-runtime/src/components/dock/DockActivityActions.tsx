import { useAtomValue } from "jotai"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  skipEnabledAtom,
  skipHandlerAtom,
  submitEnabledAtom,
  submitLabelAtom,
  submitStateAtom,
  validateHandlerAtom,
} from "@/state/activity.atoms"
import { currentSectionIdAtom, pagesAtom } from "@/state/nav.atoms"
import { useTranslation } from "@/hooks/useTranslation"
import { cn } from "@/lib/utils"
import { DockIconButton } from "./DockIconButton"

export function DockActivityActions() {
  const submitEnabled = useAtomValue(submitEnabledAtom)
  const skipEnabled = useAtomValue(skipEnabledAtom)
  const validate = useAtomValue(validateHandlerAtom)
  const skip = useAtomValue(skipHandlerAtom)
  const submitState = useAtomValue(submitStateAtom)
  const submitLabelOverride = useAtomValue(submitLabelAtom)
  const pages = useAtomValue(pagesAtom)
  const currentSectionId = useAtomValue(currentSectionIdAtom)
  const { t } = useTranslation()

  const idx = pages.findIndex((p) => p.section_id === currentSectionId)
  const prev = idx > 0 ? pages[idx - 1] : undefined

  const defaultLabel =
    submitState === "next"
      ? t("next-activity") || "Next activity"
      : t("submit-text") || "Submit"
  const submitLabel = submitLabelOverride ?? defaultLabel
  const skipLabel = t("skip-activity") || "Skip activity"

  return (
    <div className="flex flex-1 items-center justify-between max-w-3xl gap-2 px-2">
      <DockIconButton
        ariaLabel={t("previous-page") || "Previous page"}
        disabled={!prev}
        onClick={() => {
          if (prev) window.location.href = prev.href
        }}
      >
        <ChevronLeft className="w-4 h-4" />
      </DockIconButton>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={skip ?? undefined}
          disabled={!skipEnabled || !skip}
          variant="outline"
          size="sm"
          className="h-9 px-4 font-medium"
        >
          {skipLabel}
        </Button>
        <Button
          type="button"
          onClick={validate ?? undefined}
          disabled={!submitEnabled || !validate}
          size="sm"
          className={cn(
            "h-9 px-4 font-medium text-white",
            submitState === "next"
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-blue-600 hover:bg-blue-700",
          )}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}
