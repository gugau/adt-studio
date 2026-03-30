import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import { Link, useMatchRoute, useNavigate, useSearch } from "@tanstack/react-router"
import { Trans } from "@lingui/react/macro"
import {
  Loader2,
  RotateCcw,
  Settings,
} from "lucide-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { cn } from "@/lib/utils"
import { useLingui } from "@lingui/react"
import { msg } from "@lingui/core/macro"
import type { MessageDescriptor } from "@lingui/core"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectSeparator,
} from "@/components/ui/select"
import { useBookRun } from "@/hooks/use-book-run"
import { useBookTasks } from "@/hooks/use-book-tasks"
import { StepProgressRing } from "./StepProgressRing"
import { usePages, usePageImage } from "@/hooks/use-pages"
import {
  STAGES,
  hasStagePages,
  toCamelLabel,
} from "./stage-config"
import { useSettingsDialog } from "@/routes/__root"
import type { TaskInfoResponse } from "@/api/client"
import { getStageLabelI18n } from "./pipeline-i18n"

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
    "text-and-speech": [
      { key: "general", label: i18n._(SETTINGS_TAB_MESSAGE.languages) },
      { key: "prompt", label: i18n._(SETTINGS_TAB_MESSAGE["translation-prompt"]) },
      { key: "speech", label: i18n._(SETTINGS_TAB_MESSAGE.speech) },
      { key: "speech-prompts", label: i18n._(SETTINGS_TAB_MESSAGE["speech-prompts"]) },
      { key: "voices", label: i18n._(SETTINGS_TAB_MESSAGE.voices) },
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
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { tab?: string }
  const { stageState } = useBookRun()
  const { openSettings } = useSettingsDialog()

  const isSettings = !!matchRoute({
    to: "/books/$label/$step/settings",
    params: { label: bookLabel, step: activeStep },
  })
  const settingsTabs = getSettingsTabs(activeStep, i18n)
  const canOpenPages = hasStagePages(activeStep) && stageState(activeStep) === "done" && !isSettings

  const [filter, setFilter] = useState("")
  const [viewMode, setViewMode] = useState<"pages" | "sections">("pages")

  const stageLabel = activeStep === "book" ? toCamelLabel(bookLabel) : getStageLabelI18n(activeStep)

  const options = useMemo(() => {
    const items: Array<{ value: string; label: string; kind: "mode" | "tab" }> = []
    if (canOpenPages) {
      items.push({ value: "mode:pages", label: i18n._(msg`Pages`), kind: "mode" })
      items.push({ value: "mode:sections", label: i18n._(msg`Sections`), kind: "mode" })
    }
    if (settingsTabs?.length) {
      for (const tab of settingsTabs) {
        items.push({ value: `settings:${tab.key}`, label: tab.label, kind: "tab" })
      }
    }
    return items
  }, [canOpenPages, settingsTabs, i18n])

  const optionValue = useMemo(() => {
    if (canOpenPages) return `mode:${viewMode}`
    if (isSettings) return `settings:${search.tab ?? "general"}`
    // Fallback to first settings tab (if any) so select shows something reasonable
    return settingsTabs?.[0]?.key ? `settings:${settingsTabs[0].key}` : ""
  }, [canOpenPages, viewMode, isSettings, search.tab, settingsTabs])

  return (
    <nav className="flex flex-col flex-1 min-h-0">
      {/* Section options select */}
      <div className="shrink-0 p-3 border-b">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{stageLabel}</p>
            <p className="text-[10px] text-muted-foreground truncate">
              <Trans>Options</Trans>
            </p>
          </div>

          {activeStep === "book" ? (
            <button
              type="button"
              onClick={openSettings}
              title={i18n._(msg`API Key Settings`)}
              className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-md border border-input bg-background hover:bg-muted transition-colors cursor-pointer"
            >
              <Settings className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {options.length > 0 && (
          <div className="mt-2">
            <Select
              value={optionValue}
              onValueChange={(v) => {
                if (v.startsWith("mode:")) {
                  const mode = v === "mode:sections" ? "sections" : "pages"
                  setViewMode(mode)
                  // Ensure we are on the main step route (not settings)
                  navigate({ to: "/books/$label/$step", params: { label: bookLabel, step: activeStep } })
                  return
                }
                if (v.startsWith("settings:")) {
                  const tab = v.slice("settings:".length)
                  navigate({
                    to: "/books/$label/$step/settings",
                    params: { label: bookLabel, step: activeStep },
                    search: { tab },
                  })
                }
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder={i18n._(msg`Select...`)} />
              </SelectTrigger>
              <SelectContent>
                {canOpenPages && (
                  <>
                    <SelectItem value="mode:pages">{i18n._(msg`Pages`)}</SelectItem>
                    <SelectItem value="mode:sections">{i18n._(msg`Sections`)}</SelectItem>
                    {settingsTabs?.length ? <SelectSeparator /> : null}
                  </>
                )}
                {settingsTabs?.map((tab) => (
                  <SelectItem key={tab.key} value={`settings:${tab.key}`}>
                    {tab.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {canOpenPages && (
          <div className="mt-2">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={i18n._(msg`Search...`)}
              className="h-9 text-sm"
            />
          </div>
        )}
      </div>

      {/* Inside-section navigation */}
      <div className="flex-1 min-h-0 flex flex-col">
        {canOpenPages ? (
          <PageIndex
            bookLabel={bookLabel}
            activeStep={activeStep}
            selectedPageId={selectedPageId}
            onSelectPage={onSelectPage}
            sectionIndex={sectionIndex}
            onSelectSection={viewMode === "sections" ? onSelectSection : undefined}
            filter={filter}
          />
        ) : (
          <div className="flex-1 min-h-0 p-4 text-xs text-muted-foreground">
            {hasStagePages(activeStep) ? (
              <Trans>Run this section to unlock page navigation.</Trans>
            ) : (
              <Trans>Select a page-based section to navigate pages.</Trans>
            )}
          </div>
        )}
      </div>

      <TaskIndicator bookLabel={bookLabel} />
    </nav>
  )
}

/* ---------- TaskIndicator ---------- */

function TaskIndicator({ bookLabel }: { bookLabel: string }) {
  const { i18n } = useLingui()
  const { runningTasks, runningCount } = useBookTasks(bookLabel)

  if (runningCount === 0) return null

  return (
    <div className="border-t group/tasks">
      {/* Task list — visible on hover */}
      <div className="hidden group-hover/tasks:block px-2 pt-1.5 pb-0.5 flex-col gap-0.5">
        {runningTasks.map((task) => (
          <TaskRow key={task.taskId} task={task} />
        ))}
      </div>

      {/* Indicator row */}
      <div className="flex items-center gap-2.5 px-2.5 py-2 overflow-hidden">
        <div className="relative shrink-0 flex items-center justify-center w-7 h-7">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-violet-600 text-white">
            <span className="text-xs font-bold leading-none">{runningCount}</span>
          </div>
          <StepProgressRing size={28} state="running" colorClass="bg-violet-600" />
        </div>
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          {i18n._(msg`Background Tasks`)}
        </span>
      </div>
    </div>
  )
}

function TaskRow({ task }: { task: TaskInfoResponse }) {
  const { i18n } = useLingui()
  const kindLabel = TASK_KIND_LABELS[task.kind]
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
  filter,
}: {
  bookLabel: string
  activeStep: string
  selectedPageId?: string
  onSelectPage?: (pageId: string) => void
  sectionIndex?: number
  onSelectSection?: (index: number) => void
  filter: string
}) {
  const { data: pages } = usePages(bookLabel)
  const activeStepDef = STAGES.find((s) => s.slug === activeStep)
  const parentRef = useRef<HTMLDivElement>(null)

  const filteredPages = useMemo(() => {
    const f = filter.trim().toLowerCase()
    if (!f) return pages ?? []
    return (pages ?? []).filter((p) => {
      const label = `${p.textPreview ?? ""} pg ${p.pageNumber}`.toLowerCase()
      return label.includes(f)
    })
  }, [pages, filter])

  const selectedIndex = useMemo(
    () => filteredPages.findIndex((p) => p.pageId === selectedPageId),
    [filteredPages, selectedPageId],
  )

  const virtualizer = useVirtualizer({
    count: filteredPages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 5,
  })

  useEffect(() => {
    if (selectedIndex >= 0) {
      virtualizer.scrollToIndex(selectedIndex, { align: "auto" })
    }
  }, [selectedIndex, virtualizer])

  if (!filteredPages.length) {
    return (
      <div className="flex-1 overflow-y-auto px-3 py-4 text-xs text-muted-foreground text-center">
        <Trans>No pages match your search</Trans>
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
          const page = filteredPages[virtualRow.index]
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
}: {
  bookLabel: string
  page: { pageId: string; textPreview: string; pageNumber: number; sectionCount: number; prunedSections?: number[] }
  isActive: boolean
  activeStepDef?: (typeof STAGES)[number]
  onSelect: () => void
  sectionIndex?: number
  onSelectSection?: (index: number) => void
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
        {isLoading || !imgSrc ? (
          <div className="shrink-0 w-16 h-12 bg-muted rounded ring-1 ring-border" />
        ) : (
          <img
            src={imgSrc}
            alt=""
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
            className="shrink-0 w-16 h-12 rounded object-cover object-center ring-1 ring-border"
          />
        )}
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
