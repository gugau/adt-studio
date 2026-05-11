import { useState, useEffect, useMemo } from "react"
import { flushSync } from "react-dom"
import { BookOpen, Hash, List, Sparkles } from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import { LandingPageShell } from "@/components/pipeline/components/LandingPageShell"
import { PrereqGuard } from "@/components/pipeline/components/PrereqGuard"
import {
  SettingsCard,
  SettingsField,
} from "@/components/pipeline/components/SettingsCard"
import { SettingExplainer } from "@/components/pipeline/components/SettingExplainer"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { useActiveConfig } from "@/hooks/use-debug"
import { useStageStatus } from "@/hooks/use-stage-status"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { usePersistConfig } from "@/hooks/use-persist-config"
import { cn } from "@/lib/utils"

type TocModeKey = "extract" | "dynamic"

export function TocLandingPage({ bookLabel }: { bookLabel: string }) {
  const { t } = useLingui()
  const { data: activeConfigData } = useActiveConfig(bookLabel)
  const persist = usePersistConfig(bookLabel)
  const { apiKey, hasApiKey } = useApiKey()
  const { queueRun } = useBookRun()
  const status = useStageStatus("toc")
  const storyboardStatus = useStageStatus("storyboard")
  const storyboardReady = storyboardStatus.isCompleted

  const [tocMode, setTocMode] = useState<TocModeKey>("extract")

  useEffect(() => {
    if (!activeConfigData) return
    const m = activeConfigData.merged as Record<string, unknown>
    if (m.toc_mode === "extract" || m.toc_mode === "dynamic") {
      setTocMode(m.toc_mode)
    }
  }, [activeConfigData])

  const handleModeChange = (value: TocModeKey) => {
    const update = () => {
      setTocMode(value)
      persist({ toc_mode: value })
    }
    const reduceMotion =
      typeof window !== "undefined" &&
      // eslint-disable-next-line lingui/no-unlocalized-strings -- CSS media query, not user-visible
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const doc = typeof document !== "undefined" ? document : null
    if (!doc || typeof doc.startViewTransition !== "function" || reduceMotion) {
      update()
      return
    }
    doc.startViewTransition(() => {
      flushSync(update)
    })
  }

  const handleRun = () => {
    if (!hasApiKey || !storyboardReady || status.isRunning) return
    queueRun({ fromStage: "toc", toStage: "toc", apiKey })
  }

  const modeOptions = useMemo(
    () => [
      { value: "extract" as const, label: t`Extract` },
      { value: "dynamic" as const, label: t`Dynamic` },
    ],
    [t],
  )

  const disabledReason = !hasApiKey ? (
    <Trans>Add an API key in Book settings to run TOC generation.</Trans>
  ) : !storyboardReady ? (
    <Trans>Run Storyboard first — the table of contents lists the typed sections it produces.</Trans>
  ) : undefined

  return (
    <LandingPageShell
      bookLabel={bookLabel}
      stageSlug="toc"
      settingsTab="general"
      colorClass="bg-amber-600 hover:bg-amber-700"
      accentColor="#d97706"
      accentColorSoft="#fef3c7"
      isRunning={status.isRunning}
      isCompleted={status.isCompleted}
      hasError={status.hasError}
      canRun={true}
      extraDisabled={!hasApiKey || !storyboardReady}
      disabledReason={disabledReason}
      runLabel={<Trans>Run TOC</Trans>}
      rerunLabel={<Trans>Re-run</Trans>}
      previewLabel={t`TOC Preview`}
      onRun={handleRun}
      preview={<TocPreview mode={tocMode} />}
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
          <Trans>Table of Contents</Trans>
        </h1>
        <p className="text-[14px] text-[#737373] leading-relaxed">
          <Trans>
            Build a navigable table of contents for the book. Decide whether
            entries mirror the typed section headings exactly or whether the
            model rephrases them into descriptive chapter titles.
          </Trans>
        </p>
      </div>

      <PrereqGuard
        upstreamSlug="storyboard"
        stageSlug="toc"
        description={
          <Trans>
            The TOC lists the typed sections placed by Storyboard. Finish
            Storyboard before running this stage.
          </Trans>
        }
      />

      <SettingsCard>
        <SettingsField
          label={<Trans>TOC Mode</Trans>}
          labelAction={<SettingExplainer visual={<TocModeVisual />} />}
          hint={
            tocMode === "extract" ? (
              <Trans>
                Use section headings verbatim. Fast, deterministic, and
                preserves the original wording from the book.
              </Trans>
            ) : (
              <Trans>
                Let the model write descriptive chapter titles based on each
                section's contents. Best for storybooks or when headings are
                missing.
              </Trans>
            )
          }
        >
          <SegmentedControl
            options={modeOptions}
            value={tocMode}
            onValueChange={handleModeChange}
          />
        </SettingsField>
      </SettingsCard>
    </LandingPageShell>
  )
}

