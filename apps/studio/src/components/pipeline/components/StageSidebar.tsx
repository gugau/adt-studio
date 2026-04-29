import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import { Link, useMatchRoute, useSearch } from "@tanstack/react-router"
import { Trans } from "@lingui/react/macro"
import {
  HelpCircle,
  Loader2,
  Puzzle,
  RotateCcw,
  Settings,
} from "lucide-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { cn } from "@/lib/utils"
import { useLingui } from "@lingui/react"
import { msg } from "@lingui/core/macro"
import type { MessageDescriptor } from "@lingui/core"
import { Button } from "@/components/ui/button"
import { useBookRun } from "@/hooks/use-book-run"
import { useAccessibilityAssessment } from "@/hooks/use-debug"
import { useBookTasks } from "@/hooks/use-book-tasks"
import { useStageMissingCounts } from "@/hooks/use-stage-missing-counts"
import { usePackageAdtStatus } from "@/hooks/use-books"
import { useSignLanguageVideos } from "@/hooks/use-sign-language-videos"
import { StepProgressRing } from "./StepProgressRing"
import { usePages, usePageImage } from "@/hooks/use-pages"
import {
  STAGES,
  hasStagePages,
  toCamelLabel,
} from "../stage-config"
import { useSettingsDialog } from "@/routes/__root"
import type { TaskInfoResponse } from "@/api/client"
import { getStageLabelI18n, getStepLabelI18n } from "../pipeline-i18n"
import { ALL_STEP_NAMES, PAGE_PROGRESS_STEPS } from "@adt/types"
import { getSectionThumbnailUrl, type PageQuizItem, type PageSummaryItem } from "@/api/client"

/** Build the flat ordered list of pages + quizzes (interleaved by afterPageId).
 *  Used by both the Pages and Sections lists when quizzes should be shown. */
type PageListEntry =
  | { kind: "page"; page: PageSummaryItem }
  | { kind: "quiz"; quiz: PageQuizItem }

function interleavePagesAndQuizzes(
  pages: PageSummaryItem[],
  includeQuizzes: boolean,
): PageListEntry[] {
  const out: PageListEntry[] = []
  for (const page of pages) {
    out.push({ kind: "page", page })
    if (includeQuizzes) {
      for (const quiz of page.quizzesAfter) {
        out.push({ kind: "quiz", quiz })
      }
    }
  }
  return out
}

