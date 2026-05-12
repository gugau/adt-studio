import { useState } from "react"
import { Trans, useLingui } from "@lingui/react/macro"
import { LandingPageShell } from "@/components/pipeline/components/LandingPageShell"
import { StageBlockedState } from "@/components/pipeline/components/StageBlockedState"
import {
  SettingsCard,
  SettingsField,
} from "@/components/pipeline/components/SettingsCard"
import { useBookRun } from "@/hooks/use-book-run"
import { useAllPagesPruned } from "@/hooks/use-all-pages-pruned"
import { useExportWatcher } from "@/hooks/use-export-watcher"
import {
  type ExportFeatureToggles,
  useAllProjectFeatures,
} from "@/hooks/use-export-features"
import {
  buildExportFormatConfig,
  type ExportFormat,
} from "./export-formats"
import { ExportDialog } from "./ExportDialog"
import { FormatPicker } from "./components/FormatPicker"
import { ExportPreview } from "./components/ExportPreview"

export function ExportLandingPage({ bookLabel }: { bookLabel: string }) {
  const { t } = useLingui()
  const { stageState } = useBookRun()
  const storyboardDone = stageState("storyboard") === "done"
  const { allPruned } = useAllPagesPruned(bookLabel)
  const { startExport, isPreparing, preparingFormat, error } =
    useExportWatcher()
  const projectFeatures = useAllProjectFeatures(bookLabel)
  const available = projectFeatures.toggleable

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("adt")
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [languageOrder, setLanguageOrder] = useState<string[] | null>(null)
  const [featureToggles, setFeatureToggles] = useState<ExportFeatureToggles>({
    glossary: true,
    readAloud: true,
    quizzes: true,
    signLanguage: true,
  })

  const handleOpenDialog = () => {
    setExportDialogOpen(true)
  }

  const handleConfirmExport = () => {
    const features =
      selectedFormat === "project"
        ? undefined
        : {
            glossary: featureToggles.glossary && available.glossary,
            readAloud: featureToggles.readAloud && available.readAloud,
            quizzes: featureToggles.quizzes && available.quizzes,
            signLanguage:
              featureToggles.signLanguage && available.signLanguage,
            languages: languageOrder ?? undefined,
          }
    startExport(selectedFormat, features)
    setExportDialogOpen(false)
  }

  const formatLabels = buildExportFormatConfig(t)

  const formatError =
    error?.format === selectedFormat ? error.message : null

  if (!storyboardDone) {
    return (
      <StageBlockedState
        bookLabel={bookLabel}
        reason="storyboard-missing"
        stageLabel={<Trans>Export</Trans>}
      />
    )
  }

  if (allPruned) {
    return (
      <StageBlockedState
        bookLabel={bookLabel}
        reason="all-pruned"
        stageLabel={<Trans>Export</Trans>}
      />
    )
  }

  const isThisFormatPreparing = preparingFormat === selectedFormat

  return (
    <LandingPageShell
      bookLabel={bookLabel}
      stageSlug="export"
      settingsTab="general"
      colorClass="bg-indigo-700 hover:bg-indigo-800"
      accentColor="#4338ca"
      accentColorSoft="#e0e7ff"
      isRunning={isThisFormatPreparing}
      isCompleted={false}
      hasError={!!formatError}
      canRun={true}
      runLabel={
        <Trans>Export {formatLabels[selectedFormat].label}</Trans>
      }
      rerunLabel={<Trans>Retry Export</Trans>}
      previewLabel={t`Export Preview`}
      onRun={handleOpenDialog}
      preview={<ExportPreview format={selectedFormat} />}
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
          <Trans>Export</Trans>
        </h1>
        <p className="text-[14px] text-[#737373] leading-relaxed">
          <Trans>
            Package the book for distribution. Pick a format, choose what
            content goes in, and we'll bundle everything into a downloadable
            archive.
          </Trans>
        </p>
      </div>

      <SettingsCard>
        <SettingsField label={<Trans>Format</Trans>}>
          <FormatPicker
            selected={selectedFormat}
            onSelect={setSelectedFormat}
            t={t}
            errorFormat={error?.format ?? null}
          />
        </SettingsField>
      </SettingsCard>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        selectedFormat={selectedFormat}
        bookLabel={bookLabel}
        featureToggles={featureToggles}
        onFeatureToggleChange={(feature, value) =>
          setFeatureToggles((prev) => ({ ...prev, [feature]: value }))
        }
        languageOrder={languageOrder}
        onLanguageOrderChange={setLanguageOrder}
        onConfirmExport={handleConfirmExport}
        isPreparing={isPreparing}
        preparingFormat={preparingFormat}
        error={error}
      />
    </LandingPageShell>
  )
}
