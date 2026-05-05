import { useState, useEffect, useCallback, useMemo } from "react"
import type { ComponentType, ReactNode, SVGProps } from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import {
  AlignLeft,
  BookCopy,
  Check,
  EyeOff,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  Sparkles,
  Square,
  Wand2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { TwoColumnStoryStrategyIcon } from "@/components/wizard/icons/TwoColumnStoryStrategyIcon"
import { Trans, useLingui } from "@lingui/react/macro"
import { msg } from "@lingui/core/macro"
import { i18n as linguiI18n } from "@lingui/core"
import type { MessageDescriptor } from "@lingui/core"
import { LandingPageShell } from "@/components/pipeline/components/LandingPageShell"
import { LandingPageWarning } from "@/components/pipeline/components/LandingPageWarning"
import { SettingExplainer } from "@/components/pipeline/components/SettingExplainer"
import { SettingsCard, SettingsField } from "@/components/pipeline/components/SettingsCard"
import { SegmentedControl } from "@/components/ui/segmented-control"
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useBookConfig, useUpdateBookConfig } from "@/hooks/use-book-config"
import { useActiveConfig } from "@/hooks/use-debug"
import { useStageStatus } from "@/hooks/use-stage-status"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import {
  listSelectableRenderStrategies,
  normalizeDefaultRenderStrategy,
} from "@/lib/render-strategy"

const STRATEGY_LABEL_MSGS: Record<string, MessageDescriptor> = {
  single_column: msg`Template One Column`,
  llm: msg`AI Generated`,
  "llm-overlay": msg`Dynamic Overlay`,
  fixed_layout: msg`Fixed Layout`,
  two_column_story: msg`Two Column Story`,
}

type LandingStrategyEntry = {
  id: string
  description: MessageDescriptor
  comingSoon?: boolean
}

const LANDING_STRATEGY_ITEMS: LandingStrategyEntry[] = [
  {
    id: "single_column",
    description: msg`One column for every section. Clean and predictable.`,
  },
  {
    id: "llm",
    description: msg`AI lays out images and text per section.`,
  },
  {
    id: "llm-overlay",
    description: msg`Title and image with text overlaid as a caption.`,
  },
  {
    id: "fixed_layout",
    description: msg`Strict grid template that repeats across pages.`,
    comingSoon: true,
  },
  {
    id: "two_column_story",
    description: msg`Side-by-side image and narrative.`,
  },
]

const AI_STRATEGIES = new Set(["llm", "llm-overlay", "fixed_layout"])

type StrategyIcon = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>

const STRATEGY_ICONS: Record<string, StrategyIcon> = {
  single_column: AlignLeft,
  llm: Sparkles,
  "llm-overlay": Layers,
  fixed_layout: Square,
  two_column_story: TwoColumnStoryStrategyIcon,
}

type EffortKey = "high" | "medium" | "relaxed"
type ActivityModeKey = "dynamic" | "match_source" | "template"

type ActivityModeOption = {
  id: ActivityModeKey
  Icon: ComponentType<SVGProps<SVGSVGElement> & { className?: string }>
  label: MessageDescriptor
  description: MessageDescriptor
}

const ACTIVITY_MODE_OPTIONS: readonly ActivityModeOption[] = [
  {
    id: "dynamic",
    Icon: Wand2,
    label: msg`Dynamic`,
    description: msg`AI generates fresh interactive activities from each section.`,
  },
  {
    id: "match_source",
    Icon: BookCopy,
    label: msg`Match Source`,
    description: msg`Mirrors the original book's activity layout as closely as possible.`,
  },
  {
    id: "template",
    Icon: LayoutTemplate,
    label: msg`Template`,
    description: msg`Renders activities from a fixed template for consistent styling.`,
  },
]

function strategyDisplayName(slug: string): string {
  const descriptor = STRATEGY_LABEL_MSGS[slug]
  if (descriptor) return linguiI18n._(descriptor)
  return slug
}

