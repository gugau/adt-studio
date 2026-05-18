import { useAtomValue } from "jotai";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import {
  skipEnabledAtom,
  skipHandlerAtom,
  submitEnabledAtom,
  submitLabelAtom,
  submitStateAtom,
  validateHandlerAtom,
} from "@/features/activity/state/activity.atoms";
import { useTranslation } from "@/features/language/hooks/useTranslation";
import { cn } from "@/shared/lib/utils";

export function DockActivityActions() {
  const submitEnabled = useAtomValue(submitEnabledAtom);
  const skipEnabled = useAtomValue(skipEnabledAtom);
  const validate = useAtomValue(validateHandlerAtom);
  const skip = useAtomValue(skipHandlerAtom);
  const submitState = useAtomValue(submitStateAtom);
  const submitLabelOverride = useAtomValue(submitLabelAtom);
  const { t } = useTranslation();

  const defaultLabel =
    submitState === "next"
      ? t("next-activity") || "Next activity"
      : t("submit-text") || "Submit";
  const submitLabel = submitLabelOverride ?? defaultLabel;
  const skipLabel =
    submitState === "next"
      ? t("next-page") || "Next page"
      : t("skip-activity") || "Skip activity";

  return (
    <div className="flex flex-1 items-center justify-between max-w-3xl gap-2 p-1">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              onClick={skip ?? undefined}
              disabled={!skipEnabled || !skip}
              variant="outline"
              size="lg"
              title={skipLabel}
              className="px-4 font-medium"
            >
              {skipLabel}
            </Button>
          }
        />
        <TooltipContent>{skipLabel}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              onClick={validate ?? undefined}
              disabled={!submitEnabled || !validate}
              size="lg"
              title={submitLabel}
              className={cn(
                "px-4 font-medium text-black",
                submitState === "next"
                  ? "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:white"
                  : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 dark:white",
              )}
            >
              {submitLabel}
            </Button>
          }
        />
        <TooltipContent>{submitLabel}</TooltipContent>
      </Tooltip>
    </div>
  );
}
