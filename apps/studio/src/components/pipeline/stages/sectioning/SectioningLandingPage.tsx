import { useState, useEffect, useMemo } from "react"
import type { ReactNode } from "react"
import { ArrowDown, FileText, Image as ImageIcon, Layers, List, Type } from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import { LandingPageShell } from "@/components/pipeline/components/LandingPageShell"
import { PrereqGuard } from "@/components/pipeline/components/PrereqGuard"
import { SettingsCard, SettingsField } from "@/components/pipeline/components/SettingsCard"
import { SettingExplainer } from "@/components/pipeline/components/SettingExplainer"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { BrandedSwitch } from "@/components/ui/branded-switch"
import { useBookConfig } from "@/hooks/use-book-config"
import { useActiveConfig } from "@/hooks/use-debug"
import { useStageStatus } from "@/hooks/use-stage-status"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { usePersistConfig } from "@/hooks/use-persist-config"
import { ACCENT_VAR, ACCENT_VAR_LIGHT } from "@/components/pipeline/lib/accent-var"
import { cn } from "@/lib/utils"

type SectioningModeKey = "dynamic" | "page"

export function SectioningLandingPage({ bookLabel }: { bookLabel: string }) {
  const { t } = useLingui()
  const { data: bookConfigData } = useBookConfig(bookLabel)
  const { data: activeConfigData } = useActiveConfig(bookLabel)
  const persist = usePersistConfig(bookLabel)
  const { apiKey, hasApiKey } = useApiKey()
  const { queueRun } = useBookRun()
  const status = useStageStatus("sectioning")
  const extractStatus = useStageStatus("extract")
  const extractReady = extractStatus.isCompleted

  const [sectioningMode, setSectioningMode] = useState<SectioningModeKey>("dynamic")
  const [disabledSectionTypes, setDisabledSectionTypes] = useState<Set<string>>(new Set())

  const merged = activeConfigData?.merged as Record<string, unknown> | undefined

  const activityNames = useMemo(() => {
    if (!merged) return [] as string[]
    const sectionTypes = (merged.section_types ?? {}) as Record<string, unknown>
    const strategies = (merged.render_strategies ?? {}) as Record<string, { render_type?: string }>
    const names = new Set<string>()
    for (const key of Object.keys(sectionTypes)) {
      if (key.startsWith("activity_")) names.add(key)
    }
    for (const [name, strat] of Object.entries(strategies)) {
      if (strat?.render_type === "activity") names.add(name)
    }
    return Array.from(names)
  }, [merged])

  const activitiesEnabled =
    activityNames.length > 0 && activityNames.some((name) => !disabledSectionTypes.has(name))

  useEffect(() => {
    if (!activeConfigData) return
    const m = activeConfigData.merged as Record<string, unknown>
    if (m.page_sectioning && typeof m.page_sectioning === "object") {
      const ps = m.page_sectioning as Record<string, unknown>
      if (ps.mode === "page" || ps.mode === "dynamic") setSectioningMode(ps.mode)
    }
    if (Array.isArray(m.disabled_section_types)) {
      setDisabledSectionTypes(new Set(m.disabled_section_types as string[]))
    }
  }, [activeConfigData])

  const handleModeChange = (value: SectioningModeKey) => {
    setSectioningMode(value)
    const existingPS = (bookConfigData?.config?.page_sectioning ?? {}) as Record<string, unknown>
    persist({ page_sectioning: { ...existingPS, mode: value } })
  }

  const handleActivityDetectionChange = (next: boolean) => {
    if (activityNames.length === 0) return
    const updated = new Set(disabledSectionTypes)
    for (const name of activityNames) {
      if (next) updated.delete(name)
      else updated.add(name)
    }
    setDisabledSectionTypes(updated)
    persist({ disabled_section_types: Array.from(updated) })
  }

  const handleRun = () => {
    if (!hasApiKey || !extractReady || status.isRunning) return
    queueRun({ fromStage: "sectioning", toStage: "sectioning", apiKey })
  }

  const modeOptions = useMemo(
    () => [
      { value: "dynamic" as const, label: t`Dynamic` },
      { value: "page" as const, label: t`By Page` },
    ],
    [t],
  )

  const disabledReason = !hasApiKey ? (
    <Trans>Add an API key in Book settings to run sectioning.</Trans>
  ) : !extractReady ? (
    <Trans>Run Extract first — sectioning needs extracted page text and images.</Trans>
  ) : undefined

  return (
    <LandingPageShell
      bookLabel={bookLabel}
      stageSlug="sectioning"
      settingsTab="section-types"
      colorClass="bg-sky-600 hover:bg-sky-700"
      accentColor="#0284c7"
      accentColorSoft="#e0f2fe"
      isRunning={status.isRunning}
      isCompleted={status.isCompleted}
      hasError={status.hasError}
      canRun={true}
      extraDisabled={!hasApiKey || !extractReady}
      disabledReason={disabledReason}
      runLabel={<Trans>Run Sectioning</Trans>}
      rerunLabel={<Trans>Re-run</Trans>}
      previewLabel={t`Sectioning Preview`}
      onRun={handleRun}
      preview={<SectioningPreview />}
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
          <Trans>Sectioning</Trans>
        </h1>
        <p className="text-[14px] text-[#737373] leading-relaxed">
          <Trans>
            Group each page's text and images into typed sections with a
            structured content tree. Sections drive how downstream stages
            render, translate, and read the book aloud.
          </Trans>
        </p>
      </div>

      <PrereqGuard
        upstreamSlug="extract"
        stageSlug="sectioning"
        description={
          <Trans>
            Sectioning needs the page text and images that Extract produces.
            Finish Extract before running this stage.
          </Trans>
        }
      />

      <SettingsCard>
        <SettingsField
          label={<Trans>Sectioning Mode</Trans>}
          labelAction={<SettingExplainer visual={<SectioningModeVisual />} />}
          hint={
            sectioningMode === "page" ? (
              <Trans>
                Treat each page as a single section. Best for storybooks and
                self-contained pages.
              </Trans>
            ) : (
              <Trans>
                Keep pages whole by default, but split when distinct activity
                types are detected on the same page.
              </Trans>
            )
          }
        >
          <SegmentedControl
            options={modeOptions}
            value={sectioningMode}
            onValueChange={handleModeChange}
          />
        </SettingsField>
      </SettingsCard>

      <ActivityDetectionToggle
        checked={activitiesEnabled}
        disabled={activityNames.length === 0}
        onCheckedChange={handleActivityDetectionChange}
      />
    </LandingPageShell>
  )
}