export function StoryboardLandingPage({ bookLabel }: { bookLabel: string }) {
  const { t } = useLingui()
  const { data: bookConfigData } = useBookConfig(bookLabel)
  const { data: activeConfigData } = useActiveConfig(bookLabel)
  const updateConfig = useUpdateBookConfig()
  const { apiKey, hasApiKey } = useApiKey()
  const { queueRun } = useBookRun()
  const status = useStageStatus("storyboard")
  const sectioningStatus = useStageStatus("sectioning")
  const sectioningReady = sectioningStatus.isCompleted

  const [defaultRenderStrategy, setDefaultRenderStrategy] = useState("")
  const [renderStrategyItems, setRenderStrategyItems] = useState<LandingStrategyEntry[]>([])
  const [effort, setEffort] = useState<EffortKey>("medium")
  const [activityMode, setActivityMode] = useState<ActivityModeKey>("dynamic")
  const [hoveredStrategy, setHoveredStrategy] = useState<string | null>(null)

  useEffect(() => {
    if (!activeConfigData) return
    const m = activeConfigData.merged as Record<string, unknown>
    const strategies = (
      m.render_strategies && typeof m.render_strategies === "object"
        ? m.render_strategies
        : {}
    ) as Record<string, { render_type?: string }>
    const normalized = normalizeDefaultRenderStrategy(
      typeof m.default_render_strategy === "string" ? m.default_render_strategy : "",
      strategies,
    )
    setDefaultRenderStrategy(normalized)
    const selectable = new Set(listSelectableRenderStrategies(strategies))
    setRenderStrategyItems(
      LANDING_STRATEGY_ITEMS.filter(
        (item) => item.comingSoon || selectable.has(item.id),
      ),
    )
    if (m.storyboard_effort === "high" || m.storyboard_effort === "medium" || m.storyboard_effort === "relaxed") {
      setEffort(m.storyboard_effort)
    }
    if (
      m.storyboard_activity_mode === "dynamic" ||
      m.storyboard_activity_mode === "match_source" ||
      m.storyboard_activity_mode === "template"
    ) {
      setActivityMode(m.storyboard_activity_mode)
    }
  }, [activeConfigData])

  const persist = useCallback(
    (patch: Record<string, unknown>) => {
      const base = bookConfigData?.config ?? {}
      updateConfig.mutate({ label: bookLabel, config: { ...base, ...patch } })
    },
    [bookConfigData, bookLabel, updateConfig],
  )

  const handleStrategyChange = (value: string) => {
    setDefaultRenderStrategy(value)
    setHoveredStrategy(null)
    persist({ default_render_strategy: value })
  }

  const previewStrategy = hoveredStrategy ?? defaultRenderStrategy ?? "llm"

  const handleEffortChange = (value: EffortKey) => {
    setEffort(value)
    persist({ storyboard_effort: value })
  }

  const handleActivityModeChange = (value: ActivityModeKey) => {
    setActivityMode(value)
    persist({ storyboard_activity_mode: value })
  }

  const handleRun = () => {
    if (!hasApiKey || !sectioningReady || status.isRunning) return
    queueRun({ fromStage: "storyboard", toStage: "storyboard", apiKey })
  }

  const isAi = AI_STRATEGIES.has(defaultRenderStrategy)

  const effortOptions = useMemo(
    () => [
      { value: "relaxed" as const, label: t`Relaxed`, icon: <SignalBars level={1} /> },
      { value: "medium" as const, label: t`Medium`, icon: <SignalBars level={2} /> },
      { value: "high" as const, label: t`High`, icon: <SignalBars level={3} /> },
    ],
    [t],
  )

  const activeActivityMode = ACTIVITY_MODE_OPTIONS.find(
    (option) => option.id === activityMode,
  )

  const disabledReason = !hasApiKey ? (
    <Trans>Add an API key in Book settings to run storyboard.</Trans>
  ) : !sectioningReady ? (
    <Trans>Run Sectioning first — storyboard needs typed sections to render.</Trans>
  ) : undefined

  return (
    <LandingPageShell
      bookLabel={bookLabel}
      stageSlug="storyboard"
      settingsTab="general"
      colorClass="bg-violet-600 hover:bg-violet-700"
      accentColor="#7c3aed"
      accentColorSoft="#ede9fe"
      isRunning={status.isRunning}
      isCompleted={status.isCompleted}
      hasError={status.hasError}
      canRun={true}
      extraDisabled={!hasApiKey || !sectioningReady}
      disabledReason={disabledReason}
      runLabel={<Trans>Run Storyboard</Trans>}
      rerunLabel={<Trans>Re-run</Trans>}
      previewLabel={t`Storyboard Preview`}
      onRun={handleRun}
      preview={<StoryboardPreview strategy={previewStrategy} />}
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
          <Trans>Storyboard</Trans>
        </h1>
        <p className="text-[14px] text-[#737373] leading-relaxed">
          <Trans>
            Render each typed section into an interactive HTML page. Pick a
            layout strategy that matches the book and let storyboard handle
            the rest.
          </Trans>
        </p>
      </div>

      <LandingPageWarning
        show={!sectioningReady}
        variant="prereq"
        title={<Trans>Run Sectioning first</Trans>}
        description={
          <Trans>
            Storyboard renders the typed sections produced by Sectioning.
            Finish Sectioning before running this stage.
          </Trans>
        }
      />

      <SettingsCard>
        <SettingsField
          label={<Trans>Render Strategy</Trans>}
          labelAction={<SettingExplainer visual={<RenderStrategyVisual />} />}
          hint={
            <Trans>
              Sets the default layout used when a section has no specific
              strategy assigned.
            </Trans>
          }
          htmlFor="storyboard-render-strategy"
        >
          <Select
            value={defaultRenderStrategy}
            onValueChange={handleStrategyChange}
            onOpenChange={(open) => {
              if (!open) setHoveredStrategy(null)
            }}
          >
            <SelectTrigger
              id="storyboard-render-strategy"
              className="h-10 w-full"
            >
              <SelectValue placeholder={t`Select strategy...`}>
                {defaultRenderStrategy ? (
                  <span className="flex items-center gap-2">
                    <StrategyIcon id={defaultRenderStrategy} />
                    {strategyDisplayName(defaultRenderStrategy)}
                  </span>
                ) : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent
              align="start"
              className="w-[var(--radix-select-trigger-width)] min-w-[320px]"
            >
              {renderStrategyItems.map((item) => {
                const Icon = STRATEGY_ICONS[item.id] ?? AlignLeft
                return (
                  <RichSelectItem
                    key={item.id}
                    value={item.id}
                    Icon={Icon}
                    label={strategyDisplayName(item.id)}
                    description={linguiI18n._(item.description)}
                    disabled={item.comingSoon}
                    onMouseEnter={() => {
                      if (!item.comingSoon) setHoveredStrategy(item.id)
                    }}
                    onFocus={() => {
                      if (!item.comingSoon) setHoveredStrategy(item.id)
                    }}
                    trailing={
                      item.comingSoon ? (
                        <span className="ml-auto inline-flex items-center gap-1 text-[9.5px] font-medium uppercase tracking-wider text-[#a3a3a3]">
                          <span
                            className="h-1 w-1 rounded-full bg-[#d4d4d4]"
                            aria-hidden
                          />
                          <Trans>Coming soon</Trans>
                        </span>
                      ) : undefined
                    }
                  />
                )
              })}
            </SelectContent>
          </Select>
        </SettingsField>

        <CollapsibleField shown={isAi}>
          <SettingsField
            label={<Trans>Effort</Trans>}
            hint={
              effort === "high" ? (
                <Trans>
                  Tries hard to match the original book design.
                </Trans>
              ) : effort === "medium" ? (
                <Trans>
                  Matches the original book design with some flexibility.
                </Trans>
              ) : (
                <Trans>
                  Takes liberties and produces something similar.
                </Trans>
              )
            }
          >
            <SegmentedControl
              options={effortOptions}
              value={effort}
              onValueChange={handleEffortChange}
            />
          </SettingsField>
        </CollapsibleField>
      </SettingsCard>

      <SettingsCard>
        <SettingsField
          label={<Trans>Activity Types</Trans>}
          hint={<Trans>How activities are rendered in each section.</Trans>}
          htmlFor="storyboard-activity-mode"
        >
          <Select
            value={activityMode}
            onValueChange={handleActivityModeChange}
          >
            <SelectTrigger
              id="storyboard-activity-mode"
              className="h-10 w-full"
            >
              <SelectValue placeholder={t`Select activity mode...`}>
                {activeActivityMode ? (
                  <span className="flex items-center gap-2">
                    <activeActivityMode.Icon
                      className="h-4 w-4 shrink-0 text-[#525252]"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    {linguiI18n._(activeActivityMode.label)}
                  </span>
                ) : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent
              align="start"
              className="w-[var(--radix-select-trigger-width)] min-w-[320px]"
            >
              {ACTIVITY_MODE_OPTIONS.map((option) => (
                <RichSelectItem
                  key={option.id}
                  value={option.id}
                  Icon={option.Icon}
                  label={linguiI18n._(option.label)}
                  description={linguiI18n._(option.description)}
                />
              ))}
            </SelectContent>
          </Select>
        </SettingsField>
      </SettingsCard>
    </LandingPageShell>
  )
}

function RichSelectItem({
  value,
  Icon,
  label,
  description,
  disabled,
  trailing,
  onMouseEnter,
  onFocus,
}: {
  value: string
  Icon: ComponentType<SVGProps<SVGSVGElement> & { className?: string }>
  label: ReactNode
  description: ReactNode
  disabled?: boolean
  trailing?: ReactNode
  onMouseEnter?: () => void
  onFocus?: () => void
}) {
  return (
    <SelectPrimitive.Item
      value={value}
      disabled={disabled}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
      className="relative flex w-full cursor-default select-none items-start rounded-sm py-2 pl-8 pr-3 outline-none focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
    >
      <span className="absolute left-2 top-2.5 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4 text-[var(--accent-color,#525252)]" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <Icon
        className="mt-0.5 mr-2.5 h-4 w-4 shrink-0 text-[#525252]"
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <SelectPrimitive.ItemText asChild>
            <span className="text-sm font-medium leading-tight text-[#0a0a0a]">
              {label}
            </span>
          </SelectPrimitive.ItemText>
          {trailing}
        </span>
        <span className="text-[12px] leading-snug text-[#737373]">
          {description}
        </span>
      </span>
    </SelectPrimitive.Item>
  )
}

function StrategyIcon({ id }: { id: string }) {
  const Icon = STRATEGY_ICONS[id]
  if (!Icon) return null
  return (
    <Icon
      className="h-4 w-4 shrink-0 text-[#525252]"
      strokeWidth={1.75}
      aria-hidden
    />
  )
}

function CollapsibleField({
  shown,
  children,
}: {
  shown: boolean
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out motion-reduce:transition-none",
        shown
          ? "grid-rows-[1fr] opacity-100"
          : "-my-2.5 grid-rows-[0fr] opacity-0",
      )}
      aria-hidden={!shown}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}

function RenderStrategyVisual() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <ThumbnailFrame label={<Trans>One Column</Trans>}>
        <SingleColumnThumb />
      </ThumbnailFrame>
      <ThumbnailFrame label={<Trans>AI Generated</Trans>}>
        <AiGeneratedThumb />
      </ThumbnailFrame>
      <ThumbnailFrame label={<Trans>Dynamic Overlay</Trans>}>
        <DynamicOverlayThumb />
      </ThumbnailFrame>
      <ThumbnailFrame label={<Trans>Two Column</Trans>}>
        <TwoColumnStoryThumb />
      </ThumbnailFrame>
    </div>
  )
}

