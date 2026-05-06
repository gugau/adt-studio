import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { ChevronDown, Loader2, Plus, Sparkles } from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import { msg } from "@lingui/core/macro"
import { i18n } from "@lingui/core"
import {
  api,
  type Activity,
  type ActivitiesOutput,
  type ActivityTemplateType,
  type PageSummaryItem,
} from "@/api/client"
import { useActivities } from "@/hooks/use-activities"
import { usePages } from "@/hooks/use-pages"
import { useApiKey } from "@/hooks/use-api-key"
import { useBookRun } from "@/hooks/use-book-run"
import { StageRunCard } from "../../components/StageRunCard"
import { useStepHeader } from "../../components/StepViewRouter"
import { ActivityListItem, type ActivityListEntry } from "./ActivityListItem"
import { ActivityEditorShell } from "./ActivityEditorShell"
import { ACTIVITY_TEMPLATE_LABELS } from "./activity-helpers"
import { cn } from "@/lib/utils"

type Tab = "activities" | "generate"

export function ActivitiesView({
  bookLabel,
  selectedPageId,
}: {
  bookLabel: string
  selectedPageId?: string
}) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { setExtra } = useStepHeader()
  const { stageState, queueRun } = useBookRun()
  const { apiKey, hasApiKey } = useApiKey()

  const { data: activitiesResp, isLoading: loadingActivities } = useActivities(bookLabel)
  const { data: pages } = usePages(bookLabel)

  const [tab, setTab] = useState<Tab>("activities")
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [newMenuOpen, setNewMenuOpen] = useState(false)

  const activitiesOutput = activitiesResp?.activities ?? null
  const activities = activitiesOutput?.activities ?? []
  const stageRunning = stageState("quizzes") === "running" || stageState("quizzes") === "queued"
  const stageDone = stageState("quizzes") === "done"

  const filterPageId = !showAll && selectedPageId ? selectedPageId : null
  const entries = useMemo(
    () => buildEntries(pages ?? [], activities, filterPageId),
    [pages, activities, filterPageId],
  )

  const selectedActivity = activities.find((a) => a.activityId === selectedActivityId) ?? null

  // Header chip: counts.
  useEffect(() => {
    setExtra(
      <div className="flex items-center gap-1.5 ml-auto">
        <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5">
          {t`${String(entries.length)} activities`}
        </span>
      </div>,
    )
    return () => setExtra(null)
  }, [entries.length, setExtra, t])

  // Persist activities back to the API on save.
  const persist = useCallback(
    async (next: ActivitiesOutput) => {
      setSaving(true)
      try {
        await api.updateActivities(bookLabel, next)
        await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "activities"] })
      } finally {
        setSaving(false)
      }
    },
    [bookLabel, queryClient],
  )

  const handleSaveActivity = useCallback(
    async (next: Activity) => {
      if (!activitiesOutput) return
      const updated: ActivitiesOutput = {
        ...activitiesOutput,
        activities: activitiesOutput.activities.map((a) =>
          a.activityId === next.activityId ? next : a,
        ),
      }
      await persist(updated)
    },
    [activitiesOutput, persist],
  )

  const handleDeleteActivity = useCallback(
    async (activityId: string) => {
      if (!activitiesOutput) return
      const updated: ActivitiesOutput = {
        ...activitiesOutput,
        activities: activitiesOutput.activities.filter((a) => a.activityId !== activityId),
      }
      await persist(updated)
      setSelectedActivityId(null)
    },
    [activitiesOutput, persist],
  )

  const handleNew = useCallback(
    async (templateType: ActivityTemplateType) => {
      setNewMenuOpen(false)
      const afterPageId = selectedPageId ?? pages?.[0]?.pageId
      if (!afterPageId) return
      const res = await api.newActivity(bookLabel, templateType, afterPageId)
      await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "activities"] })
      setSelectedActivityId(res.activity.activityId)
    },
    [bookLabel, selectedPageId, pages, queryClient],
  )

  const handleExtractFromPage = useCallback(async () => {
    if (!selectedPageId || !apiKey) return
    setGenerating(true)
    try {
      await api.generateActivity(
        bookLabel,
        {
          source: "page",
          pageIds: [selectedPageId],
          templateType: "multiple_choice",
          count: 1,
        },
        apiKey,
      )
      // Submitted as a task; the user will see it in the task list. We re-fetch
      // proactively in case the task ran inline.
      await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "activities"] })
    } finally {
      setGenerating(false)
    }
  }, [bookLabel, selectedPageId, apiKey, queryClient])

  const handleRunBatch = useCallback(() => {
    if (!hasApiKey || stageRunning) return
    queueRun({ fromStage: "quizzes", toStage: "quizzes", apiKey })
  }, [hasApiKey, stageRunning, apiKey, queueRun])

  const handleJumpToStoryboard = useCallback(
    (pageId: string, sectionIndex: number) => {
      navigate({
        to: "/books/$label/$step",
        params: { label: bookLabel, step: "storyboard" },
        search: { pageId, sectionIndex },
      })
    },
    [navigate, bookLabel],
  )

  // Reset selection if it disappears (e.g. delete) or filter changes.
  useEffect(() => {
    if (selectedActivityId && !activities.some((a) => a.activityId === selectedActivityId)) {
      setSelectedActivityId(null)
    }
  }, [selectedActivityId, activities])

  // ── Render ──────────────────────────────────────────────────────────────

  if (selectedActivity) {
    return (
      <ActivityEditorShell
        activity={selectedActivity}
        saving={saving}
        onSave={handleSaveActivity}
        onDelete={() => handleDeleteActivity(selectedActivity.activityId)}
        onClose={() => setSelectedActivityId(null)}
      />
    )
  }

  const tabs: ReadonlyArray<{ value: Tab; label: string }> = [
    { value: "activities", label: i18n._(msg`Activities`) },
    { value: "generate", label: i18n._(msg`Generate`) },
  ]

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 flex border-b bg-background">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              "flex-1 px-3 py-2 text-xs font-medium uppercase tracking-wider transition-colors border-b-2",
              tab === t.value
                ? "text-orange-600 border-orange-600"
                : "text-muted-foreground border-transparent hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "generate" ? (
        <div className="flex-1 overflow-y-auto p-4">
          <StageRunCard
            stageSlug="quizzes"
            isRunning={stageRunning}
            completed={stageDone}
            onRun={handleRunBatch}
            disabled={!hasApiKey || stageRunning}
          />
        </div>
      ) : (
        <>
          <ActionBar
            selectedPageId={selectedPageId}
            showAll={showAll}
            setShowAll={setShowAll}
            newMenuOpen={newMenuOpen}
            setNewMenuOpen={setNewMenuOpen}
            onNew={handleNew}
            onExtractFromPage={handleExtractFromPage}
            extracting={generating}
            hasApiKey={hasApiKey}
          />
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loadingActivities ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                <span className="text-sm">
                  <Trans>Loading activities…</Trans>
                </span>
              </div>
            ) : entries.length === 0 ? (
              <EmptyState
                hasFilter={filterPageId != null}
                hasAny={activities.length > 0 || hasAnyAiActivities(pages ?? [])}
                onShowAll={() => setShowAll(true)}
              />
            ) : (
              entries.map((entry) => (
                <ActivityListItem
                  key={entryKey(entry)}
                  entry={entry}
                  onOpen={(id) => setSelectedActivityId(id)}
                  onJumpToStoryboard={handleJumpToStoryboard}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Action bar ──────────────────────────────────────────────────────────────

function ActionBar({
  selectedPageId,
  showAll,
  setShowAll,
  newMenuOpen,
  setNewMenuOpen,
  onNew,
  onExtractFromPage,
  extracting,
  hasApiKey,
}: {
  selectedPageId: string | undefined
  showAll: boolean
  setShowAll: (v: boolean) => void
  newMenuOpen: boolean
  setNewMenuOpen: (v: boolean) => void
  onNew: (t: ActivityTemplateType) => void
  onExtractFromPage: () => void
  extracting: boolean
  hasApiKey: boolean
}) {
  const { t } = useLingui()
  const filtering = !showAll && !!selectedPageId
  const templateOptions: ActivityTemplateType[] = [
    "multiple_choice",
    "true_false",
    "fill_in_the_blank",
  ]

  return (
    <div className="shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-b bg-muted/20">
      {/* New activity dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setNewMenuOpen(!newMenuOpen)}
          className="inline-flex items-center gap-1 text-xs font-medium rounded px-2.5 py-1.5 bg-orange-600 text-white hover:bg-orange-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <Trans>New activity</Trans>
          <ChevronDown className="w-3 h-3" />
        </button>
        {newMenuOpen && (
          <>
            <button
              type="button"
              aria-label={t`Close menu`}
              onClick={() => setNewMenuOpen(false)}
              className="fixed inset-0 z-10 cursor-default"
            />
            <div className="absolute left-0 top-full mt-1 z-20 bg-popover border rounded shadow-md min-w-[160px] py-1">
              {templateOptions.map((tt) => (
                <button
                  key={tt}
                  type="button"
                  onClick={() => onNew(tt)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                >
                  {i18n._(ACTIVITY_TEMPLATE_LABELS[tt])}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onExtractFromPage}
        disabled={!selectedPageId || !hasApiKey || extracting}
        title={
          !selectedPageId
            ? t`Select a page first`
            : !hasApiKey
              ? t`API key required`
              : t`Extract a multiple-choice activity from the selected page`
        }
        className="inline-flex items-center gap-1 text-xs rounded px-2.5 py-1.5 border border-border bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
        <Trans>Extract from page</Trans>
      </button>

      {filtering && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="ml-auto inline-flex items-center text-xs rounded px-2 py-1 border border-border bg-background hover:bg-muted transition-colors"
        >
          <Trans>Show all</Trans>
        </button>
      )}
      {showAll && selectedPageId && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="ml-auto inline-flex items-center text-xs rounded px-2 py-1 border border-border bg-background hover:bg-muted transition-colors"
        >
          <Trans>Filter to selected page</Trans>
        </button>
      )}
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({
  hasFilter,
  hasAny,
  onShowAll,
}: {
  hasFilter: boolean
  hasAny: boolean
  onShowAll: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-center">
      <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center mb-3">
        <Sparkles className="w-5 h-5 text-orange-400" />
      </div>
      {hasFilter && hasAny ? (
        <>
          <p className="text-sm font-medium text-foreground">
            <Trans>No activities for this page yet</Trans>
          </p>
          <button
            type="button"
            onClick={onShowAll}
            className="mt-2 text-xs underline text-orange-600 hover:text-orange-700"
          >
            <Trans>Show all activities</Trans>
          </button>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-foreground">
            <Trans>No activities yet</Trans>
          </p>
          <p className="text-xs mt-1">
            <Trans>Use New activity, Extract from page, or run a batch from the Generate tab.</Trans>
          </p>
        </>
      )}
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function entryKey(entry: ActivityListEntry): string {
  if (entry.kind === "templated") return `t-${entry.activity.activityId}`
  return `a-${entry.pageId}-${entry.sectionIndex}`
}

function hasAnyAiActivities(pages: PageSummaryItem[]): boolean {
  return pages.some((p) => p.sections.some((s) => s.sectionType.startsWith("activity_")))
}

/**
 * Build the unified activity list, in reading order. For each page:
 *   1. AI-laid-out activity sections (in section order)
 *   2. Templated activities placed after this page
 * If `filterPageId` is set, only entries owned by that page are returned.
 */
function buildEntries(
  pages: PageSummaryItem[],
  activities: Activity[],
  filterPageId: string | null,
): ActivityListEntry[] {
  const out: ActivityListEntry[] = []
  for (const page of pages) {
    if (filterPageId && page.pageId !== filterPageId) continue
    for (const section of page.sections) {
      if (!section.sectionType.startsWith("activity_")) continue
      out.push({
        kind: "ai-laid-out",
        pageId: page.pageId,
        sectionIndex: section.sectionIndex,
        sectionType: section.sectionType,
        preview: page.textPreview ?? "",
      })
    }
    for (const activity of activities) {
      if (activity.afterPageId !== page.pageId) continue
      out.push({ kind: "templated", activity })
    }
  }
  return out
}
