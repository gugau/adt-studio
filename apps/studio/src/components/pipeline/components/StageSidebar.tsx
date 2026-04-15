import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import { Link, useMatchRoute, useSearch } from "@tanstack/react-router"
import { Trans } from "@lingui/react/macro"
import { HelpCircle, Home, Loader2 } from "lucide-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { cn } from "@/lib/utils"
import { useLingui } from "@lingui/react"
import { msg } from "@lingui/core/macro"
import type { MessageDescriptor } from "@lingui/core"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"
import { useBookRun } from "@/hooks/use-book-run"
import { useAccessibilityAssessment } from "@/hooks/use-debug"
import { useBookTasks } from "@/hooks/use-book-tasks"
import { StepProgressRing } from "./StepProgressRing"
import { usePages, usePageImage } from "@/hooks/use-pages"
import {
  STAGES,
  hasStagePages,
} from "../stage-config"
import type { TaskInfoResponse } from "@/api/client"
import { getStageLabelI18n, getStepLabelI18n } from "../pipeline-i18n"
import { ALL_STEP_NAMES, PAGE_PROGRESS_STEPS } from "@adt/types"
import { SETTINGS_STAGE_SLUGS } from "../settings-routing"

const SETTINGS_TAB_MESSAGE: Record<string, MessageDescriptor> = {
  general: msg`General`,
  "text-types": msg`Text Types`,
  "metadata-prompt": msg`Metadata Prompt`,
  prompt: msg`Extraction Prompt`,
  "meaningfulness-prompt": msg`Meaningfulness Prompt`,
  "cropping-prompt": msg`Cropping Prompt`,
  "segmentation-prompt": msg`Segmentation Prompt`,
  "book-summary-prompt": msg`Summary Prompt`,
  "sectioning-prompt": msg`Sectioning Mode`,
  "rendering-prompt": msg`AI Rendering`,
  "rendering-template": msg`Template Rendering`,
  "activity-prompts": msg`Activity Rendering`,
  "image-generation": msg`Image Generation`,
  "quiz-prompt": msg`Quiz Prompt`,
  "glossary-prompt": msg`Glossary Prompt`,
  "caption-prompt": msg`Caption Prompt`,
  languages: msg`Languages`,
  "translation-prompt": msg`Translation Prompt`,
  speech: msg`Speech`,
  "speech-prompts": msg`Speech Prompts`,
  voices: msg`Voices`,
  "toc-prompt": msg`Generation Prompt`,
}

const TASK_KIND_LABELS: Record<string, MessageDescriptor> = {
  "package-adt": msg`Packaging`,
  "image-generate": msg`Image Generation`,
  "re-render": msg`Re-render`,
  "ai-edit": msg`AI Edit`,
  "prepare-export": msg`Export`,
  "transcribe-timestamps": msg`Timestamps`,
}