function ThumbnailFrame({
  label,
  children,
}: {
  label: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="aspect-[3/4] w-full overflow-hidden rounded-sm border border-[#e5e5e5] bg-white p-2 shadow-sm">
        {children}
      </div>
      <span className="text-[10px] font-medium leading-none text-[#525252]">
        {label}
      </span>
    </div>
  )
}

function SingleColumnThumb() {
  return (
    <div className="flex h-full w-full flex-col gap-[3px]">
      <p className="text-[8px] font-semibold leading-tight text-neutral-800">
        <Trans>The Water Cycle</Trans>
      </p>
      <p className="text-[5.5px] uppercase tracking-wider leading-none text-neutral-400">
        <Trans>Chapter 3</Trans>
      </p>
      <div className="mt-[2px] flex h-7 w-full items-center justify-center overflow-hidden rounded-[1px] bg-gradient-to-br from-sky-200 via-sky-100 to-white">
        <div className="h-2 w-2 rounded-full bg-sky-300/70" />
      </div>
      <p className="mt-[1px] text-justify text-[5.5px] leading-[1.4] text-neutral-500">
        <Trans>
          Water moves continuously through evaporation, condensation, and
          precipitation. Most vapor returns to the oceans, while some falls
          on land as rain or snow before flowing back to the sea.
        </Trans>
      </p>
    </div>
  )
}