function PageModeDiagram() {
  const accent = (op: number) => ({ background: ACCENT_VAR, opacity: op })
  return (
    <div className="flex items-center justify-center gap-2.5">
      <div
        className="relative flex h-[64px] w-[44px] flex-col overflow-hidden rounded border p-1.5"
        style={{ borderColor: ACCENT_VAR }}
      >
        <div className="absolute inset-0" style={accent(0.05)} aria-hidden />
        <div className="relative flex flex-1 flex-col gap-1">
          <div className="h-1 w-full rounded-full" style={accent(0.4)} />
          <div className="h-1 w-3/4 rounded-full" style={accent(0.4)} />
          <div className="mt-1 h-3 w-full rounded" style={accent(0.18)} />
          <div className="h-1 w-full rounded-full" style={accent(0.4)} />
          <div className="h-1 w-2/3 rounded-full" style={accent(0.4)} />
        </div>
      </div>
      <span
        className="text-[10px] font-medium"
        style={{ color: ACCENT_VAR_LIGHT, opacity: 0.7 }}
        aria-hidden
      >
        =
      </span>
      <div
        className="relative flex h-[64px] w-[44px] flex-col overflow-hidden rounded border-2 p-1.5"
        style={{ borderColor: ACCENT_VAR }}
      >
        <div className="absolute inset-0" style={accent(0.1)} aria-hidden />
        <div className="relative flex flex-1 flex-col gap-1">
          <div className="h-1 w-full rounded-full" style={accent(0.75)} />
          <div className="h-1 w-3/4 rounded-full" style={accent(0.75)} />
          <div className="mt-1 h-3 w-full rounded" style={accent(0.3)} />
          <div className="h-1 w-full rounded-full" style={accent(0.75)} />
          <div className="h-1 w-2/3 rounded-full" style={accent(0.75)} />
        </div>
      </div>
    </div>
  )
}

function DynamicModeDiagram() {
  const accent = (op: number) => ({ background: ACCENT_VAR, opacity: op })
  return (
    <div className="flex items-center justify-center gap-2.5">
      <div
        className="relative flex h-[64px] w-[44px] flex-col overflow-hidden rounded border p-1.5"
        style={{ borderColor: ACCENT_VAR }}
      >
        <div className="absolute inset-0" style={accent(0.05)} aria-hidden />
        <div className="relative flex flex-1 flex-col gap-0.5">
          <div className="h-0.5 w-full rounded-full" style={accent(0.45)} />
          <div className="h-0.5 w-3/4 rounded-full" style={accent(0.45)} />
          <div className="mt-0.5 h-px w-full border-t border-dashed border-amber-400/70" />
          <div className="mt-0.5 h-0.5 w-full rounded-full bg-amber-500/65" />
          <div className="h-0.5 w-2/3 rounded-full bg-amber-500/65" />
        </div>
      </div>
      <svg
        className="h-2.5 w-3 shrink-0"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden
        style={{ color: ACCENT_VAR_LIGHT, opacity: 0.8 }}
      >
        <path
          d="M2 6h8M7 3l3 3-3 3"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex flex-col gap-1">
        <div
          className="relative flex h-[28px] w-[44px] flex-col justify-center gap-0.5 overflow-hidden rounded border-2 px-1.5"
          style={{ borderColor: ACCENT_VAR }}
        >
          <div className="absolute inset-0" style={accent(0.1)} aria-hidden />
          <div className="relative h-0.5 w-full rounded-full" style={accent(0.8)} />
          <div className="relative h-0.5 w-3/4 rounded-full" style={accent(0.8)} />
        </div>
        <div className="flex h-[28px] w-[44px] flex-col justify-center gap-0.5 rounded border-2 border-amber-400/80 bg-amber-100/80 px-1.5">
          <div className="h-0.5 w-full rounded-full bg-amber-500/80" />
          <div className="h-0.5 w-2/3 rounded-full bg-amber-500/80" />
        </div>
      </div>
    </div>
  )
}