const SETTINGS_TAB_MESSAGE: Record<string, MessageDescriptor> = {
  general: msg`General`,
  "container-types": msg`Container Types`,
  "text-types": msg`Text Types`,
  "metadata-prompt": msg`Metadata Prompt`,
  prompt: msg`Extraction Prompt`,
  "meaningfulness-prompt": msg`Meaningfulness Prompt`,
  "cropping-prompt": msg`Cropping Prompt`,
  "segmentation-prompt": msg`Segmentation Prompt`,
  "book-summary-prompt": msg`Summary Prompt`,
  "sectioning-prompt": msg`Sectioning Prompt`,
  "refinement-prompt": msg`Refinement Prompt`,
  "rendering-prompt": msg`AI Rendering`,
  "rendering-template": msg`Template Rendering`,
  "activity-prompts": msg`Activity Rendering`,
  "image-generation": msg`Image Generation`,
  "quiz-prompt": msg`Quiz Prompt`,
  "glossary-prompt": msg`Glossary Prompt`,
  "caption-prompt": msg`Caption Prompt`,
  languages: msg`Languages`,
  "translation-prompt": msg`Translation Prompt`,
  "image-translation": msg`Image Translation`,
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
      { key: "metadata-prompt", label: i18n._(SETTINGS_TAB_MESSAGE["metadata-prompt"]) },
      { key: "meaningfulness-prompt", label: i18n._(SETTINGS_TAB_MESSAGE["meaningfulness-prompt"]) },
      { key: "cropping-prompt", label: i18n._(SETTINGS_TAB_MESSAGE["cropping-prompt"]) },
      { key: "segmentation-prompt", label: i18n._(SETTINGS_TAB_MESSAGE["segmentation-prompt"]) },
    ],
    sectioning: [
      { key: "general", label: i18n._(SETTINGS_TAB_MESSAGE.general) },
      { key: "sectioning-prompt", label: i18n._(SETTINGS_TAB_MESSAGE["sectioning-prompt"]) },
      { key: "refinement-prompt", label: i18n._(SETTINGS_TAB_MESSAGE["refinement-prompt"]) },
      { key: "container-types", label: i18n._(SETTINGS_TAB_MESSAGE["container-types"]) },
      { key: "text-types", label: i18n._(SETTINGS_TAB_MESSAGE["text-types"]) },
    ],
    storyboard: [
      { key: "general", label: i18n._(SETTINGS_TAB_MESSAGE.general) },
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
      { key: "image-translation", label: i18n._(SETTINGS_TAB_MESSAGE["image-translation"]) },
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

export function StageSidebar({
  bookLabel,
  activeStep,
  selectedPageId,
  onSelectPage,
  sectionIndex,
  onSelectSection,
}: {
  bookLabel: string
  activeStep: string
  selectedPageId?: string
  onSelectPage?: (pageId: string | null) => void
  sectionIndex?: number
  onSelectSection?: (index: number) => void
}) {
  const { i18n } = useLingui()
  const matchRoute = useMatchRoute()
  const search = useSearch({ strict: false }) as { tab?: string }
  const { stageState } = useBookRun()
  const { data: accessibilityAssessment } = useAccessibilityAssessment(bookLabel)
  const { data: signLanguageData } = useSignLanguageVideos(bookLabel)
  const { data: packageStatus } = usePackageAdtStatus(bookLabel)
  const { tasks } = useBookTasks(bookLabel)
  const { openSettings } = useSettingsDialog()
  const stageMissing = useStageMissingCounts(bookLabel)
  const translateNeedsRerun = stageMissing.translate > 0
  const speechNeedsRerun = stageMissing.speech > 0

  const currentState = stageState(activeStep)
  const effectivePagesOpen =
    hasStagePages(activeStep) &&
    (currentState === "done" || currentState === "running" || currentState === "error")

  const isSettings = !!matchRoute({
    to: "/books/$label/$step/settings",
    params: { label: bookLabel, step: activeStep },
  })
  const activeTab = search.tab ?? "general"

  // The rail collapses (icon-only, hover to expand) only when pages are showing
  // and we're not in settings. Otherwise it's always expanded with labels visible.
  const railCollapsed = effectivePagesOpen && !isSettings
  // When the rail is collapsed, labels/buttons are always in the DOM but clipped
  // by overflow-hidden on the inner panel. This avoids display toggling which
  // would flash before the width transition completes.
  const x = {
    gap:       "gap-2.5",
    showLabel: "inline",
    showFlex:  "flex",
    flex1:     "flex-1",
  }

  const validationCompleted = Boolean(accessibilityAssessment?.assessment)
  const signLanguageCompleted = signLanguageData?.videos?.some((v) => v.sectionId !== null) ?? false
  const previewCompleted = packageStatus?.hasAdt ?? false
  const exportCompleted = tasks.some((t) => t.kind === "prepare-export" && t.status === "completed")

  const completionOverrides: Record<string, boolean> = {
    "sign-language": signLanguageCompleted,
    validation: validationCompleted,
    preview: previewCompleted,
    export: exportCompleted,
  }

  const stageItems = STAGES.map((step, index) => {
    const isActive = step.slug === activeStep
    const Icon = step.icon
    const settingsTabs = getSettingsTabs(step.slug, i18n)
    const showSubTabs = isActive && isSettings && !!settingsTabs
    const state = completionOverrides[step.slug] ? "done" : stageState(step.slug)
    const stageCompleted = state === "done"

    // Translate/Speech revert to needs-rerun look when their downstream output
    // has gaps (e.g. after a glossary addition). The in-view banner gives the
    // user the actionable details and Re-run button.
    const stageNeedsRerun =
      (step.slug === "translate" && translateNeedsRerun) ||
      (step.slug === "speech" && speechNeedsRerun)
    const ringState = stageNeedsRerun ? "idle" : state

    // "book" is always filled; all other stages fill when their own completion signal is met.
    const iconFilled = step.slug === "book" ? true : stageCompleted

    const stepLabel = step.slug === "book" ? toCamelLabel(bookLabel) : getStageLabelI18n(step.slug)

    return (
      <div key={step.slug} className="relative">
        {/* Connector line */}
        {index < STAGES.length - 1 && (
          <div className="absolute left-[24px] top-[36px] bottom-[-10px] w-0.5 bg-border z-10" />
        )}

        {/* Step row */}
        <div
          className={cn(
            "group/row flex items-center py-2 text-sm transition-colors overflow-hidden",
            x.gap,
            isActive
              ? cn(step.color, "text-white font-medium rounded-l-[14px] ml-0.5 pl-2 pr-2.5")
              : "text-muted-foreground hover:text-foreground hover:bg-muted px-2.5"
          )}
        >
          <Link
            to={selectedPageId && hasStagePages(step.slug) ? "/books/$label/$step/$pageId" : "/books/$label/$step"}
            params={selectedPageId && hasStagePages(step.slug)
              ? { label: bookLabel, step: step.slug, pageId: selectedPageId }
              : { label: bookLabel, step: step.slug }}
            className={cn("flex items-center gap-2.5 min-w-7", x.flex1)}
            title={stepLabel}
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
            <span className={cn("truncate hidden", x.showLabel)}>
              {stepLabel}
            </span>
          </Link>

          {settingsTabs ? (
            <Link
              to="/books/$label/$step/settings"
              params={{ label: bookLabel, step: step.slug }}
              search={{ tab: settingsTabs[0].key }}
              title={`${stepLabel} ${i18n._(msg`Settings`)}`}
              className={cn(
                "shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors ",
                isActive
                  ? "text-white/60 hover:text-white hover:bg-white/20"
                  : "opacity-0 group-hover/row:opacity-100 text-muted-foreground/50 group-hover/row:bg-muted hover:text-foreground hover:bg-muted-foreground/20"
              )}
            >
              <Settings className="w-3.5 h-3.5" />
            </Link>
          ) : step.slug === "book" ? (
            <button
              type="button"
              onClick={openSettings}
              title={i18n._(msg`API Key Settings`)}
              className={cn(
                "shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors cursor-pointer",
                isActive
                  ? "text-white/60 hover:text-white hover:bg-white/20"
                  : "opacity-0 group-hover/row:opacity-100 text-muted-foreground/50 group-hover/row:bg-muted hover:text-foreground hover:bg-muted-foreground/20"
              )}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          ) : step.slug === "preview" ? (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("adt:repackage"))}
              title={i18n._(msg`Re-package ADT`)}
              className={cn(
                "shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors cursor-pointer",
                isActive
                  ? "text-white/60 hover:text-white hover:bg-white/20"
                  : "opacity-0 group-hover/row:opacity-100 text-muted-foreground/50 group-hover/row:bg-muted hover:text-foreground hover:bg-muted-foreground/20"
              )}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>

        {/* Settings sub-tabs */}
        {showSubTabs && (
          <div className={cn("ml-[42px] mr-2 mt-0.5 mb-1 flex-col gap-0.5 hidden", x.showFlex)}>
            {settingsTabs!.map((tab) => (
              <Button
                key={tab.key}
                variant="ghost"
                size="sm"
                asChild
                className={cn(
                  "h-auto justify-start rounded text-xs px-2 py-1 whitespace-nowrap",
                  activeTab === tab.key
                    ? cn(step.textColor, "font-medium", step.bgLight)
                    : "font-normal text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Link
                  to="/books/$label/$step/settings"
                  params={{ label: bookLabel, step: step.slug }}
                  search={{ tab: tab.key }}
                >
                  {tab.label}
                </Link>
              </Button>
            ))}
          </div>
        )}
      </div>
    )
  })

  return (
    <nav className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-1 min-h-0">
        {/* Stage rail */}
        <div className={cn(
          "shrink-0 relative group/rail",
          railCollapsed ? "w-12" : "flex-1"
        )}>
          <div className={cn(
            "absolute inset-y-0 left-0 flex flex-col bg-background overflow-hidden",
            railCollapsed
              ? "w-12 group-hover/rail:w-[220px] z-20 transition-[width] duration-150 delay-150 group-hover/rail:delay-100 group-hover/rail:shadow-lg"
              : "inset-x-0"
          )}>
            <div className="flex flex-col pt-1.5 pb-2 gap-0.5 flex-1 overflow-y-auto overflow-x-hidden">
              {stageItems}
            </div>
            {/* Task indicator */}
            <TaskIndicator bookLabel={bookLabel} />
            {/* Right edge — follows the expanding rail */}
            <div className="absolute inset-y-0 right-0 w-px border-r" />
          </div>
        </div>

        {/* Pages panel — only when pages are open and not in settings */}
        {effectivePagesOpen && !isSettings && (
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-l">
            <PageIndex
              bookLabel={bookLabel}
              activeStep={activeStep}
              selectedPageId={selectedPageId}
              onSelectPage={onSelectPage}
              sectionIndex={sectionIndex}
              onSelectSection={onSelectSection}
              stageRunning={currentState === "running"}
            />
          </div>
        )}
      </div>

    </nav>
  )
}

/* ---------- TaskIndicator ---------- */

function TaskIndicator({ bookLabel }: { bookLabel: string }) {
  const { i18n } = useLingui()
  const { runningTasks, runningCount } = useBookTasks(bookLabel)
  const { stepState, stepProgress } = useBookRun()

  // Build step-progress rows for running pipeline steps that have page-level progress
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

  // Non-page-progress steps that are currently running (e.g. metadata, book-summary)
  const activeSteps: { step: string; label: string }[] = []
  for (const step of ALL_STEP_NAMES) {
    if (!PAGE_PROGRESS_STEPS.has(step) && stepState(step) === "running") {
      activeSteps.push({ step, label: getStepLabelI18n(step) })
    }
  }

  const totalCount = runningCount + stageProgressRows.length + activeSteps.length

  if (totalCount === 0) return null

  return (
    <div className="border-t group/tasks">
      {/* Task list — visible on hover */}
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

      {/* Indicator row */}
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

type IndexTab = "pages" | "sections"

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
  const { i18n } = useLingui()
  const { data: pages } = usePages(bookLabel)
  const activeStepDef = STAGES.find((s) => s.slug === activeStep)
  const [tab, setTab] = useState<IndexTab>("pages")

  const tabsHeader = (
    <div className="shrink-0 flex border-b bg-background">
      {(["pages", "sections"] as const).map((value) => {
        const isActive = tab === value
        const label = value === "pages" ? i18n._(msg`Pages`) : i18n._(msg`Sections`)
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "flex-1 px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider transition-colors",
              isActive
                ? cn(activeStepDef?.textColor ?? "text-violet-600", "border-b-2", activeStepDef?.borderDark ?? "border-violet-600")
                : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )

  if (!pages?.length) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        {tabsHeader}
        <div className="flex-1 overflow-y-auto px-3 py-4 text-xs text-muted-foreground text-center">
          <Trans>No pages extracted yet</Trans>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {tabsHeader}
      {tab === "pages" ? (
        <PagesList
          bookLabel={bookLabel}
          activeStep={activeStep}
          pages={pages}
          activeStepDef={activeStepDef}
          selectedPageId={selectedPageId}
          onSelectPage={onSelectPage}
          sectionIndex={sectionIndex}
          onSelectSection={onSelectSection}
          stageRunning={stageRunning}
        />
      ) : (
        <SectionsList
          bookLabel={bookLabel}
          activeStep={activeStep}
          pages={pages}
          activeStepDef={activeStepDef}
          selectedPageId={selectedPageId}
          sectionIndex={sectionIndex}
          onSelectPage={onSelectPage}
          onSelectSection={onSelectSection}
          stageRunning={stageRunning}
        />
      )}
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
  /** Whether the parent stage is currently running */
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

  // Page is still being processed during a storyboard run
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

/* ---------- QuizRow ---------- */

function QuizRow({
  bookLabel,
  quiz,
  isActive,
  onSelect,
}: {
  bookLabel: string
  quiz: PageQuizItem
  isActive: boolean
  onSelect: () => void
}) {
  const { i18n } = useLingui()
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const imgSrc = quiz.hasRendering
    ? getSectionThumbnailUrl(bookLabel, quiz.quizId, quiz.renderingVersion)
    : null

  useEffect(() => {
    setImgLoaded(false)
    setImgFailed(false)
  }, [imgSrc])

  const showImg = imgSrc !== null && !imgFailed

  return (
    <button
      type="button"
      onClick={onSelect}
      title={i18n._(msg`Quiz ${quiz.quizIndex + 1}: ${quiz.question}`)}
      className={cn(
        "flex items-start gap-2 px-2 py-1.5 text-left transition-colors w-full",
        isActive
          ? "bg-orange-50 text-orange-600 font-medium"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      )}
    >
      <div className="relative shrink-0 w-16 h-12 rounded ring-1 ring-border overflow-hidden bg-white">
        {showImg && imgSrc ? (
          <img
            src={imgSrc}
            alt=""
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgFailed(true)}
            className={cn(
              "absolute inset-0 w-full h-full object-cover object-top transition-opacity",
              imgLoaded ? "opacity-100" : "opacity-0"
            )}
          />
        ) : null}
        {(!showImg || !imgLoaded) && (
          <div className="absolute inset-0 flex items-center justify-center bg-orange-50">
            <HelpCircle className="w-4 h-4 text-orange-500" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 min-w-0 flex-1 pt-0.5">
        <span className="text-[11px] leading-snug line-clamp-2">
          {quiz.question || i18n._(msg`Quiz`)}
        </span>
        <span className="text-[9px] font-mono opacity-50 leading-none">
          <Trans>quiz {quiz.quizIndex + 1}</Trans>
        </span>
      </div>
    </button>
  )
}

/* ---------- PagesList ---------- */

function PagesList({
  bookLabel,
  activeStep,
  pages,
  activeStepDef,
  selectedPageId,
  onSelectPage,
  sectionIndex,
  onSelectSection,
  stageRunning,
}: {
  bookLabel: string
  activeStep: string
  pages: PageSummaryItem[]
  activeStepDef?: (typeof STAGES)[number]
  selectedPageId?: string
  onSelectPage?: (pageId: string) => void
  sectionIndex?: number
  onSelectSection?: (index: number) => void
  stageRunning?: boolean
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  // Quizzes are only navigable from the storyboard stage (where StoryboardView
  // knows how to render them). Other stages render the Pages list as-is.
  const showQuizzes = activeStep === "storyboard"
  const entries = useMemo(
    () => interleavePagesAndQuizzes(pages, showQuizzes),
    [pages, showQuizzes],
  )
  const selectedIndex = useMemo(
    () => entries.findIndex((e) =>
      e.kind === "page"
        ? e.page.pageId === selectedPageId
        : e.quiz.quizId === selectedPageId,
    ),
    [entries, selectedPageId],
  )
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 5,
  })
  useEffect(() => {
    if (selectedIndex >= 0) {
      virtualizer.scrollToIndex(selectedIndex, { align: "auto" })
    }
  }, [selectedIndex, virtualizer])

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
          const entry = entries[virtualRow.index]
          const key = entry.kind === "page" ? entry.page.pageId : entry.quiz.quizId
          const isActive = key === selectedPageId
          return (
            <div
              key={key}
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
              {entry.kind === "page" ? (
                <PageRow
                  bookLabel={bookLabel}
                  page={entry.page}
                  isActive={isActive}
                  activeStepDef={activeStepDef}
                  onSelect={() => onSelectPage?.(entry.page.pageId)}
                  sectionIndex={isActive ? sectionIndex : undefined}
                  onSelectSection={isActive ? onSelectSection : undefined}
                  stageRunning={stageRunning}
                />
              ) : (
                <QuizRow
                  bookLabel={bookLabel}
                  quiz={entry.quiz}
                  isActive={isActive}
                  onSelect={() => onSelectPage?.(entry.quiz.quizId)}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- SectionsList ---------- */

interface SectionEntry {
  pageId: string
  pageNumber: number
  sectionId: string
  sectionIndex: number
  sectionType: string
  pageSectionCount: number
  hasRendering: boolean
  renderingVersion: number | null
}

type SectionListEntry =
  | { kind: "section"; section: SectionEntry }
  | { kind: "quiz"; quiz: PageQuizItem }

function SectionsList({
  bookLabel,
  activeStep,
  pages,
  activeStepDef,
  selectedPageId,
  sectionIndex,
  onSelectPage,
  onSelectSection,
  stageRunning,
}: {
  bookLabel: string
  activeStep: string
  pages: PageSummaryItem[]
  activeStepDef?: (typeof STAGES)[number]
  selectedPageId?: string
  sectionIndex?: number
  onSelectPage?: (pageId: string) => void
  onSelectSection?: (index: number) => void
  stageRunning?: boolean
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const showQuizzes = activeStep === "storyboard"

  const entries = useMemo<SectionListEntry[]>(() => {
    const list: SectionListEntry[] = []
    for (const page of pages) {
      for (const s of page.sections) {
        list.push({
          kind: "section",
          section: {
            pageId: page.pageId,
            pageNumber: page.pageNumber,
            sectionId: s.sectionId,
            sectionIndex: s.sectionIndex,
            sectionType: s.sectionType,
            pageSectionCount: page.sectionCount,
            hasRendering: page.hasRendering,
            renderingVersion: page.renderingVersion,
          },
        })
      }
      if (showQuizzes) {
        for (const quiz of page.quizzesAfter) {
          list.push({ kind: "quiz", quiz })
        }
      }
    }
    return list
  }, [pages, showQuizzes])

  const selectedEntryIndex = useMemo(
    () =>
      entries.findIndex((e) =>
        e.kind === "section"
          ? e.section.pageId === selectedPageId &&
            e.section.sectionIndex === (sectionIndex ?? 0)
          : e.quiz.quizId === selectedPageId,
      ),
    [entries, selectedPageId, sectionIndex],
  )

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 2,
  })

  useEffect(() => {
    if (selectedEntryIndex >= 0) {
      virtualizer.scrollToIndex(selectedEntryIndex, { align: "auto" })
    }
  }, [selectedEntryIndex, virtualizer])

  if (entries.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-3 py-4 text-xs text-muted-foreground text-center">
        <Trans>No sections yet</Trans>
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
          const entry = entries[virtualRow.index]
          if (entry.kind === "quiz") {
            const isActive = entry.quiz.quizId === selectedPageId
            return (
              <div
                key={`quiz-${entry.quiz.quizId}`}
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
                <SectionQuizRow
                  bookLabel={bookLabel}
                  quiz={entry.quiz}
                  index={virtualRow.index}
                  isActive={isActive}
                  onSelect={() => onSelectPage?.(entry.quiz.quizId)}
                />
              </div>
            )
          }
          const section = entry.section
          const isActive =
            section.pageId === selectedPageId &&
            section.sectionIndex === (sectionIndex ?? 0)
          return (
            <div
              key={`${section.pageId}-${section.sectionIndex}`}
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
              <SectionRow
                bookLabel={bookLabel}
                entry={section}
                index={virtualRow.index}
                isActive={isActive}
                activeStepDef={activeStepDef}
                onSelectPage={onSelectPage}
                onSelectSection={onSelectSection}
                stageRunning={stageRunning}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- SectionRow ---------- */

function SectionRow({
  bookLabel,
  entry,
  index,
  isActive,
  activeStepDef,
  onSelectPage,
  onSelectSection,
  stageRunning,
}: {
  bookLabel: string
  entry: SectionEntry
  index: number
  isActive: boolean
  activeStepDef?: (typeof STAGES)[number]
  onSelectPage?: (pageId: string) => void
  onSelectSection?: (index: number) => void
  stageRunning?: boolean
}) {
  const { i18n } = useLingui()
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const isActivity = entry.sectionType.startsWith("activity")
  const imgSrc = entry.hasRendering
    ? getSectionThumbnailUrl(bookLabel, entry.sectionId, entry.renderingVersion)
    : null

  // Reset load/error state when the underlying source changes (re-render bumps version).
  useEffect(() => {
    setImgLoaded(false)
    setImgFailed(false)
  }, [imgSrc])

  const handleClick = () => {
    onSelectPage?.(entry.pageId)
    onSelectSection?.(entry.sectionIndex)
  }

  const sectionProcessing = stageRunning && !entry.hasRendering
  const showImg = imgSrc !== null && !imgFailed
  const showFallback = !showImg || !imgLoaded

  return (
    <button
      type="button"
      onClick={handleClick}
      title={
        isActivity
          ? i18n._(msg`Page ${entry.pageNumber} · ${entry.sectionType}`)
          : i18n._(msg`Page ${entry.pageNumber} · Section ${entry.sectionIndex + 1}`)
      }
      className={cn(
        "flex items-start gap-2 w-full px-2 py-1.5 text-left transition-colors",
        isActive
          ? cn(activeStepDef?.bgLight ?? "bg-violet-50", activeStepDef?.textColor ?? "text-violet-600", "font-medium")
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      )}
    >
      <span className="shrink-0 mt-1 w-4 text-[10px] font-mono tabular-nums opacity-60 text-right leading-none">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div
          className={cn(
            "relative w-full overflow-hidden rounded bg-white border-2",
            isActive
              ? activeStepDef?.borderDark ?? "border-violet-600"
              : "border-transparent ring-1 ring-border"
          )}
          style={{ aspectRatio: "1280 / 800" }}
        >
          {showImg && imgSrc && (
            <img
              src={imgSrc}
              alt=""
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgFailed(true)}
              className={cn(
                "absolute inset-0 w-full h-full object-cover object-top transition-opacity",
                imgLoaded ? "opacity-100" : "opacity-0"
              )}
            />
          )}
          {showFallback && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              {sectionProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : isActivity ? (
                <Puzzle className="w-5 h-5 text-violet-500" />
              ) : showImg ? null : (
                <span className="text-[10px] text-muted-foreground">
                  <Trans>No preview</Trans>
                </span>
              )}
            </div>
          )}
          {sectionProcessing && showImg && imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            </div>
          )}
          {isActivity && showImg && imgLoaded && !sectionProcessing && (
            <div className="absolute top-1 left-1 flex items-center justify-center w-4 h-4 rounded-full bg-violet-600 text-white shadow ring-1 ring-white/40">
              <Puzzle className="w-2.5 h-2.5" />
            </div>
          )}
        </div>
        <span className="flex items-center gap-1 text-[9px] font-mono opacity-60 leading-none">
          <Trans>pg {entry.pageNumber}</Trans>
          {entry.pageSectionCount > 1 && (
            <span
              className={cn(
                "inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded text-[9px] font-medium not-italic leading-none",
                isActive
                  ? cn(activeStepDef?.color ?? "bg-violet-600", "text-white")
                  : "bg-black/10 text-black/50"
              )}
            >
              {entry.sectionIndex + 1}
            </span>
          )}
        </span>
      </div>
    </button>
  )
}

/* ---------- SectionQuizRow ---------- */

function SectionQuizRow({
  bookLabel,
  quiz,
  index,
  isActive,
  onSelect,
}: {
  bookLabel: string
  quiz: PageQuizItem
  index: number
  isActive: boolean
  onSelect: () => void
}) {
  const { i18n } = useLingui()
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const imgSrc = quiz.hasRendering
    ? getSectionThumbnailUrl(bookLabel, quiz.quizId, quiz.renderingVersion)
    : null

  useEffect(() => {
    setImgLoaded(false)
    setImgFailed(false)
  }, [imgSrc])

  const showImg = imgSrc !== null && !imgFailed

  return (
    <button
      type="button"
      onClick={onSelect}
      title={i18n._(msg`Quiz ${quiz.quizIndex + 1}: ${quiz.question}`)}
      className={cn(
        "flex items-start gap-2 w-full px-2 py-1.5 text-left transition-colors",
        isActive
          ? "bg-orange-50 text-orange-600 font-medium"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      )}
    >
      <span className="shrink-0 mt-1 w-4 text-[10px] font-mono tabular-nums opacity-60 text-right leading-none">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div
          className={cn(
            "relative w-full overflow-hidden rounded bg-white border-2",
            isActive ? "border-orange-600" : "border-transparent ring-1 ring-border"
          )}
          style={{ aspectRatio: "1280 / 800" }}
        >
          {showImg && imgSrc && (
            <img
              src={imgSrc}
              alt=""
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgFailed(true)}
              className={cn(
                "absolute inset-0 w-full h-full object-cover object-top transition-opacity",
                imgLoaded ? "opacity-100" : "opacity-0"
              )}
            />
          )}
          {(!showImg || !imgLoaded) && (
            <div className="absolute inset-0 flex items-center justify-center bg-orange-50">
              <HelpCircle className="w-5 h-5 text-orange-500" />
            </div>
          )}
          <div className="absolute top-1 left-1 flex items-center justify-center w-4 h-4 rounded-full bg-orange-600 text-white shadow ring-1 ring-white/40">
            <HelpCircle className="w-2.5 h-2.5" />
          </div>
        </div>
        <span className="text-[9px] font-mono opacity-60 leading-none">
          <Trans>quiz {quiz.quizIndex + 1}</Trans>
        </span>
      </div>
    </button>
  )
}