function AiGeneratedThumb() {
  return (
    <div className="flex h-full w-full flex-col gap-1">
      <p className="text-[8px] font-semibold leading-tight text-neutral-800">
        <Trans>Volcanic Origins</Trans>
      </p>
      <div className="grid grid-cols-[1fr_1.1fr] gap-1">
        <p className="text-[5.5px] leading-[1.4] text-neutral-500">
          <Trans>
            Beneath Earth's crust, molten rock builds pressure over
            millennia until it finds a path to the surface.
          </Trans>
        </p>
        <div className="relative h-9 overflow-hidden rounded-[1px] bg-gradient-to-br from-orange-300 via-rose-300 to-violet-300">
          <div className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-white/70" />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      </div>
      <div className="rounded-[1px] border-l-2 border-violet-400 bg-violet-50/80 px-1 py-[2px]">
        <p className="text-[6px] font-medium italic leading-[1.3] text-violet-700">
          <Trans>"A landscape forged by fire."</Trans>
        </p>
      </div>
      <p className="text-[5.5px] leading-[1.4] text-neutral-500">
        <Trans>Eruptions reshape entire regions in mere days.</Trans>
      </p>
    </div>
  )
}

function DynamicOverlayThumb() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[1px]">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-violet-400 to-fuchsia-300" />
      <div className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-white/60 blur-[1px]" />
      <div className="absolute left-2 top-3 h-[1px] w-[1px] rounded-full bg-white" />
      <div className="absolute right-3 top-2 h-[1px] w-[1px] rounded-full bg-white/80" />
      <div className="absolute left-3 top-5 h-[1px] w-[1px] rounded-full bg-white/70" />
      <div className="absolute inset-x-0 top-1/2 h-1/2 bg-gradient-to-b from-transparent to-black/25" />
      <div className="absolute inset-x-1.5 bottom-1.5 rounded-[2px] border border-white/40 bg-white/85 px-1.5 py-[5px] shadow-sm backdrop-blur-[1px]">
        <p className="text-[7px] font-semibold leading-tight text-neutral-800">
          <Trans>Among the Stars</Trans>
        </p>
        <p className="mt-[2px] text-[5.5px] leading-[1.35] text-neutral-500">
          <Trans>First images from the deep-field telescope.</Trans>
        </p>
      </div>
    </div>
  )
}