function SectioningModeVisual() {
  return (
    <div className="flex flex-col items-center gap-3 py-1">
      <DiagramWithLabel label={<Trans>Dynamic</Trans>}>
        <DynamicModeDiagram />
      </DiagramWithLabel>
      <div
        className="h-px w-16"
        style={{ background: ACCENT_VAR, opacity: 0.18 }}
        aria-hidden
      />
      <DiagramWithLabel label={<Trans>Page</Trans>}>
        <PageModeDiagram />
      </DiagramWithLabel>
    </div>
  )
}

function DiagramWithLabel({
  label,
  children,
}: {
  label: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      {children}
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: ACCENT_VAR }}
      >
        {label}
      </span>
    </div>
  )
}

function ActivityDetectionToggle({
  checked,
  disabled,
  onCheckedChange,
}: {
  checked: boolean
  disabled: boolean
  onCheckedChange: (next: boolean) => void
}) {
  function toggle() {
    if (disabled) return
    onCheckedChange(!checked)
  }

  return (
    <div
      role="switch"
      id="sectioning-activity-detection"
      aria-checked={checked}
      aria-disabled={disabled}
      aria-labelledby="sectioning-activity-detection-title"
      aria-describedby="sectioning-activity-detection-subtitle"
      tabIndex={disabled ? -1 : 0}
      className={cn(
        "flex w-full select-none items-center justify-center gap-2.5 rounded-lg border px-4 py-3 shadow-sm transition-colors",
        "bg-white border-border",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:bg-muted hover:border-input",
      )}
      onClick={toggle}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault()
          toggle()
        }
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col items-start justify-center gap-0.5">
        <p
          id="sectioning-activity-detection-title"
          className="select-none text-sm font-semibold leading-5 text-foreground"
        >
          <Trans>Activity Detection</Trans>
        </p>
        <p
          id="sectioning-activity-detection-subtitle"
          className="w-full select-none text-xs font-normal leading-4 text-muted-foreground"
        >
          <Trans>
            Detects exercises and quizzes embedded in the book and classifies
            them as their own sections so they can render as interactive
            elements downstream.
          </Trans>
        </p>
      </div>
      <BrandedSwitch
        id="sectioning-activity-detection-switch"
        checked={checked}
        decorative
        disabled={disabled}
      />
    </div>
  )
}

