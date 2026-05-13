import { useAtom, useAtomValue } from "jotai"
import { ListChecks } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Popover, PopoverContent } from "@/shared/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip"
import {
  skipEnabledAtom,
  skipHandlerAtom,
  submitEnabledAtom,
  submitLabelAtom,
  submitStateAtom,
  validateHandlerAtom,
} from "@/features/activity/state/activity.atoms"
import { dockMenuValueAtom } from "@/shared/state/ui.atoms"
import { useTranslation } from "@/features/language/hooks/useTranslation"
import { cn } from "@/shared/lib/utils"
import { DockIconButton } from "@/features/dock/components/DockIconButton"
import { useDockContext } from "@/features/dock/context/dock-context"
import { ActivityListContent } from "@/features/activity/components/ActivityListDockContent"


export function DockActivityActions() {
  const submitEnabled = useAtomValue(submitEnabledAtom)
  const skipEnabled = useAtomValue(skipEnabledAtom)
  const validate = useAtomValue(validateHandlerAtom)
  const skip = useAtomValue(skipHandlerAtom)
  const submitState = useAtomValue(submitStateAtom)
  const submitLabelOverride = useAtomValue(submitLabelAtom)
  const [menuValue, setMenuValue] = useAtom(dockMenuValueAtom)
  const { ref: anchor, popoverSide } = useDockContext()
  const { t } = useTranslation()

  const defaultLabel =
    submitState === "next"
      ? t("next-activity") || "Next activity"
      : t("submit-text") || "Submit"
  const submitLabel = submitLabelOverride ?? defaultLabel
  const skipLabel =
    submitState === "next"
      ? t("next-page") || "Next page"
      : t("skip-activity") || "Skip activity"
  const activitiesOpen = menuValue === "activities"

  return (
    <div className="flex flex-1 items-center justify-between max-w-3xl gap-2 px-2">
      <DockIconButton
        ariaLabel={t("activities-label") || "Activities"}
        pressed={activitiesOpen}
        onClick={() =>
          setMenuValue((prev) => (prev === "activities" ? "" : "activities"))
        }
      >
        <ListChecks className="w-5 h-5" />
      </DockIconButton>

      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                onClick={skip ?? undefined}
                disabled={!skipEnabled || !skip}
                variant="outline"
                size="sm"
                title={skipLabel}
                className="h-9 px-4 font-medium"
              >
                {skipLabel}
              </Button>
            }
          />
          <TooltipContent side={popoverSide}>{skipLabel}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                onClick={validate ?? undefined}
                disabled={!submitEnabled || !validate}
                size="sm"
                title={submitLabel}
                className={cn(
                  "h-9 px-4 font-medium text-white",
                  submitState === "next"
                    ? "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-emerald-950"
                    : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-blue-950",
                )}
              >
                {submitLabel}
              </Button>
            }
          />
          <TooltipContent side={popoverSide}>{submitLabel}</TooltipContent>
        </Tooltip>
      </div>

      <Popover
        open={activitiesOpen}
        onOpenChange={(next, eventDetails) => {
          if (next) return
          if (
            eventDetails.reason === "outside-press" &&
            eventDetails.event &&
            (eventDetails.event.target as HTMLElement | null)?.closest(
              "[data-dock-trigger]",
            )
          ) {
            return
          }
          setMenuValue("")
        }}
      >
        <PopoverContent
          side={popoverSide}
          align="center"
          sideOffset={12}
          anchor={anchor}
          className="w-auto p-0 overflow-hidden rounded-2xl"
        >
          <ActivityListContent />
        </PopoverContent>
      </Popover>
    </div>
  )
}