function TwoColumnStoryThumb() {
  return (
    <div className="grid h-full w-full grid-cols-[1.05fr_1fr] gap-1">
      <div className="relative overflow-hidden rounded-[1px] bg-gradient-to-b from-sky-200 via-rose-100 to-amber-100">
        <div className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-300/90" />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-emerald-400/60 via-emerald-200/40 to-transparent" />
        <div className="absolute bottom-1 left-1 h-1.5 w-1.5 rounded-full bg-violet-300/70" />
        <div className="absolute bottom-1.5 left-2.5 h-2 w-1 rounded-full bg-violet-400/60" />
        <div className="absolute bottom-[3px] right-2 h-1.5 w-[3px] rounded-full bg-emerald-600/60" />
      </div>
      <div className="flex flex-col gap-[3px] pt-[2px]">
        <p className="text-[7.5px] font-semibold leading-tight text-neutral-800">
          <Trans>The Lost Forest</Trans>
        </p>
        <p className="mt-[1px] text-[5.5px] leading-[1.4] text-neutral-500">
          <Trans>
            Lila wandered between the tall pines, her flashlight catching
            glimmers of gold among the leaves. The path narrowed, and the
            wind began to whisper her name.
          </Trans>
        </p>
      </div>
    </div>
  )
}

function SignalBars({ level }: { level: 1 | 2 | 3 }) {
  const heights = ["4px", "7px", "10px"] as const
  return (
    <span className="inline-flex items-end gap-[2px]" style={{ height: 10 }}>
      {heights.map((h, i) => (
        <span
          key={i}
          className="block w-[3px] rounded-[1px] bg-current"
          style={{ height: h, opacity: i < level ? 1 : 0.25 }}
        />
      ))}
    </span>
  )
}

