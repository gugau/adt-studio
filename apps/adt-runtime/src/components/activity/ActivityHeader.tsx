import { useAtomValue, useSetAtom } from "jotai"
import { useMemo } from "react"
import { ClipboardCheck, LogOut, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { activityModeAtom, isActivityPageAtom } from "@/state/activity.atoms"
import { currentSectionIdAtom, pagesAtom } from "@/state/nav.atoms"
import { dockReadyAtom } from "@/state/ui.atoms"
import { useTranslation } from "@/hooks/useTranslation"
import { cn } from "@/lib/utils"

function isActivitySectionId(id: string): boolean {
  return id.startsWith("qz")
}

export function ActivityHeader() {
  const ready = useAtomValue(dockReadyAtom)
  const isActivity = useAtomValue(isActivityPageAtom)
  const activityMode = useAtomValue(activityModeAtom)
  const setActivityMode = useSetAtom(activityModeAtom)
  const pages = useAtomValue(pagesAtom)
  const currentSectionId = useAtomValue(currentSectionIdAtom)
  const { t } = useTranslation()

  const activities = useMemo(
    () => pages.filter((p) => isActivitySectionId(p.section_id)),
    [pages],
  )
  const currentIndex = activities.findIndex(
    (a) => a.section_id === currentSectionId,
  )

  if (!ready || !isActivity) return null

  const current = currentIndex >= 0 ? currentIndex + 1 : null
  const total = activities.length
  const progress =
    current !== null && total > 0 ? (current / total) * 100 : null

  const progressLabel =
    current !== null && total > 0
      ? `${t("activity-item-label") || "Activity"} ${current} / ${total}`
      : t("activity-item-label") || "Activity"

  const enterLabel = t("enter-activity-mode") || "Enter activity mode"
  const exitLabel = t("exit-activity-mode") || "Exit activity mode"
  const hintLabel = activityMode
    ? t("activity-focus-on-hint") || "Focus mode on"
    : t("activity-focus-off-hint") || "Tap to focus"

  return (
    <div
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[55] max-w-[calc(100vw-1.5rem)]"
      role="region"
      aria-label={progressLabel}
    >
      <div
        className={cn(
          "flex flex-col rounded-2xl overflow-hidden py-1 pb-3 gap-1",
          "bg-popover/95 text-popover-foreground backdrop-blur-md",
          "shadow-lg border-1 border-border",
          "transition-shadow duration-200 motion-reduce:transition-none",
          activityMode && "ring-emerald-300 dark:ring-emerald-700",
        )}
      >
        <div className="flex items-center gap-3 pl-3 pr-2 py-2 min-w-[18rem]">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              "bg-emerald-100 text-emerald-700",
              "dark:bg-emerald-900/40 dark:text-emerald-300",
              "transition-colors duration-200 motion-reduce:transition-none",
              activityMode &&
                "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950",
            )}
            aria-hidden="true"
          >
            {activityMode ? (
              <ClipboardCheck className="h-4 w-4" />
            ) : (
              <ClipboardCheck className="h-4 w-4" />
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-semibold leading-tight truncate">
              {progressLabel}
            </span>
            <span className="text-xs text-muted-foreground leading-tight truncate">
              {hintLabel}
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant={activityMode ? "outline" : "default"}
            onClick={() => setActivityMode((m) => !m)}
            className={cn(
              "h-8 shrink-0 gap-1.5 px-3 text-xs font-medium",
              !activityMode &&
                "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-emerald-950",
            )}
            aria-label={activityMode ? exitLabel : enterLabel}
          >
            {activityMode ? (
              <>
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t("exit-activity-mode-short") || "Exit"}</span>
              </>
            ) : (
              <>
                   <ClipboardCheck className="h-4 w-4" aria-hidden="true"/>
                <span>
                  {t("enter-activity-mode-short") || "Focus"}
                </span>
              </>
            )}
          </Button>
        </div>
        {progress !== null && total > 1 ? (
          <div
            className="h-1 bg-muted mx-4 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={current ?? 0}
            aria-valuemin={1}
            aria-valuemax={total}
            aria-label={progressLabel}
          >
            <div
              className="h-full bg-emerald-500 dark:bg-emerald-400 transition-[width] duration-300 ease-out motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
