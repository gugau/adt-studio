import { DockActivityActions } from "./DockActivityActions";
import { cn } from "@/shared/lib/utils";
import { useTranslation } from "@/features/language/hooks/useTranslation";
import { useAtomValue } from "jotai";
import { activityModeAtom } from "@/features/activity/state/activity.atoms";
import { useDockContext } from "@/features/dock/context/dock-context";

export function ActivityDock() {
  const { t } = useTranslation();
  const { isCompact, shouldHide, isTop } = useDockContext();
  const activityMode = useAtomValue(activityModeAtom);
  if (!activityMode) return null;

  return (
    <div
      className={cn(
        "justify-center",
        "flex items-center gap-1 p-1 h-full w-fit",
        "bg-popover/95 text-popover-foreground backdrop-blur-md",
        "shadow-lg ring-1 ring-border",
        "transition-all duration-200 ease-out will-change-transform",
        "rounded-2xl",
        "fixed z-[56] h-auto left-0 right-0 mx-auto",
        isCompact ? `${isTop ? "top" : "bottom" }-21` : `${isTop ? "top" : "bottom" }-18`,
        shouldHide && "opacity-0 pointer-events-none",
        shouldHide && (isTop ? "-translate-y-[150%]" : "translate-y-[150%]"),
      )}
      aria-label={t("dock-label") || "Activity controls"}
    >
      <DockActivityActions />
    </div>
  );
}