type StoryboardPageLayout =
  | "ai-title-text-image"
  | "ai-title-image-text"
  | "ai-image-text"
  | "ai-text-image-mid"
  | "ai-text-only"
  | "single-column"
  | "image-overlay-bottom"
  | "image-overlay-top"
  | "image-overlay-corner"
  | "grid-template"
  | "two-column"

type StoryboardPageThumb = {
  n: number
  sections: number
  layout: StoryboardPageLayout
  titleWidth: number
  active?: boolean
  pruned?: boolean
}

const PAGE_BASES: Omit<StoryboardPageThumb, "layout">[] = [
  { n: 1, sections: 3, titleWidth: 55 },
  { n: 2, sections: 3, titleWidth: 70 },
  { n: 3, sections: 3, titleWidth: 75, active: true },
  { n: 4, sections: 3, titleWidth: 0 },
  { n: 5, sections: 3, titleWidth: 65 },
  { n: 6, sections: 2, titleWidth: 55, pruned: true },
  { n: 7, sections: 3, titleWidth: 0 },
  { n: 8, sections: 2, titleWidth: 55, pruned: true },
  { n: 9, sections: 4, titleWidth: 70 },
]

const AI_LAYOUT_CYCLE: StoryboardPageLayout[] = [
  "ai-title-text-image",
  "ai-title-image-text",
  "ai-text-only",
  "ai-image-text",
  "ai-text-image-mid",
  "ai-text-only",
  "ai-image-text",
  "ai-text-image-mid",
  "ai-title-text-image",
]

const OVERLAY_LAYOUT_CYCLE: StoryboardPageLayout[] = [
  "image-overlay-bottom",
  "image-overlay-top",
  "image-overlay-bottom",
  "image-overlay-corner",
  "image-overlay-bottom",
  "image-overlay-top",
  "image-overlay-corner",
  "image-overlay-top",
  "image-overlay-bottom",
]

function buildPages(strategy: string): StoryboardPageThumb[] {
  if (strategy === "llm" || !strategy) {
    return PAGE_BASES.map((p, i) => ({
      ...p,
      layout: AI_LAYOUT_CYCLE[i] ?? "ai-title-text-image",
    }))
  }
  if (strategy === "llm-overlay") {
    return PAGE_BASES.map((p, i) => ({
      ...p,
      layout: OVERLAY_LAYOUT_CYCLE[i] ?? "image-overlay-bottom",
    }))
  }
  const uniform: StoryboardPageLayout =
    strategy === "single_column"
      ? "single-column"
      : strategy === "fixed_layout"
        ? "grid-template"
        : strategy === "two_column_story"
          ? "two-column"
          : "ai-title-text-image"
  return PAGE_BASES.map((p) => ({ ...p, layout: uniform }))
}

