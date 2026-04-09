import { useState } from "react"
import {
  Loader2, AlertCircle,
} from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import { Button } from "@/components/ui/button"
import { useBookRun } from "@/hooks/use-book-run"
import { useExportWatcher } from "@/hooks/use-export-watcher"
import { type ExportFeatureToggles } from "@/hooks/use-export-features"
import { buildExportFormatConfig, type ExportFormat } from "./export-formats"
import { ExportDialog } from "./ExportDialog"

export function ExportView({ bookLabel }: { bookLabel: string }) {
  const { t } = useLingui()
  const { startExport, isPreparing, preparingFormat, error } = useExportWatcher()
  const { stageState } = useBookRun()
  const storyboardDone = stageState("storyboard") === "done"
  const formats = buildExportFormatConfig(t)

  const [featureToggles, setFeatureToggles] = useState<ExportFeatureToggles>({
    glossary: true,
    readAloud: true,
    quizzes: true,
  })

  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat | null>(null)

  const openDialog = (format: ExportFormat) => {
    setSelectedFormat(format)
    setExportDialogOpen(true)
  }

  const handleConfirmExport = () => {
    if (selectedFormat) {
      startExport(selectedFormat, selectedFormat === "project" ? undefined : featureToggles)
      setExportDialogOpen(false)
    }
  }

  const formatError = (fmt: ExportFormat) => error?.format === fmt ? error.message : null

  if (!storyboardDone) {
    return (
      <div className="p-6 max-w-xl flex flex-col items-center gap-3 text-center">
        <AlertCircle className="w-8 h-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          <Trans>A storyboard must be built before exporting.</Trans>
        </p>
        <p className="text-sm text-muted-foreground">
          <Trans>Run the pipeline through at least the</Trans>{" "}
          <span className="font-medium text-foreground"><Trans>Storyboard</Trans></span>{" "}
          <Trans>stage first.</Trans>
        </p>
      </div>
    )
  }

  const formatCards: ExportFormat[] = ["project", "adt", "scorm", "webpub"]

  return (
    <div className="p-6 flex flex-col items-center gap-4 w-full">
      <div className="grid grid-cols-2 gap-3 w-full max-w-xl">
        {formatCards.map((fmt) => {
          const cfg = formats[fmt]
          const Icon = cfg.icon
          const err = formatError(fmt)
          return (
            <div
              key={fmt}
              className={`rounded-xl border p-4 flex flex-col gap-3 transition-colors ${err ? "border-red-200 bg-red-50/30" : `${cfg.borderColor} ${cfg.bgLight}/30 hover:${cfg.bgLight}/60`}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-md ${cfg.bgLight} border ${cfg.borderColor} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${cfg.textColor}`} />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">{cfg.label}</h3>
                </div>
                {cfg.badge && (
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${cfg.textColor} ${cfg.bgLight} border ${cfg.borderColor} rounded px-1.5 py-0.5 leading-none`}>
                    {cfg.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed flex-1">
                {cfg.description}
              </p>
              <div className="flex flex-col gap-1">
                <Button
                  size="sm"
                  className={err ? "bg-red-50 text-red-600 border-red-300 hover:bg-red-100 border transition-colors" : `${cfg.buttonClass} transition-colors`}
                  onClick={() => openDialog(fmt)}
                  disabled={isPreparing}
                >
                  {preparingFormat === fmt
                    ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    : <Icon className="mr-1.5 h-3.5 w-3.5" />}
                  {err ? <Trans>Retry Export</Trans> : <Trans>Export</Trans>}
                </Button>
                {err && <p className="text-[11px] leading-tight text-red-500">{err}</p>}
              </div>
            </div>
          )
        })}
      </div>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        selectedFormat={selectedFormat}
        bookLabel={bookLabel}
        featureToggles={featureToggles}
        onFeatureToggleChange={(feature, value) => setFeatureToggles((prev) => ({ ...prev, [feature]: value }))}
        onConfirmExport={handleConfirmExport}
        isPreparing={isPreparing}
        preparingFormat={preparingFormat}
        error={error}
      />
    </div>
  )
}