function getSettingsTabs(
  slug: string,
  i18n: ReturnType<typeof useLingui>["i18n"],
): { key: string; label: string }[] | undefined {
  const tabs: Record<string, { key: string; label: string }[]> = {
    extract: [
      { key: "general", label: i18n._(SETTINGS_TAB_MESSAGE.general) },
      { key: "text-types", label: i18n._(SETTINGS_TAB_MESSAGE["text-types"]) },
      { key: "metadata-prompt", label: i18n._(SETTINGS_TAB_MESSAGE["metadata-prompt"]) },
      { key: "prompt", label: i18n._(SETTINGS_TAB_MESSAGE.prompt) },
      { key: "meaningfulness-prompt", label: i18n._(SETTINGS_TAB_MESSAGE["meaningfulness-prompt"]) },
      { key: "cropping-prompt", label: i18n._(SETTINGS_TAB_MESSAGE["cropping-prompt"]) },
      { key: "segmentation-prompt", label: i18n._(SETTINGS_TAB_MESSAGE["segmentation-prompt"]) },
      { key: "book-summary-prompt", label: i18n._(SETTINGS_TAB_MESSAGE["book-summary-prompt"]) },
    ],
    storyboard: [
      { key: "general", label: i18n._(SETTINGS_TAB_MESSAGE.general) },
      { key: "sectioning-prompt", label: i18n._(SETTINGS_TAB_MESSAGE["sectioning-prompt"]) },
      { key: "rendering-prompt", label: i18n._(SETTINGS_TAB_MESSAGE["rendering-prompt"]) },
      { key: "rendering-template", label: i18n._(SETTINGS_TAB_MESSAGE["rendering-template"]) },
      { key: "activity-prompts", label: i18n._(SETTINGS_TAB_MESSAGE["activity-prompts"]) },
      { key: "image-generation", label: i18n._(SETTINGS_TAB_MESSAGE["image-generation"]) },
    ],
    quizzes: [
      { key: "general", label: i18n._(SETTINGS_TAB_MESSAGE.general) },
      { key: "prompt", label: i18n._(SETTINGS_TAB_MESSAGE["quiz-prompt"]) },
    ],
    glossary: [
      { key: "general", label: i18n._(SETTINGS_TAB_MESSAGE["glossary-prompt"]) },
    ],
    toc: [
      { key: "general", label: i18n._(SETTINGS_TAB_MESSAGE["toc-prompt"]) },
    ],
    captions: [
      { key: "general", label: i18n._(SETTINGS_TAB_MESSAGE["caption-prompt"]) },
    ],
    translate: [
      { key: "general", label: i18n._(SETTINGS_TAB_MESSAGE.languages) },
      { key: "prompt", label: i18n._(SETTINGS_TAB_MESSAGE["translation-prompt"]) },
    ],
    speech: [
      { key: "general", label: i18n._(SETTINGS_TAB_MESSAGE.speech) },
      { key: "speech-prompts", label: i18n._(SETTINGS_TAB_MESSAGE["speech-prompts"]) },
      { key: "voices", label: i18n._(SETTINGS_TAB_MESSAGE.voices) },
    ],
    validation: [
      { key: "general", label: i18n._(msg`Accessibility`) },
      { key: "reviewer-checklist", label: i18n._(msg`Reviewer Checklist`) },
    ],
  }
  return tabs[slug]
}

/** Stage groups for visual separators in the icon rail */
const STAGE_GROUPS = [
  ["extract", "storyboard", "quizzes", "captions", "glossary", "toc"],
  ["translate", "speech", "sign-language"],
  ["validation", "preview", "export"],
]

function getGroupIndex(slug: string): number {
  return STAGE_GROUPS.findIndex((g) => g.includes(slug))
}