function StoryboardPreview({ strategy }: { strategy: string }) {
  const pages = useMemo(() => buildPages(strategy), [strategy])
  const totalPages = pages.length
  const totalSections = pages.reduce((sum, page) => sum + page.sections, 0)

  return (
    <div className="relative flex flex-1 min-h-0 overflow-hidden bg-gradient-to-b from-violet-50/30 via-white to-white">
      <div className="flex flex-col w-full h-full px-5 py-4 gap-3 min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <LayoutGrid
              className="w-3.5 h-3.5 text-violet-600"
              strokeWidth={2}
            />
            <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-violet-700 leading-none">
              <Trans>Storyboard Overview</Trans>
            </span>
          </div>
          <span className="text-[10px] tabular-nums font-medium text-violet-500/80 leading-none">
            <Trans>
              {totalPages} pages · {totalSections} sections
            </Trans>
          </span>
        </div>

        {/* Page grid — fills available height, 3 rows of equal size */}
        <div className="grid grid-cols-3 grid-rows-3 gap-2 flex-1 min-h-0">
          {pages.map((page) => (
            <PageThumbnail key={page.n} page={page} />
          ))}
        </div>
      </div>
    </div>
  )
}

function PageThumbnail({ page }: { page: StoryboardPageThumb }) {
  const { n, sections, layout, titleWidth, active, pruned } = page

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-col gap-1 overflow-hidden rounded-md border bg-white p-2 transition-all duration-300",
        active &&
          "border-violet-600 shadow-[0_4px_14px_-4px_rgba(124,58,237,0.35)] ring-2 ring-violet-600/15",
        pruned &&
          "border-dashed border-neutral-300 bg-neutral-50/60 shadow-none",
        !active && !pruned && "border-violet-100 shadow-sm",
      )}
    >
      {/* Card header */}
      <div className="flex items-center justify-between leading-none shrink-0">
        <span
          className={cn(
            "text-[7.5px] font-semibold tracking-[0.12em] uppercase",
            pruned
              ? "text-neutral-400 line-through decoration-[0.5px]"
              : "text-neutral-500",
          )}
        >
          <Trans>Page {n}</Trans>
        </span>
        <span
          className={cn(
            "text-[7.5px] tabular-nums",
            pruned ? "text-neutral-400" : "text-violet-500/70",
          )}
        >
          <Trans>{sections} sections</Trans>
        </span>
      </div>

      {/* Body */}
      {pruned ? (
        <div className="flex flex-1 items-center justify-center">
          <EyeOff
            className="h-7 w-7 text-neutral-300"
            strokeWidth={1.5}
            aria-hidden
          />
        </div>
      ) : (
        <div
          key={layout}
          className="flex flex-1 min-h-0 flex-col gap-1 overflow-hidden motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-[0.97] motion-safe:duration-300 motion-safe:ease-out"
        >
          <PageBody
            layout={layout}
            titleWidth={titleWidth}
            active={active}
          />
        </div>
      )}
    </div>
  )
}

