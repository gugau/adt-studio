import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { Play, Loader2, Settings } from "lucide-react"
import { Trans } from "@lingui/react/macro"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { PreviewShell } from "@/components/wizard/shared/PreviewShell"

export function LandingPageShell({
  bookLabel,
  stageSlug,
  settingsTab = "general",
  colorClass,
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
  const isDisabled = isRunning || !canRun || extraDisabled
  const showTooltip = isDisabled && !isRunning && !!disabledReason

  const runButton = (
    <Button
      onClick={onRun}
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
    <div className="flex h-full overflow-hidden gap-[10px]">
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
    </div>
  )
}
