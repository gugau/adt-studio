import { useState, useEffect, useCallback } from "react"
import { FileText } from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LandingPageShell } from "@/components/pipeline/components/LandingPageShell"
import { SettingsCard, SettingsField } from "@/components/pipeline/components/SettingsCard"
import { RunProgress } from "@/components/pipeline/components/RunProgress"
import { useBookConfig, useUpdateBookConfig } from "@/hooks/use-book-config"
import { useStageStatus } from "@/hooks/use-stage-status"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"

type SpreadModeKey = "single" | "spread"

export function ExtractLandingPage({ bookLabel }: { bookLabel: string }) {
  const { t } = useLingui()
  const { data: bookConfigData } = useBookConfig(bookLabel)
  const updateConfig = useUpdateBookConfig()
  const { apiKey, hasApiKey } = useApiKey()
  const { queueRun } = useBookRun()
  const status = useStageStatus("extract")

  const [startPage, setStartPage] = useState("")
  const [endPage, setEndPage] = useState("")
  const [spreadMode, setSpreadMode] = useState<SpreadModeKey>("single")
  const [vectorTextGrouping, setVectorTextGrouping] = useState(true)

  useEffect(() => {
    if (!bookConfigData) return
    const c = bookConfigData.config
    setSpreadMode(c.spread_mode === true ? "spread" : "single")
    setVectorTextGrouping(c.vector_text_grouping !== false)
    setStartPage(c.start_page != null ? String(c.start_page) : "")
    setEndPage(c.end_page != null ? String(c.end_page) : "")
  }, [bookConfigData])

  const persist = useCallback(
    (patch: Record<string, unknown>) => {
      const base = bookConfigData?.config ?? {}
      updateConfig.mutate({ label: bookLabel, config: { ...base, ...patch } })
    },
    [bookConfigData, bookLabel, updateConfig]
  )

  const commitPageRange = () => {
    persist({
      start_page: startPage.trim() ? Number(startPage) : undefined,
      end_page: endPage.trim() ? Number(endPage) : undefined,
    })
  }

  const handleSpreadModeChange = (value: string) => {
    const next = value === "spread" ? "spread" : "single"
    setSpreadMode(next)
    persist({ spread_mode: next === "spread" })
  }

  const handleVectorTextChange = (next: boolean) => {
    setVectorTextGrouping(next)
    persist({ vector_text_grouping: next })
  }

  const handleRun = () => {
    if (!hasApiKey || status.isRunning) return
    queueRun({ fromStage: "extract", toStage: "extract", apiKey })
  }

  const disabledReason = !hasApiKey ? (
    <Trans>Add an API key in Book settings to run extraction.</Trans>
  ) : undefined

  return (
    <LandingPageShell
      bookLabel={bookLabel}
      stageSlug="extract"
      settingsTab="general"
      colorClass="bg-blue-600 hover:bg-blue-700"
      isRunning={status.isRunning}
      isCompleted={status.isCompleted}
      hasError={status.hasError}
      canRun={true}
      extraDisabled={!hasApiKey}
      disabledReason={disabledReason}
      runLabel={<Trans>Run Extract</Trans>}
      rerunLabel={<Trans>Re-run</Trans>}
      previewLabel={t`Extract Preview`}
      onRun={handleRun}
      preview={
        status.isRunning ? (
          <div className="flex flex-1 items-center justify-center">
            <RunProgress stepKey="extract" spinnerColorClass="text-blue-500" />
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-blue-50/30 via-white to-blue-50/20 text-center px-6">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-100 text-blue-600">
              <FileText className="w-7 h-7" />
            </div>
            <p className="text-sm font-medium text-[#262626]">
              <Trans>Extracted pages will appear here</Trans>
            </p>
            <p className="text-xs text-[#737373] max-w-[260px] leading-relaxed">
              <Trans>
                Run extraction to pull page text, images, and metadata from
                the source PDF.
              </Trans>
            </p>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
          <Trans>Extract</Trans>
        </h1>
        <p className="text-[14px] text-[#737373] leading-relaxed">
          <Trans>
            Pull structured content from the source PDF. Extraction identifies
            headings, paragraphs, lists, and images so downstream stages work
            with clean, typed content instead of raw PDF.
          </Trans>
        </p>
      </div>

      <SettingsCard>
        <SettingsField
          label={<Trans>Page Range</Trans>}
          hint={<Trans>Leave empty to process all pages.</Trans>}
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              value={startPage}
              onChange={(e) => setStartPage(e.target.value)}
              onBlur={commitPageRange}
              placeholder={t`First`}
              className="w-24"
            />
            <span className="text-xs text-muted-foreground">{t`to`}</span>
            <Input
              type="number"
              min={1}
              value={endPage}
              onChange={(e) => setEndPage(e.target.value)}
              onBlur={commitPageRange}
              placeholder={t`Last`}
              className="w-24"
            />
          </div>
        </SettingsField>

        <SettingsField
          label={<Trans>Spread Mode</Trans>}
          hint={
            <Trans>
              Use Spread for scanned books where two pages appear on a single
              PDF page.
            </Trans>
          }
        >
          <Select value={spreadMode} onValueChange={handleSpreadModeChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">{t`Single page`}</SelectItem>
              <SelectItem value="spread">{t`Facing pages (spread)`}</SelectItem>
            </SelectContent>
          </Select>
        </SettingsField>

        <SettingsField
          label={<Trans>Figure Extraction</Trans>}
          hint={
            <Trans>
              Group nearby text labels with vector figures (e.g. chart axes,
              speech bubbles) so they're extracted together.
            </Trans>
          }
        >
          <div className="flex items-center gap-2">
            <Switch
              id="extract-figure-grouping"
              checked={vectorTextGrouping}
              onCheckedChange={handleVectorTextChange}
            />
            <Label htmlFor="extract-figure-grouping" className="text-sm font-normal">
              <Trans>Include text overlays in figures</Trans>
            </Label>
          </div>
        </SettingsField>
      </SettingsCard>
    </LandingPageShell>
  )
}