function PageBody({
  layout,
  titleWidth,
  active,
}: {
  layout: StoryboardPageLayout
  titleWidth: number
  active?: boolean
}) {
  const titleBar = titleWidth > 0 && (
    <TitleBar width={titleWidth} active={active} />
  )

  switch (layout) {
    case "ai-title-text-image":
      return (
        <>
          {titleBar}
          <Lines widths={[100, 92, 100, 70]} />
          <ImageBlock variant="short" className="mt-auto" />
        </>
      )
    case "ai-title-image-text":
      return (
        <>
          {titleBar}
          <ImageBlock variant="short" />
          <Lines widths={[100, 92, 78]} />
        </>
      )
    case "ai-image-text":
      return (
        <>
          <ImageBlock variant="tall" />
          <Lines widths={[100, 92, 100, 85, 70]} />
        </>
      )
    case "ai-text-image-mid":
      return (
        <>
          {titleBar}
          <Lines widths={[100, 88]} />
          <ImageBlock variant="short" />
          <Lines widths={[100, 65]} />
        </>
      )
    case "ai-text-only":
      return (
        <>
          {titleBar}
          <Lines widths={[100, 95, 100, 88, 100, 72]} />
        </>
      )
    case "single-column":
      return (
        <>
          <TitleBar width={titleWidth || 70} active={active} />
          <Lines widths={[100, 95, 90]} />
          <ImageBlock variant="short" />
          <Lines widths={[100, 92, 70]} />
        </>
      )
    case "image-overlay-bottom":
      return (
        <div className="relative flex-1 min-h-0 overflow-hidden rounded-md bg-gradient-to-br from-violet-200/80 via-violet-200/50 to-violet-300/40 ring-1 ring-violet-200/60">
          <ImageIcon
            className="absolute left-1/2 top-[28%] -translate-x-1/2 h-3.5 w-3.5 text-violet-400/70"
            strokeWidth={1.5}
            aria-hidden
          />
          <div className="absolute inset-x-1 bottom-1 flex flex-col gap-1 rounded-sm bg-white/95 px-1.5 py-1.5 shadow-sm">
            <TitleBar width={titleWidth || 70} active={active} />
            <Lines widths={[100, 65]} />
          </div>
        </div>
      )
    case "image-overlay-top":
      return (
        <div className="relative flex-1 min-h-0 overflow-hidden rounded-md bg-gradient-to-tr from-rose-200/70 via-violet-200/60 to-amber-100/60 ring-1 ring-violet-200/60">
          <ImageIcon
            className="absolute left-1/2 top-[58%] -translate-x-1/2 h-3.5 w-3.5 text-violet-400/70"
            strokeWidth={1.5}
            aria-hidden
          />
          <div className="absolute inset-x-1 top-1 flex flex-col gap-1 rounded-sm bg-white/95 px-1.5 py-1.5 shadow-sm">
            <TitleBar width={titleWidth || 80} active={active} />
            <Lines widths={[100, 60]} />
          </div>
        </div>
      )
    case "image-overlay-corner":
      return (
        <div className="relative flex-1 min-h-0 overflow-hidden rounded-md bg-gradient-to-bl from-indigo-200/70 via-violet-200/60 to-sky-200/60 ring-1 ring-violet-200/60">
          <ImageIcon
            className="absolute left-[35%] top-[40%] -translate-x-1/2 h-3.5 w-3.5 text-violet-400/70"
            strokeWidth={1.5}
            aria-hidden
          />
          <div className="absolute bottom-1 right-1 flex w-[58%] flex-col gap-0.5 rounded-sm bg-white/95 px-1.5 py-1 shadow-sm">
            <TitleBar width={titleWidth || 75} active={active} />
            <Lines widths={[100, 70]} />
          </div>
        </div>
      )
    case "grid-template":
      return (
        <>
          <TitleBar width={titleWidth || 75} active={active} />
          <div className="grid shrink-0 grid-cols-2 gap-1">
            <ImageBlock variant="short" />
            <ImageBlock variant="short" />
          </div>
          <Lines widths={[100, 92, 88, 70]} />
        </>
      )
    case "two-column":
      return (
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.1fr] gap-1.5">
          <ImageBlock variant="full" />
          <div className="flex min-w-0 flex-col gap-1">
            <TitleBar width={titleWidth || 80} active={active} />
            <Lines widths={[100, 92, 78, 95, 60]} />
          </div>
        </div>
      )
  }
}

function TitleBar({
  width,
  active,
}: {
  width: number
  active?: boolean
}) {
  return (
    <div
      className={cn(
        "h-[5px] shrink-0 rounded-full",
        active ? "bg-violet-600" : "bg-violet-500",
      )}
      style={{ width: `${width}%` }}
    />
  )
}

function Lines({ widths }: { widths: number[] }) {
  return (
    <div className="flex shrink-0 flex-col gap-1">
      {widths.map((w, i) => (
        <div
          key={i}
          className="h-[3px] rounded-full bg-violet-200/70"
          style={{ width: `${w}%` }}
        />
      ))}
    </div>
  )
}

function ImageBlock({
  variant,
  className,
}: {
  variant: "short" | "tall" | "full"
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md bg-violet-100/70 ring-1 ring-violet-200/60",
        variant === "tall" && "h-12 shrink-0",
        variant === "short" && "h-9 shrink-0",
        variant === "full" && "h-full min-h-0",
        className,
      )}
    >
      <ImageIcon
        className="h-3 w-3 text-violet-400"
        strokeWidth={1.5}
        aria-hidden
      />
    </div>
  )
}