function TocModeVisual() {
  return (
    <div className="flex flex-col gap-3 py-1">
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex w-full flex-col gap-1 rounded-md border border-amber-200 bg-amber-50/50 p-2">
          <div className="flex items-center gap-1.5">
            <Hash className="h-2.5 w-2.5 text-amber-700" strokeWidth={2.5} aria-hidden />
            <span className="text-[9px] font-semibold text-amber-900">
              <Trans>Chapter 1: Introduction</Trans>
            </span>
          </div>
          <div className="flex items-center gap-1.5 pl-2.5">
            <Hash className="h-2 w-2 text-amber-600" strokeWidth={2.5} aria-hidden />
            <span className="text-[8.5px] text-amber-800/80">
              <Trans>1.1 Background</Trans>
            </span>
          </div>
        </div>
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700"
        >
          <Trans>Extract</Trans>
        </span>
      </div>
      <div className="mx-auto h-px w-16 bg-amber-200/60" aria-hidden />
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex w-full flex-col gap-1 rounded-md border border-amber-200 bg-amber-50/50 p-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-2.5 w-2.5 text-amber-700" strokeWidth={2.5} aria-hidden />
            <span className="text-[9px] font-semibold italic text-amber-900">
              <Trans>Where it all begins</Trans>
            </span>
          </div>
          <div className="flex items-center gap-1.5 pl-2.5">
            <Sparkles className="h-2 w-2 text-amber-600" strokeWidth={2.5} aria-hidden />
            <span className="text-[8.5px] italic text-amber-800/80">
              <Trans>The world before us</Trans>
            </span>
          </div>
        </div>
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700"
        >
          <Trans>Dynamic</Trans>
        </span>
      </div>
    </div>
  )
}

interface TocEntryPreview {
  level: 1 | 2
  title: string
  meta?: string
}

function TocPreview({ mode }: { mode: TocModeKey }) {
  const { t } = useLingui()

  const extractEntries: TocEntryPreview[] = useMemo(
    () => [
      { level: 1, title: t`Chapter 1: Introduction`, meta: t`p. 1` },
      { level: 2, title: t`1.1 Background`, meta: t`p. 3` },
      { level: 2, title: t`1.2 Scope`, meta: t`p. 7` },
      { level: 1, title: t`Chapter 2: Methods`, meta: t`p. 12` },
      { level: 2, title: t`2.1 Data collection`, meta: t`p. 14` },
      { level: 2, title: t`2.2 Analysis`, meta: t`p. 21` },
      { level: 1, title: t`Chapter 3: Results`, meta: t`p. 28` },
      { level: 1, title: t`Chapter 4: Conclusion`, meta: t`p. 41` },
    ],
    [t],
  )

  const dynamicEntries: TocEntryPreview[] = useMemo(
    () => [
      { level: 1, title: t`Where it all begins`, meta: t`p. 1` },
      { level: 2, title: t`The world before us`, meta: t`p. 3` },
      { level: 2, title: t`A question worth asking`, meta: t`p. 7` },
      { level: 1, title: t`Gathering the evidence`, meta: t`p. 12` },
      { level: 2, title: t`Listening to the data`, meta: t`p. 14` },
      { level: 2, title: t`Patterns in the noise`, meta: t`p. 21` },
      { level: 1, title: t`What we discovered`, meta: t`p. 28` },
      { level: 1, title: t`Looking forward`, meta: t`p. 41` },
    ],
    [t],
  )

  const entries = mode === "extract" ? extractEntries : dynamicEntries

  return (
    <div className="relative flex flex-1 min-h-0 overflow-hidden bg-gradient-to-b from-amber-50/40 via-white to-white">
      <div className="flex w-full h-full flex-col gap-3 px-5 py-5 min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <List className="h-3.5 w-3.5 text-amber-700" strokeWidth={2} aria-hidden />
            <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-amber-700 leading-none">
              <Trans>Table of Contents</Trans>
            </span>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-amber-500/80 leading-none">
            <Trans>Sample</Trans>
          </span>
        </div>

        {/* Reader-style TOC panel */}
        <div className="flex-1 min-h-0 overflow-hidden rounded-lg border border-amber-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-amber-100 pb-2.5">
            <BookOpen className="h-3.5 w-3.5 text-amber-600" strokeWidth={2} aria-hidden />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#525252]">
              <Trans>Contents</Trans>
            </span>
            <span
              className={cn(
                "ml-auto rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider transition-colors",
                mode === "extract"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
              )}
              style={{ viewTransitionName: "toc-mode-badge" }}
            >
              {mode === "extract" ? <Trans>Extract</Trans> : <Trans>Dynamic</Trans>}
            </span>
          </div>
          <ul className="mt-2.5 flex flex-col gap-0.5">
            {entries.map((entry, i) => (
              <li
                key={i}
                className={cn(
                  "group flex items-center gap-2 rounded px-2 py-1.5 transition-colors",
                  entry.level === 2 && "ml-4",
                )}
              >
                <span
                  className={cn(
                    "flex h-1 w-1 shrink-0 rounded-full",
                    entry.level === 1 ? "bg-amber-500" : "bg-amber-300",
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "flex-1 truncate transition-colors",
                    entry.level === 1
                      ? "text-[12.5px] font-medium text-[#0a0a0a]"
                      : "text-[11.5px] text-[#525252]",
                    mode === "dynamic" && "italic",
                  )}
                  style={{ viewTransitionName: `toc-entry-${i}` }}
                >
                  {entry.title}
                </span>
                <span
                  className={cn(
                    "shrink-0 font-mono text-[10px] tabular-nums text-[#a3a3a3] opacity-0 transition-opacity group-hover:opacity-100",
                    entry.level === 1 && "opacity-60",
                  )}
                >
                  {entry.meta}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Mode hint footer */}
        <div className="flex shrink-0 items-center gap-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-[10.5px] text-amber-800">
          {mode === "extract" ? (
            <Hash className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden />
          ) : (
            <Sparkles className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden />
          )}
          {mode === "extract" ? (
            <Trans>Titles taken verbatim from typed section headings.</Trans>
          ) : (
            <Trans>Titles generated by the model from section content.</Trans>
          )}
        </div>
      </div>
    </div>
  )
}