export function StageSidebar({
  bookLabel,
  activeStep,
  selectedPageId,
  onSelectPage,
  sectionIndex,
  onSelectSection,
  topBarSlot,
  content,
  onOpenHelp,
}: {
  bookLabel: string
  activeStep: string
  selectedPageId?: string
  onSelectPage?: (pageId: string | null) => void
  sectionIndex?: number
  onSelectSection?: (index: number) => void
  topBarSlot?: React.ReactNode
  content?: React.ReactNode
  onOpenHelp?: () => void
}) {
  const { i18n } = useLingui()
  const matchRoute = useMatchRoute()
  const search = useSearch({ strict: false }) as { tab?: string }
  const { stageState } = useBookRun()
  const { data: accessibilityAssessment } = useAccessibilityAssessment(bookLabel)
  const currentState = stageState(activeStep)
  const effectivePagesOpen =
    hasStagePages(activeStep) &&
    (currentState === "done" || currentState === "running" || currentState === "error")

  const isSettings = !!matchRoute({
    to: "/books/$label/$step/settings",
    params: { label: bookLabel, step: activeStep },
  })
  const activeTab = search.tab ?? "general"

  const storyboardDone = stageState("storyboard") === "done"
  const validationCompleted = Boolean(accessibilityAssessment?.assessment)

  const hasSettingsTabs = !!(SETTINGS_STAGE_SLUGS as readonly string[]).includes(activeStep)
  const settingsTabs = getSettingsTabs(activeStep, i18n)

  // Determine secondary panel mode
  const showSecondaryPanel = effectivePagesOpen || hasSettingsTabs
  const [panelTab, setPanelTab] = useState<"pages" | "settings">(
    isSettings ? "settings" : "pages",
  )

  // Sync panelTab when navigating to/from settings route
  useEffect(() => {
    if (isSettings) {
      setPanelTab("settings")
    }
  }, [isSettings])

  // Reset panel tab when switching stages
  const prevStepRef = useRef(activeStep)
  useEffect(() => {
    if (prevStepRef.current !== activeStep) {
      setPanelTab("pages")
      prevStepRef.current = activeStep
    }
  }, [activeStep])

  const visibleStages = STAGES.filter((s) => s.slug !== "book")
  const stageItems = visibleStages.map((step, index) => {
    const isActive = step.slug === activeStep
    const Icon = step.icon
    const state = step.slug === "validation" && validationCompleted ? "done" : stageState(step.slug)
    const stageCompleted = state === "done"
    const ringState = state

    const iconFilled =
      step.slug === "sign-language" || step.slug === "validation" || step.slug === "preview" || step.slug === "export"
        ? storyboardDone
        : stageCompleted

    const stepLabel = getStageLabelI18n(step.slug)
    const prevGroup = index > 0 ? getGroupIndex(visibleStages[index - 1].slug) : -1
    const curGroup = getGroupIndex(step.slug)
    const showSeparator = index > 0 && prevGroup !== curGroup

    return (
      <div key={step.slug}>
        {showSeparator && (
          <div className="mx-2.5 my-1.5 h-px bg-border" />
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to={selectedPageId && hasStagePages(step.slug) ? "/books/$label/$step/$pageId" : "/books/$label/$step"}
              params={selectedPageId && hasStagePages(step.slug)
                ? { label: bookLabel, step: step.slug, pageId: selectedPageId }
                : { label: bookLabel, step: step.slug }}
              className={cn(
                "flex items-center justify-center w-full py-2 transition-colors",
                isActive
                  ? cn(step.color, "text-white")
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <div className="relative shrink-0">
                <div
                  className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-full transition-colors",
                    iconFilled
                      ? isActive
                        ? "bg-white/20 text-white"
                        : cn(step.color, "text-white")
                      : "bg-muted text-muted-foreground ring-1 ring-border"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <StepProgressRing size={28} state={ringState} colorClass={isActive ? "bg-white" : step.color} />
              </div>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={6}>
            {stepLabel}
          </TooltipContent>
        </Tooltip>
      </div>
    )
  })

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Top row — home + top bar (step header spans full width) */}
      <div className="flex shrink-0 h-10">
        <div className="w-12 shrink-0 flex items-center justify-center bg-gray-700 border-r">
          <Link
            to="/"
            className="flex h-full w-full items-center justify-center transition-colors hover:bg-gray-800"
            title={i18n._(msg`Back to books`)}
          >
            <Home className="h-4 w-4 text-white" />
          </Link>
        </div>
        {topBarSlot}
      </div>

      {/* Content row — icon rail + panel + main content */}
      <div className="flex flex-1 min-h-0">
        {/* Icon rail */}
        <nav className="w-12 shrink-0 flex flex-col border-r">
          <div className="flex flex-col pb-2 gap-0.5 flex-1 overflow-y-auto overflow-x-hidden">
            {stageItems}
          </div>
          <TaskIndicator bookLabel={bookLabel} compact />
          {onOpenHelp && (
            <div className="border-t">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onOpenHelp}
                    className="flex items-center justify-center w-full py-2 text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={6}>
                  <Trans>Pipeline overview</Trans>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </nav>

        {/* Secondary panel */}
        {showSecondaryPanel && (
          <div className="w-[180px] shrink-0 min-w-0 flex flex-col overflow-hidden border-r">
            {effectivePagesOpen && hasSettingsTabs && (
              <div className="shrink-0 h-[52px] flex items-center px-2 border-b">
                <div className="flex flex-1 rounded-lg bg-muted p-0.5">
                  <button
                    type="button"
                    onClick={() => setPanelTab("pages")}
                    className={cn(
                      "flex-1 py-1 text-xs font-medium rounded-md transition-all",
                      panelTab === "pages"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Trans>Pages</Trans>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanelTab("settings")}
                    className={cn(
                      "flex-1 py-1 text-xs font-medium rounded-md transition-all",
                      panelTab === "settings"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Trans>Settings</Trans>
                  </button>
                </div>
              </div>
            )}
            {panelTab === "pages" && effectivePagesOpen ? (
              <PageIndex
                bookLabel={bookLabel}
                activeStep={activeStep}
                selectedPageId={selectedPageId}
                onSelectPage={onSelectPage}
                sectionIndex={sectionIndex}
                onSelectSection={onSelectSection}
                stageRunning={currentState === "running"}
              />
            ) : (panelTab === "settings" || !effectivePagesOpen) && settingsTabs ? (
              <SettingsNavPanel
                bookLabel={bookLabel}
                activeStep={activeStep}
                settingsTabs={settingsTabs}
                activeTab={activeTab}
                isSettings={isSettings}
              />
            ) : null}
          </div>
        )}

        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {content}
        </div>
      </div>
    </div>
  )
}

/* ---------- SettingsNavPanel ---------- */

function SettingsNavPanel({
  bookLabel,
  activeStep,
  settingsTabs,
  activeTab,
  isSettings,
}: {
  bookLabel: string
  activeStep: string
  settingsTabs: { key: string; label: string }[]
  activeTab: string
  isSettings: boolean
}) {
  const stepConfig = STAGES.find((s) => s.slug === activeStep)

  return (
    <div className="flex-1 overflow-y-auto pt-1">
      {settingsTabs.map((tab) => (
        <Link
          key={tab.key}
          to="/books/$label/$step/settings"
          params={{ label: bookLabel, step: activeStep }}
          search={{ tab: tab.key }}
          className={cn(
            "block px-4 py-2.5 text-sm transition-colors",
            isSettings && activeTab === tab.key
              ? cn(stepConfig?.textColor, "font-medium", stepConfig?.bgLight)
              : "text-foreground hover:bg-muted"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}

/* ---------- TaskIndicator ---------- */

function TaskIndicator({ bookLabel, compact }: { bookLabel: string; compact?: boolean }) {
  const { i18n } = useLingui()
  const { runningTasks, runningCount } = useBookTasks(bookLabel)
  const { stepState, stepProgress } = useBookRun()

  const stageProgressRows: { step: string; label: string; page: number; totalPages: number }[] = []
  for (const step of PAGE_PROGRESS_STEPS) {
    if (stepState(step) === "running") {
      const prog = stepProgress(step)
      if (prog?.totalPages) {
        stageProgressRows.push({
          step,
          label: getStepLabelI18n(step),
          page: prog.page ?? 0,
          totalPages: prog.totalPages,
        })
      }
    }
  }

  const activeSteps: { step: string; label: string }[] = []
  for (const step of ALL_STEP_NAMES) {
    if (!PAGE_PROGRESS_STEPS.has(step) && stepState(step) === "running") {
      activeSteps.push({ step, label: getStepLabelI18n(step) })
    }
  }

  const totalCount = runningCount + stageProgressRows.length + activeSteps.length

  if (totalCount === 0) return null

  if (compact) {
    return (
      <div className="border-t group/tasks">
        <div className="hidden group-hover/tasks:block absolute bottom-full left-full ml-1 mb-1 w-52 bg-popover border rounded-md shadow-lg p-2 z-50">
          {stageProgressRows.map((row) => (
            <div key={row.step} className="flex items-center gap-2 px-1 py-1">
              <Loader2 className="w-3 h-3 animate-spin text-violet-500 shrink-0" />
              <p className="flex-1 min-w-0 text-xs font-medium truncate">{row.label}</p>
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                {row.page}/{row.totalPages}
              </span>
            </div>
          ))}
          {activeSteps.map((row) => (
            <div key={row.step} className="flex items-center gap-2 px-1 py-1">
              <Loader2 className="w-3 h-3 animate-spin text-violet-500 shrink-0" />
              <p className="flex-1 min-w-0 text-xs font-medium truncate">{row.label}</p>
            </div>
          ))}
          {runningTasks.map((task) => (
            <TaskRow key={task.taskId} task={task} />
          ))}
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-center py-2">
              <div className="relative shrink-0 flex items-center justify-center w-7 h-7">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-violet-600 text-white">
                  <span className="text-xs font-bold leading-none">{totalCount}</span>
                </div>
                <StepProgressRing size={28} state="running" colorClass="bg-violet-600" />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={6}>
            {totalCount === 1 ? i18n._(msg`Task Running`) : i18n._(msg`Tasks Running`)}
          </TooltipContent>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className="border-t group/tasks">
      <div className="hidden group-hover/tasks:block px-2 pt-1.5 pb-0.5 flex-col gap-0.5">
        {stageProgressRows.map((row) => (
          <div key={row.step} className="flex items-center gap-2 px-1 py-1">
            <Loader2 className="w-3 h-3 animate-spin text-violet-500 shrink-0" />
            <p className="flex-1 min-w-0 text-xs font-medium truncate">
              {row.label}
            </p>
            <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
              {row.page}/{row.totalPages}
            </span>
          </div>
        ))}
        {activeSteps.map((row) => (
          <div key={row.step} className="flex items-center gap-2 px-1 py-1">
            <Loader2 className="w-3 h-3 animate-spin text-violet-500 shrink-0" />
            <p className="flex-1 min-w-0 text-xs font-medium truncate">
              {row.label}
            </p>
          </div>
        ))}
        {runningTasks.map((task) => (
          <TaskRow key={task.taskId} task={task} />
        ))}
      </div>

      <div className="flex items-center gap-2.5 px-2.5 py-2 overflow-hidden">
        <div className="relative shrink-0 flex items-center justify-center w-7 h-7">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-violet-600 text-white">
            <span className="text-xs font-bold leading-none">{totalCount}</span>
          </div>
          <StepProgressRing size={28} state="running" colorClass="bg-violet-600" />
        </div>
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          {totalCount === 1 ? i18n._(msg`Task Running`) : i18n._(msg`Tasks Running`)}
        </span>
      </div>
    </div>
  )
}

function TaskRow({ task }: { task: TaskInfoResponse }) {
  const { i18n } = useLingui()
  const kindLabelDescriptor = TASK_KIND_LABELS[task.kind]
  const kindLabel = kindLabelDescriptor ? i18n._(kindLabelDescriptor) : task.kind
  const [, tick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [])
  const elapsed = task.startedAt ? Math.round((Date.now() - task.startedAt) / 1000) : 0
  const elapsedStr =
    elapsed < 60
      ? i18n._(msg`${elapsed}s`)
      : i18n._(msg`${Math.floor(elapsed / 60)}m ${elapsed % 60}s`)

  const content = (
    <>
      <Loader2 className="w-3 h-3 animate-spin text-violet-500 shrink-0" />
      <p className="flex-1 min-w-0 text-xs font-medium truncate">
        {kindLabel ? i18n._(kindLabel) : task.kind}
      </p>
      {task.progressMessage && (
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{task.progressMessage}</span>
      )}
      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{elapsedStr}</span>
    </>
  )

  if (task.url) {
    return (
      <Link to={task.url} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted/50 transition-colors">
        {content}
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-2 px-1 py-1">
      {content}
    </div>
  )
}

/* ---------- PageIndex ---------- */

function PageIndex({
  bookLabel,
  activeStep,
  selectedPageId,
  onSelectPage,
  sectionIndex,
  onSelectSection,
  stageRunning,
}: {
  bookLabel: string
  activeStep: string
  selectedPageId?: string
  onSelectPage?: (pageId: string) => void
  sectionIndex?: number
  onSelectSection?: (index: number) => void
  stageRunning?: boolean
}) {
  const { data: pages } = usePages(bookLabel)
  const activeStepDef = STAGES.find((s) => s.slug === activeStep)
  const parentRef = useRef<HTMLDivElement>(null)

  const selectedIndex = useMemo(
    () => pages?.findIndex((p) => p.pageId === selectedPageId) ?? -1,
    [pages, selectedPageId],
  )

  const virtualizer = useVirtualizer({
    count: pages?.length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 5,
  })

  useEffect(() => {
    if (selectedIndex >= 0) {
      virtualizer.scrollToIndex(selectedIndex, { align: "auto" })
    }
  }, [selectedIndex, virtualizer])

  if (!pages?.length) {
    return (
      <div className="flex-1 overflow-y-auto px-3 py-4 text-xs text-muted-foreground text-center">
        <Trans>No pages extracted yet</Trans>
      </div>
    )
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto">
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const page = pages[virtualRow.index]
          const isActive = page.pageId === selectedPageId
          return (
            <div
              key={page.pageId}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <PageRow
                bookLabel={bookLabel}
                page={page}
                isActive={isActive}
                activeStepDef={activeStepDef}
                onSelect={() => onSelectPage?.(page.pageId)}
                sectionIndex={isActive ? sectionIndex : undefined}
                onSelectSection={isActive ? onSelectSection : undefined}
                stageRunning={stageRunning}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- PageRow ---------- */

function PageRow({
  bookLabel,
  page,
  isActive,
  activeStepDef,
  onSelect,
  sectionIndex,
  onSelectSection,
  stageRunning,
}: {
  bookLabel: string
  page: { pageId: string; textPreview: string; pageNumber: number; sectionCount: number; hasRendering?: boolean; prunedSections?: number[] }
  isActive: boolean
  activeStepDef?: (typeof STAGES)[number]
  onSelect: () => void
  sectionIndex?: number
  onSelectSection?: (index: number) => void
  stageRunning?: boolean
}) {
  const { i18n } = useLingui()
  const { data, isLoading } = usePageImage(bookLabel, page.pageId)
  const [showPreview, setShowPreview] = useState(false)
  const [previewPos, setPreviewPos] = useState({ top: 0, left: 0 })
  const rowRef = useRef<HTMLButtonElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  const handleEnter = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (!rowRef.current) return
      const rect = rowRef.current.getBoundingClientRect()
      const previewH = 400
      const previewW = 300
      const gap = 20
      const margin = 8
      const top = Math.max(margin, Math.min(rect.top, window.innerHeight - previewH - margin))
      const rightEdge = window.innerWidth - margin
      const rightSideLeft = rect.right + gap
      const leftSideLeft = rect.left - previewW - gap
      const unclampedLeft =
        rightSideLeft + previewW <= rightEdge
          ? rightSideLeft
          : leftSideLeft
      const left = Math.max(margin, Math.min(unclampedLeft, rightEdge - previewW))
      setPreviewPos({ top, left })
      setShowPreview(true)
    }, 600)
  }, [])

  const handleLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setShowPreview(false)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const imgSrc = data?.imageBase64 ? `data:image/png;base64,${data.imageBase64}` : null

  const pageProcessing = stageRunning && !page.hasRendering

  const showSections = isActive && page.sectionCount > 1 && onSelectSection

  return (
    <div>
      <button
        ref={rowRef}
        type="button"
        onClick={onSelect}
        className={cn(
          "flex items-start gap-2 px-2 py-1.5 text-left transition-colors w-full",
          isActive
            ? cn(activeStepDef?.bgLight ?? "bg-violet-50", activeStepDef?.textColor ?? "text-violet-600", "font-medium")
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
      >
        <div className="relative shrink-0 w-16 h-12">
          {isLoading || !imgSrc ? (
            <div className="w-full h-full bg-muted rounded ring-1 ring-border" />
          ) : (
            <img
              src={imgSrc}
              alt=""
              onMouseEnter={handleEnter}
              onMouseLeave={handleLeave}
              className="w-full h-full rounded object-cover object-center ring-1 ring-border"
            />
          )}
          {pageProcessing && (
            <div className="absolute inset-0 flex items-center justify-center rounded bg-black/30">
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-0.5 min-w-0 flex-1 pt-0.5">
          <span className="text-[11px] leading-snug line-clamp-2">
            {page.textPreview || i18n._(msg`Untitled`)}
          </span>
          <span className="text-[9px] font-mono opacity-50 leading-none">
            {`pg ${String(page.pageNumber)}`}
            {page.sectionCount > 1 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[14px] h-[12px] px-0.5 rounded bg-black/10 text-[8px] font-semibold not-italic leading-none">
                {page.sectionCount}
              </span>
            )}
          </span>
        </div>
        {showPreview && imgSrc && createPortal(
          <div
            className="fixed z-50 pointer-events-none animate-in fade-in duration-150"
            style={{ top: previewPos.top, left: previewPos.left }}
          >
            <img
              src={imgSrc}
              alt=""
              className="h-[400px] w-auto rounded-lg shadow-xl ring-1 ring-border"
            />
          </div>,
          document.body
        )}
      </button>
      {showSections && (
        <div className={cn(
          "flex flex-wrap gap-0.5 px-2 pb-1.5 -mt-0.5",
          activeStepDef?.bgLight ?? "bg-violet-50"
        )}>
          {Array.from({ length: page.sectionCount }, (_, i) => {
            const pruned = page.prunedSections?.includes(i)
            return (
              <button
                key={i}
                type="button"
                onClick={() => onSelectSection(i)}
                className={cn(
                  "flex items-center justify-center min-w-[18px] h-[18px] px-0.5 rounded text-[9px] font-medium transition-colors",
                  i === (sectionIndex ?? 0)
                    ? cn(activeStepDef?.color ?? "bg-violet-600", pruned ? "text-white/50 line-through" : "text-white")
                    : pruned ? "bg-black/5 text-black/20 line-through hover:bg-black/10 hover:text-black/40" : "bg-black/5 text-black/40 hover:bg-black/10 hover:text-black/60"
                )}
                title={
                  pruned
                    ? i18n._(msg`Section ${i + 1} (pruned)`)
                    : i18n._(msg`Section ${i + 1}`)
                }
              >
                {i + 1}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
