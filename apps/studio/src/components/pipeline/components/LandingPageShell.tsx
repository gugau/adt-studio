import { useState, type CSSProperties, type ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { Play, Loader2, Settings } from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { PreviewShell } from "@/components/wizard/shared/PreviewShell"
import { useDownstreamWithOutput } from "@/hooks/use-downstream-with-output"
import {
  STAGE_LABEL_MESSAGES,
  getStageLabelI18n,
} from "../pipeline-i18n"
import { STAGES } from "../stage-config"

export function LandingPageShell({
  bookLabel,
  stageSlug,
  settingsTab = "general",
  colorClass,
  accentColor,
  accentColorSoft,
  errorColorClass = "bg-red-600 hover:bg-red-700",
  isRunning,
  isCompleted,
  hasError,
  canRun,
  extraDisabled = false,
  disabledReason,
  runLabel,
  rerunLabel,
  previewLabel,
  previewBodyClassName,
  onRun,
  preview,
  children,
}: {
  bookLabel: string
  stageSlug: string
  settingsTab?: string
  colorClass: string
  accentColor?: string
  accentColorSoft?: string
  errorColorClass?: string
  isRunning: boolean
  isCompleted: boolean
  hasError: boolean
  canRun: boolean
  extraDisabled?: boolean
  disabledReason?: ReactNode
  runLabel: ReactNode
  rerunLabel: ReactNode
  previewLabel: string
  previewBodyClassName?: string
  onRun: () => void
  preview: ReactNode
  children: ReactNode
}) {
  const { i18n } = useLingui()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const downstreamAffected = useDownstreamWithOutput(stageSlug)
  const needsConfirmation = isCompleted && downstreamAffected.length > 0

  const accentStyle: CSSProperties = {}
  if (accentColor) {
    ;(accentStyle as Record<string, string>)["--accent-color"] = accentColor
    ;(accentStyle as Record<string, string>)["--ring"] = accentColor
  }
  if (accentColorSoft) {
    ;(accentStyle as Record<string, string>)["--accent-color-soft"] =
      accentColorSoft
  }
  const isDisabled = isRunning || !canRun || extraDisabled
  const showTooltip = isDisabled && !isRunning && !!disabledReason

  const handleRunClick = () => {
    if (needsConfirmation) {
      setConfirmOpen(true)
    } else {
      onRun()
    }
  }

  const handleConfirm = () => {
    setConfirmOpen(false)
    onRun()
  }

  const affectedStages = downstreamAffected
    .filter((slug) => slug in STAGE_LABEL_MESSAGES)
    .map((slug) => STAGES.find((s) => s.slug === slug))
    .filter((s): s is (typeof STAGES)[number] => Boolean(s))
  const stageLabel = getStageLabelI18n(stageSlug)
  const currentStage = STAGES.find((s) => s.slug === stageSlug)

  const runButton = (
    <Button
      onClick={handleRunClick}
      disabled={isDisabled}
      className={cn(
        "h-10 px-5 font-medium text-white transition-[background-color,opacity] border-0",
        "disabled:opacity-50 disabled:cursor-default",
        hasError ? errorColorClass : colorClass
      )}
    >
      {isRunning ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          <Trans>Running...</Trans>
        </>
      ) : (
        <>
          <Play className="w-4 h-4 mr-2" />
          {isCompleted || hasError ? rerunLabel : runLabel}
        </>
      )}
    </Button>
  )

  return (
    <div
      className="flex h-full overflow-hidden gap-[10px]"
      style={accentStyle}
    >
      <aside className="flex flex-col w-[480px] shrink-0 overflow-hidden border-r border-gray-200">
        <div className="flex flex-col gap-6 px-8 pt-8 pb-4 flex-1 overflow-y-auto">
          {children}
        </div>

        <div className="shrink-0 border-t border-[#e5e5e5] px-6 py-4 flex items-center justify-between">
          <Link
            to="/books/$label/$step/settings"
            params={{ label: bookLabel, step: stageSlug }}
            search={{ tab: settingsTab }}
            className="flex items-center gap-1.5 text-sm font-medium text-[#737373] hover:text-[#0a0a0a] transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            <Trans>Advanced Settings</Trans>
          </Link>

          {showTooltip ? (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="inline-flex cursor-help">
                    <span className="pointer-events-none">{runButton}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" align="end" className="max-w-[260px] text-center">
                  {disabledReason}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            runButton
          )}
        </div>
      </aside>

      <main className="flex-1 flex items-center justify-center overflow-auto p-8">
        <div className="aspect-[650/812] h-full max-h-[700px] w-auto shrink-0">
          <PreviewShell label={previewLabel} className="h-full w-full" bodyClassName={previewBodyClassName ?? ""}>
            {preview}
          </PreviewShell>
        </div>
      </main>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="gap-5 p-6 sm:max-w-md">
          <DialogHeader className="flex-row items-start gap-3.5 space-y-0 text-left">
            {currentStage && (
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm",
                  currentStage.color,
                )}
                aria-hidden
              >
                <currentStage.icon
                  className="h-5 w-5 text-white"
                  strokeWidth={2}
                />
              </span>
            )}
            <div className="flex min-w-0 flex-col gap-1 pt-0.5">
              <DialogTitle className="text-[16px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
                <Trans>Re-run {stageLabel}?</Trans>
              </DialogTitle>
              <DialogDescription className="text-[13px] leading-snug text-[#525252]">
                <Trans>
                  The completed stages below will be reset and need to run
                  again before final outputs are available.
                </Trans>
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#a3a3a3]">
              <Trans>Will be reset</Trans>
              <span className="mx-1.5 text-[#d4d4d4]">·</span>
              <span className="tabular-nums">{affectedStages.length}</span>
            </p>
            <ul className="flex flex-col gap-1.5">
              {affectedStages.map((stage) => {
                const Icon = stage.icon
                return (
                  <li
                    key={stage.slug}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                      stage.borderColor,
                      stage.bgLight,
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white",
                        stage.color,
                      )}
                    >
                      <Icon
                        className="h-3.5 w-3.5"
                        strokeWidth={2}
                        aria-hidden
                      />
                    </span>
                    <span
                      className={cn(
                        "text-[13px] font-medium",
                        stage.textColor,
                      )}
                    >
                      {getStageLabelI18n(stage.slug)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>

          <div
            className="-mx-6 border-t border-[#f1f1f1]"
            aria-hidden
          />
          <DialogFooter className="-mt-1 gap-2">
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              className="h-10 px-4 font-medium text-[#525252] hover:text-[#0a0a0a]"
            >
              <Trans>Cancel</Trans>
            </Button>
            <Button
              onClick={handleConfirm}
              className={cn(
                "h-10 px-5 font-medium text-white border-0 shadow-sm",
                hasError ? errorColorClass : colorClass,
              )}
            >
              <Play className="w-4 h-4 mr-2" />
              {rerunLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