function SectioningPreview() {
  type Block = {
    key: string
    icon: ReactNode
    label: ReactNode
  }
  const inputBlocks: Block[] = [
    {
      key: "h",
      icon: <Type className="w-3 h-3" strokeWidth={2.25} />,
      label: <Trans>Heading</Trans>,
    },
    {
      key: "p1",
      icon: <Type className="w-3 h-3" strokeWidth={2.25} />,
      label: <Trans>Paragraph</Trans>,
    },
    {
      key: "l",
      icon: <List className="w-3 h-3" strokeWidth={2.25} />,
      label: <Trans>List</Trans>,
    },
    {
      key: "i",
      icon: <ImageIcon className="w-3 h-3" strokeWidth={2} />,
      label: <Trans>Image</Trans>,
    },
    {
      key: "p2",
      icon: <Type className="w-3 h-3" strokeWidth={2.25} />,
      label: <Trans>Paragraph</Trans>,
    },
  ]

  type SectionLeaf = { icon: ReactNode; label: ReactNode; meta?: ReactNode }
  type Section = {
    key: string
    label: ReactNode
    container: ReactNode
    leaves: SectionLeaf[]
  }
  const sections: Section[] = [
    {
      key: "intro",
      label: <Trans>Intro</Trans>,
      container: <Trans>section › group</Trans>,
      leaves: [
        {
          icon: <Type className="w-2.5 h-2.5" strokeWidth={2.25} />,
          label: <Trans>heading</Trans>,
          meta: <Trans>Section 3 · Overview</Trans>,
        },
        {
          icon: <Type className="w-2.5 h-2.5" strokeWidth={2.25} />,
          label: <Trans>paragraph</Trans>,
          meta: <Trans>22 words</Trans>,
        },
      ],
    },
    {
      key: "body",
      label: <Trans>Body</Trans>,
      container: <Trans>section › list</Trans>,
      leaves: [
        {
          icon: <List className="w-2.5 h-2.5" strokeWidth={2.25} />,
          label: <Trans>list_item</Trans>,
          meta: <Trans>Read the prompt aloud</Trans>,
        },
        {
          icon: <List className="w-2.5 h-2.5" strokeWidth={2.25} />,
          label: <Trans>list_item</Trans>,
          meta: <Trans>Identify the key idea</Trans>,
        },
        {
          icon: <List className="w-2.5 h-2.5" strokeWidth={2.25} />,
          label: <Trans>list_item</Trans>,
          meta: <Trans>Try the practice problem</Trans>,
        },
      ],
    },
    {
      key: "activity",
      label: <Trans>Activity</Trans>,
      container: <Trans>section › activity</Trans>,
      leaves: [
        {
          icon: <Type className="w-2.5 h-2.5" strokeWidth={2.25} />,
          label: <Trans>question</Trans>,
          meta: <Trans>multiple choice</Trans>,
        },
        {
          icon: <Layers className="w-2.5 h-2.5" strokeWidth={2.25} />,
          label: <Trans>choice</Trans>,
          meta: <Trans>×4</Trans>,
        },
        {
          icon: <Type className="w-2.5 h-2.5" strokeWidth={2.25} />,
          label: <Trans>answer_key</Trans>,
        },
      ],
    },
  ]

  return (
    <div className="relative flex flex-1 min-h-0 overflow-hidden bg-gradient-to-b from-sky-50/40 via-white to-white">
      <div className="flex flex-col w-full h-full px-5 py-4 gap-3">
        {/* INPUT — extracted blocks */}
        <div className="flex flex-col items-center gap-2 w-full shrink-0">
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-sky-600" strokeWidth={2} />
            <span className="font-semibold text-[10px] tracking-[0.18em] uppercase text-sky-700">
              <Trans>Extracted Blocks</Trans>
            </span>
          </div>
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {inputBlocks.map((block) => (
              <div
                key={block.key}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-white ring-1 ring-sky-200"
              >
                <span className="text-sky-500">{block.icon}</span>
                <span className="text-[9px] text-sky-700 font-medium leading-none">
                  {block.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CONNECTOR */}
        <div className="flex flex-col items-center shrink-0" aria-hidden>
          <div className="w-px h-2 bg-sky-200" />
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-sky-600 text-white shadow-sm">
            <ArrowDown className="w-3 h-3" strokeWidth={2.5} />
          </div>
          <div className="w-px h-2 bg-sky-200" />
        </div>

        {/* OUTPUT — typed sections (flex-1 fills remaining space) */}
        <div className="flex flex-col items-stretch w-full gap-2 flex-1 min-h-0">
          <span className="font-semibold text-[10px] tracking-[0.18em] uppercase text-sky-700 shrink-0">
            <Trans>Typed Sections</Trans>
          </span>

          <div className="flex flex-col gap-2 flex-1 min-h-0">
            {sections.map((section) => (
              <SectionCard
                key={section.key}
                label={section.label}
                container={section.container}
                leaves={section.leaves}
              />
            ))}
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-center gap-2 shrink-0">
          <span className="tracking-[0.3em] text-[10px] font-bold text-sky-400">···</span>
          <span className="text-[10px] font-medium text-sky-600/70">
            <Trans>and more sections across the page</Trans>
          </span>
        </div>
      </div>
    </div>
  )
}

function SectionCard({
  label,
  container,
  leaves,
}: {
  label: ReactNode
  container: ReactNode
  leaves: { icon: ReactNode; label: ReactNode; meta?: ReactNode }[]
}) {
  return (
    <div className="rounded-md border border-sky-200 bg-white px-3 py-2.5 flex flex-col gap-2 flex-1 min-h-0 justify-center">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-[9px] tracking-[0.16em] uppercase text-sky-700">
          {label}
        </span>
        <span className="text-sky-300">/</span>
        <span className="font-mono text-[9px] text-sky-500/70">{container}</span>
      </div>
      <div className="flex flex-col gap-1 pl-1">
        {leaves.map((leaf, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="font-mono text-[9px] text-sky-300 leading-none select-none">
              {i === leaves.length - 1 ? "└─" : "├─"}
            </span>
            <span className="text-sky-500">{leaf.icon}</span>
            <span className="font-mono text-[10px] text-sky-700">{leaf.label}</span>
            {leaf.meta && (
              <span className="ml-auto text-[10px] text-muted-foreground italic truncate">
                {leaf.meta}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
