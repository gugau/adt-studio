import { useState, useCallback } from "react"
import { useQueries, useQueryClient, useMutation } from "@tanstack/react-query"
import { Eye, EyeOff, ChevronDown, ChevronRight, Loader2, SlidersHorizontal, Sparkles, LayoutTemplate } from "lucide-react"
import type { ContentNodeData } from "@adt/types"
import { api, BASE_URL, type PageSummaryItem, type PageDetail, type SectionRendering } from "@/api/client"
import { invalidateStoryboardDependents } from "@/hooks/use-page-mutations"
import { SectionActionsDropdown } from "./SectionActionsDropdown"
import { ContentNodeBlock, updateNodeInTree, moveNodeInTree } from "./ContentNodeBlock"
import { useBookRun } from "@/hooks/use-book-run"
import { useActiveConfig } from "@/hooks/use-debug"
import { getTextGroupLabel, getTextTypeLabel } from "@/lib/text-type-labels"
import { Trans } from "@lingui/react/macro"
import { useLingui } from "@lingui/react/macro"
import { cn } from "@/lib/utils"

type SectionData = NonNullable<PageDetail["sectioning"]>["sections"][number]
type PartData = SectionData["parts"][number]

type DetailFilter = "structure" | "images" | "pruned"
const ALL_FILTERS: DetailFilter[] = ["structure", "images", "pruned"]

interface ContentEditorProps {
  bookLabel: string
  pages: PageSummaryItem[]
  onNavigateToSection?: (pageId: string, sectionIndex: number) => void
}

export function ContentEditor({ bookLabel, pages, onNavigateToSection }: ContentEditorProps) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const { stageState } = useBookRun()
  const storyboardRunning = stageState("storyboard") === "running" || stageState("storyboard") === "queued"
  const [expandedPages, setExpandedPages] = useState<Set<string>>(() => new Set(pages.map((p) => p.pageId)))
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const [visibleFilters, setVisibleFilters] = useState<Set<DetailFilter>>(() => new Set(ALL_FILTERS))

  const { data: activeConfigData } = useActiveConfig(bookLabel)
  const mergedConfig = activeConfigData?.merged as Record<string, unknown> | undefined
  const renderStrategies = (mergedConfig?.render_strategies ?? {}) as Record<string, { render_type: string }>
  const strategyNames = Object.keys(renderStrategies)
  const containerTypes = mergedConfig?.container_types as Record<string, string> | undefined
  const leafTypes = mergedConfig?.text_types as Record<string, string> | undefined

  const toggleFilter = (f: DetailFilter) => {
    setVisibleFilters((prev) => {
      const next = new Set(prev)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      return next
    })
  }

  const filterLabels: Record<DetailFilter, string> = {
    structure: t`Structure`,
    images: t`Images`,
    pruned: t`Pruned`,
  }

  // Fetch full page details for pages that have sections
  const pagesWithSections = pages.filter((p) => p.sectionCount > 0)
  const pageQueries = useQueries({
    queries: pagesWithSections.map((p) => ({
      queryKey: ["books", bookLabel, "pages", p.pageId],
      queryFn: () => api.getPage(bookLabel, p.pageId),
      staleTime: 30_000,
    })),
  })

  const isLoading = pageQueries.some((q) => q.isLoading)
  const pageDetailMap = new Map<string, PageDetail>()
  for (const q of pageQueries) {
    if (q.data) pageDetailMap.set(q.data.pageId, q.data)
  }

  const allPageIds = pages.map((p) => p.pageId)

  const invalidatePages = (...pageIds: string[]) => {
    for (const pid of pageIds) {
      queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "pages", pid] })
    }
    queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "pages"] })
    invalidateStoryboardDependents(queryClient, bookLabel)
  }

  // Mutations (from SectioningOverview)
  const mergeMutation = useMutation({
    mutationFn: ({ pageId, sectionIndex, direction }: { pageId: string; sectionIndex: number; direction: "prev" | "next" }) =>
      api.mergeSection(bookLabel, pageId, sectionIndex, direction),
    onSuccess: (_data, vars) => invalidatePages(vars.pageId),
  })
  const mergeCrossPageMutation = useMutation({
    mutationFn: ({ pageId, sectionIndex, direction }: { pageId: string; sectionIndex: number; direction: "prev" | "next" }) =>
      api.mergeSectionCrossPage(bookLabel, pageId, sectionIndex, direction),
    onSuccess: (data) => invalidatePages(data.sourcePageId, data.targetPageId),
  })
  const cloneMutation = useMutation({
    mutationFn: ({ pageId, sectionIndex }: { pageId: string; sectionIndex: number }) =>
      api.cloneSection(bookLabel, pageId, sectionIndex),
    onSuccess: (_data, vars) => invalidatePages(vars.pageId),
  })
  const deleteMutation = useMutation({
    mutationFn: ({ pageId, sectionIndex }: { pageId: string; sectionIndex: number }) =>
      api.deleteSection(bookLabel, pageId, sectionIndex),
    onSuccess: (_data, vars) => invalidatePages(vars.pageId),
  })
  const togglePruneMutation = useMutation({
    mutationFn: ({ pageId, sectionIndex }: { pageId: string; sectionIndex: number }) => {
      const page = pageDetailMap.get(pageId)
      if (!page?.sectioning) throw new Error("No sectioning data")
      const updated = {
        ...page.sectioning,
        sections: page.sectioning.sections.map((s, i) =>
          i === sectionIndex ? { ...s, isPruned: !s.isPruned } : s
        ),
      }
      return api.updateSectioning(bookLabel, pageId, updated)
    },
    onSuccess: (_data, vars) => invalidatePages(vars.pageId),
  })
  // General sectioning update — used for node-level edits (prune, text, type, move)
  const updateSectioningMutation = useMutation({
    mutationFn: ({ pageId, sectioning }: { pageId: string; sectioning: NonNullable<PageDetail["sectioning"]> }) =>
      api.updateSectioning(bookLabel, pageId, sectioning),
    onSuccess: (_data, vars) => invalidatePages(vars.pageId),
  })

  const isMutating = storyboardRunning || mergeMutation.isPending || mergeCrossPageMutation.isPending || cloneMutation.isPending || deleteMutation.isPending || togglePruneMutation.isPending || updateSectioningMutation.isPending

  const togglePage = useCallback((pageId: string) => {
    setExpandedPages((prev) => {
      const next = new Set(prev)
      if (next.has(pageId)) next.delete(pageId)
      else next.add(pageId)
      return next
    })
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <Trans>Loading pages...</Trans>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      {/* Confirm dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-popover rounded-lg border shadow-lg p-4 max-w-sm mx-4">
            <p className="text-sm mb-4">{confirmDialog.message}</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDialog(null)} className="px-3 py-1.5 text-xs rounded bg-muted hover:bg-muted/80">
                <Trans>Cancel</Trans>
              </button>
              <button type="button" onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null) }} className="px-3 py-1.5 text-xs rounded bg-destructive text-destructive-foreground hover:bg-destructive/90">
                <Trans>Confirm</Trans>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 space-y-2">
        {/* Filter bar */}
        <div className="flex items-center gap-2 pb-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground"><Trans>Show:</Trans></span>
          {ALL_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => toggleFilter(f)}
              className={cn(
                "px-2 py-1 text-xs rounded border transition-colors",
                visibleFilters.has(f)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-accent"
              )}
            >
              {filterLabels[f]}
            </button>
          ))}
        </div>

        {/* Page list */}
        {pages.map((pageSummary) => {
          const pageDetail = pageDetailMap.get(pageSummary.pageId)
          const isExpanded = expandedPages.has(pageSummary.pageId)
          const sectionCount = pageSummary.sectionCount
          const pageIdx = allPageIds.indexOf(pageSummary.pageId)
          const hasPrevPage = pageIdx > 0
          const hasNextPage = pageIdx < allPageIds.length - 1

          return (
            <div key={pageSummary.pageId} className="border rounded-lg overflow-hidden">
              {/* Page header — always visible */}
              <button
                type="button"
                onClick={() => togglePage(pageSummary.pageId)}
                className="flex items-center gap-3 w-full px-3 py-2 hover:bg-muted/40 transition-colors text-left"
              >
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />}
                <span className="text-xs font-medium">
                  {t`Page ${String(pageSummary.pageNumber)}`}
                </span>
                <span className="text-[10px] text-muted-foreground/50">
                  {sectionCount} {sectionCount === 1 ? t`section` : t`sections`}
                </span>
                {pageSummary.wordCount > 0 && (
                  <span className="text-[10px] text-muted-foreground/40">
                    {pageSummary.wordCount} {t`words`}
                  </span>
                )}
              </button>

              {/* Expanded: sections */}
              {isExpanded && pageDetail?.sectioning && (
                <div className="border-t px-3 py-2 space-y-2">
                  {pageDetail.sectioning.sections.map((section, sectionIdx) => {
                    if (section.isPruned && !visibleFilters.has("pruned")) return null
                    return (
                      <SectionCard
                        key={section.sectionId}
                        section={section}
                        sectionIdx={sectionIdx}
                        sectionCount={pageDetail.sectioning!.sections.length}
                        pageId={pageSummary.pageId}
                        bookLabel={bookLabel}
                        rendering={pageDetail.rendering?.sections[sectionIdx] ?? null}
                        renderingVersion={pageDetail.versions.rendering}
                        visibleFilters={visibleFilters}
                        strategyNames={strategyNames}
                        renderStrategies={renderStrategies}
                        hasPrevPage={hasPrevPage}
                        hasNextPage={hasNextPage}
                        disabled={isMutating}
                        onTogglePrune={() => togglePruneMutation.mutate({ pageId: pageSummary.pageId, sectionIndex: sectionIdx })}
                        onMerge={(dir) => mergeMutation.mutate({ pageId: pageSummary.pageId, sectionIndex: sectionIdx, direction: dir })}
                        onMergeCrossPage={(dir) => mergeCrossPageMutation.mutate({ pageId: pageSummary.pageId, sectionIndex: sectionIdx, direction: dir })}
                        onClone={() => cloneMutation.mutate({ pageId: pageSummary.pageId, sectionIndex: sectionIdx })}
                        onDelete={() => setConfirmDialog({
                          message: t`Delete section ${String(sectionIdx + 1)}? This cannot be undone.`,
                          onConfirm: () => deleteMutation.mutate({ pageId: pageSummary.pageId, sectionIndex: sectionIdx }),
                        })}
                        onConfirmMerge={(label, action) => setConfirmDialog({ message: t`Are you sure you want to ${label}?`, onConfirm: action })}
                        onNavigate={() => onNavigateToSection?.(pageSummary.pageId, sectionIdx)}
                        containerTypes={containerTypes}
                        leafTypes={leafTypes}
                        onUpdateSectioning={(sectioning) => updateSectioningMutation.mutate({ pageId: pageSummary.pageId, sectioning })}
                        sectioning={pageDetail.sectioning!}
                        sectionIndex={sectionIdx}
                      />
                    )
                  })}
                </div>
              )}

              {isExpanded && !pageDetail?.sectioning && sectionCount > 0 && (
                <div className="border-t px-3 py-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <Trans>Loading...</Trans>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SectionCard — a single section within a page
// ---------------------------------------------------------------------------

type SectioningData = NonNullable<PageDetail["sectioning"]>

function SectionCard({
  section,
  sectionIdx,
  sectionCount,
  pageId,
  bookLabel,
  rendering,
  renderingVersion,
  visibleFilters,
  strategyNames,
  renderStrategies,
  hasPrevPage,
  hasNextPage,
  disabled,
  onTogglePrune,
  onMerge,
  onMergeCrossPage,
  onClone,
  onDelete,
  onConfirmMerge,
  onNavigate,
  containerTypes,
  leafTypes,
  onUpdateSectioning,
  sectioning,
  sectionIndex,
}: {
  section: SectionData
  sectionIdx: number
  sectionCount: number
  pageId: string
  bookLabel: string
  rendering: SectionRendering | null
  renderingVersion: number | null
  visibleFilters: Set<DetailFilter>
  strategyNames: string[]
  renderStrategies: Record<string, { render_type: string }>
  hasPrevPage: boolean
  hasNextPage: boolean
  disabled: boolean
  onTogglePrune: () => void
  onMerge: (direction: "prev" | "next") => void
  onMergeCrossPage: (direction: "prev" | "next") => void
  onClone: () => void
  onDelete: () => void
  onConfirmMerge: (label: string, action: () => void) => void
  onNavigate: () => void
  containerTypes?: Record<string, string>
  leafTypes?: Record<string, string>
  onUpdateSectioning: (sectioning: SectioningData) => void
  sectioning: SectioningData
  sectionIndex: number
}) {
  const { t } = useLingui()
  const [isExpanded, setIsExpanded] = useState(false)
  const isActivity = section.sectionType.startsWith("activity")
  const hasPreview = rendering?.html != null
  const activityAnswers = rendering?.activityAnswers
  const hasAnswers = activityAnswers != null && Object.keys(activityAnswers).length > 0

  // Helper: update a specific part's content_node tree and save
  const updatePartNode = (partIndex: number, updater: (node: ContentNodeData) => ContentNodeData) => {
    const updated: SectioningData = {
      ...sectioning,
      sections: sectioning.sections.map((s, si) => {
        if (si !== sectionIndex) return s
        return {
          ...s,
          parts: s.parts.map((p, pi) => {
            if (pi !== partIndex || p.type !== "content_node") return p
            return { ...p, node: updater(p.node) }
          }),
        }
      }),
    }
    onUpdateSectioning(updated)
  }

  const handleToggleNodePruned = (partIndex: number, nodeId: string) => {
    updatePartNode(partIndex, (root) =>
      updateNodeInTree(root, nodeId, (n) => ({ ...n, isPruned: !n.isPruned })),
    )
  }

  const handleEditNodeText = (partIndex: number, nodeId: string, newText: string) => {
    updatePartNode(partIndex, (root) =>
      updateNodeInTree(root, nodeId, (n) => ({ ...n, text: newText })),
    )
  }

  const handleChangeNodeType = (partIndex: number, nodeId: string, field: "structure" | "role", newType: string) => {
    updatePartNode(partIndex, (root) =>
      updateNodeInTree(root, nodeId, (n) => ({ ...n, [field]: newType })),
    )
  }

  const handleMoveNode = (partIndex: number, dragNodeId: string, targetParentId: string | null, insertIndex: number) => {
    updatePartNode(partIndex, (root) => {
      const result = moveNodeInTree(root, dragNodeId, targetParentId, insertIndex)
      return result ?? root
    })
  }

  const thumbnailSrc = hasPreview
    ? `${BASE_URL}/books/${bookLabel}/thumbnails/${pageId}_sec${String(sectionIdx + 1).padStart(3, "0")}.png?v=${renderingVersion ?? 0}`
    : null

  return (
    <div
      className={`rounded-lg border transition-colors ${
        section.isPruned
          ? "border-dashed border-muted-foreground/20 bg-muted/20 opacity-60"
          : "border-border bg-card"
      }`}
    >
      {/* Section header */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="shrink-0 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        <button
          type="button"
          onClick={onNavigate}
          className="text-[11px] font-semibold uppercase tracking-wide text-primary hover:underline"
          title={t`Go to preview`}
        >
          {sectionIdx + 1}
        </button>

        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: section.backgroundColor, color: section.textColor }}
        >
          {section.sectionType.replace(/_/g, " ")}
        </span>

        <span className="text-[10px] text-muted-foreground/50">
          {section.parts.length} {section.parts.length === 1 ? t`part` : t`parts`}
        </span>

        {/* Activity render type selector */}
        {isActivity && strategyNames.length > 0 && (
          <div className="flex items-center gap-1 ml-1">
            <RenderTypeIndicator renderStrategies={renderStrategies} strategyNames={strategyNames} sectionType={section.sectionType} />
          </div>
        )}

        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={onTogglePrune}
            className={`flex items-center justify-center w-5 h-5 rounded cursor-pointer transition-colors ${
              section.isPruned
                ? "text-destructive hover:bg-destructive/10"
                : "text-muted-foreground/40 hover:bg-muted hover:text-muted-foreground"
            }`}
            title={section.isPruned ? t`Unprune section` : t`Prune section`}
          >
            {section.isPruned ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <SectionActionsDropdown
            sectionIndex={sectionIdx}
            sectionCount={sectionCount}
            isPruned={section.isPruned}
            hasPrevPage={hasPrevPage}
            hasNextPage={hasNextPage}
            onTogglePrune={onTogglePrune}
            onMerge={onMerge}
            onMergeCrossPage={onMergeCrossPage}
            onClone={onClone}
            onDelete={onDelete}
            onConfirmMerge={onConfirmMerge}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Section body: structure + preview side by side */}
      {isExpanded && (
        <div className="border-t">
          <div className="flex">
            {/* Left: content structure */}
            {visibleFilters.has("structure") && (
              <SectionContentTree
                section={section}
                bookLabel={bookLabel}
                visibleFilters={visibleFilters}
                disabled={disabled}
                containerTypes={containerTypes}
                leafTypes={leafTypes}
                onToggleNodePruned={handleToggleNodePruned}
                onEditNodeText={handleEditNodeText}
                onChangeNodeType={handleChangeNodeType}
                onMoveNode={handleMoveNode}
                className={hasPreview ? "w-1/2 border-r" : "w-full"}
              />
            )}

            {/* Right: rendered preview thumbnail */}
            {hasPreview && thumbnailSrc && (
              <div className={cn("py-2 px-2 flex flex-col gap-2", visibleFilters.has("structure") ? "w-1/2" : "w-full")}>
                <button
                  type="button"
                  className="w-[200px] h-[260px] border rounded overflow-hidden bg-white relative cursor-pointer hover:ring-2 hover:ring-violet-400 transition-shadow shrink-0"
                  onClick={onNavigate}
                  title={t`Go to preview`}
                >
                  <img
                    src={thumbnailSrc}
                    alt={t`Section ${String(sectionIdx + 1)} preview`}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </button>
              </div>
            )}
          </div>

          {/* Activity answers — after content tree, with context */}
          {hasAnswers && (
            <ActivityAnswerKey answers={activityAnswers!} renderedHtml={rendering?.html} />
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SectionContentTree — renders parts with images grouped horizontally
// ---------------------------------------------------------------------------

function SectionContentTree({
  section,
  bookLabel,
  visibleFilters,
  disabled,
  containerTypes,
  leafTypes,
  onToggleNodePruned,
  onEditNodeText,
  onChangeNodeType,
  onMoveNode,
  className,
}: {
  section: SectionData
  bookLabel: string
  visibleFilters: Set<DetailFilter>
  disabled: boolean
  containerTypes?: Record<string, string>
  leafTypes?: Record<string, string>
  onToggleNodePruned: (partIndex: number, nodeId: string) => void
  onEditNodeText: (partIndex: number, nodeId: string, newText: string) => void
  onChangeNodeType: (partIndex: number, nodeId: string, field: "structure" | "role", newType: string) => void
  onMoveNode: (partIndex: number, dragNodeId: string, targetParentId: string | null, insertIndex: number) => void
  className?: string
}) {
  const showPruned = visibleFilters.has("pruned")
  const showImages = visibleFilters.has("images")

  return (
    <div className={cn("px-3 py-2 space-y-1 overflow-auto", className)}>
      {section.parts.map((part, partIndex) => {
        if (part.isPruned && !showPruned) return null
        if (part.type === "content_node") {
          return (
            <ContentNodeBlock
              key={part.nodeId}
              node={part.node}
              parentId={null}
              indexInParent={0}
              bookLabel={bookLabel}
              depth={0}
              disabled={disabled}
              containerTypes={containerTypes}
              leafTypes={leafTypes}
              onTogglePruned={(nodeId) => onToggleNodePruned(partIndex, nodeId)}
              onEditText={(nodeId, newText) => onEditNodeText(partIndex, nodeId, newText)}
              onChangeType={(nodeId, field, newType) => onChangeNodeType(partIndex, nodeId, field, newType)}
              onMoveNode={(dragId, targetParentId, insertIdx) => onMoveNode(partIndex, dragId, targetParentId, insertIdx)}
            />
          )
        }
        if (part.type === "text_group") {
          return <TextGroupPartView key={part.groupId} part={part} />
        }
        if (part.type === "image" && showImages) {
          return <ImagePartView key={part.imageId} part={part} bookLabel={bookLabel} />
        }
        return null
      })}
      {section.parts.length === 0 && (
        <div className="py-2 text-center text-[10px] text-muted-foreground/40">
          <Trans>No content</Trans>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// RenderTypeIndicator — shows AI / Template badge for activity sections
// ---------------------------------------------------------------------------

function RenderTypeIndicator({
  renderStrategies,
  strategyNames,
  sectionType,
}: {
  renderStrategies: Record<string, { render_type: string }>
  strategyNames: string[]
  sectionType: string
}) {
  // Find which strategy this section type maps to
  const matchedStrategy = strategyNames.find((name) => name === sectionType)
  const strategy = matchedStrategy ? renderStrategies[matchedStrategy] : null
  const renderType = strategy?.render_type ?? "llm"

  const isTemplate = renderType === "template"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[9px] font-medium",
        isTemplate
          ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
          : "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
      )}
    >
      {isTemplate ? <LayoutTemplate className="h-2.5 w-2.5" /> : <Sparkles className="h-2.5 w-2.5" />}
      {isTemplate ? "Template" : "AI"}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Legacy part renderers
// ---------------------------------------------------------------------------

function TextGroupPartView({ part }: { part: Extract<PartData, { type: "text_group" }> }) {
  return (
    <div className="border-l-2 border-primary/25 ml-0.5 mt-1">
      <div className="pl-1.5 py-px">
        <span className="text-[9px] font-medium uppercase tracking-wider text-primary/70">{getTextGroupLabel(part.groupType)}</span>
      </div>
      {part.texts.map((text) => (
        <div key={text.textId} className={cn("flex items-baseline gap-1 pl-1.5 py-px ml-0.5", text.isPruned && "opacity-35")}>
          <span className="shrink-0 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/50">{getTextTypeLabel(text.textType)}</span>
          <span className="text-[11px] leading-snug line-clamp-2">{text.text}</span>
        </div>
      ))}
    </div>
  )
}

function ImagePartView({ part, bookLabel }: { part: Extract<PartData, { type: "image" }>; bookLabel: string }) {
  // eslint-disable-next-line lingui/no-unlocalized-strings
  const imgSrc = `${BASE_URL}/books/${bookLabel}/images/${part.imageId}`
  return (
    <div className="flex items-center gap-2">
      <img
        src={imgSrc}
        alt={part.imageId}
        className="max-h-[50px] max-w-[100px] object-contain rounded border border-border/50"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
      />
      <span className="text-[9px] text-muted-foreground/50 font-mono truncate">{part.imageId}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Activity Answer Key — shows answers with context from rendered HTML
// ---------------------------------------------------------------------------

function extractAnswerContexts(html: string): Map<string, string> {
  const ctx = new Map<string, string>()
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")

  const inputs = doc.querySelectorAll("[data-activity-item]")
  for (const input of inputs) {
    const itemId = input.getAttribute("data-activity-item")
    if (!itemId) continue
    const label = input.closest("label")
    if (label) { ctx.set(itemId, label.textContent?.trim() ?? ""); continue }
    const id = input.getAttribute("id")
    if (id) {
      const assocLabel = doc.querySelector(`label[for="${id}"]`)
      if (assocLabel) { ctx.set(itemId, assocLabel.textContent?.trim() ?? ""); continue }
    }
    const container = input.closest("li") ?? input.closest("div")
    if (container) ctx.set(itemId, container.textContent?.trim() ?? "")
  }

  const blankRe = /\[\[blank:(item-\d+)(?::([^\]]+))?\]\]/g
  let match
  while ((match = blankRe.exec(html)) !== null) {
    const itemId = match[1]
    if (ctx.has(itemId)) continue
    const start = Math.max(0, match.index - 80)
    const end = Math.min(html.length, match.index + match[0].length + 80)
    let snippet = html.slice(start, end)
    snippet = snippet.replace(/<[^>]+>/g, "").trim()
    snippet = snippet.replace(/\[\[blank:item-\d+(?::[^\]]+)?\]\]/g, "___")
    ctx.set(itemId, snippet)
  }

  return ctx
}

function ActivityAnswerKey({
  answers,
  renderedHtml,
}: {
  answers: Record<string, string | boolean | number>
  renderedHtml?: string
}) {
  const contexts = renderedHtml ? extractAnswerContexts(renderedHtml) : new Map<string, string>()

  const sorted = Object.entries(answers).sort(([a], [b]) => {
    const na = parseInt(a.replace(/\D/g, ""), 10)
    const nb = parseInt(b.replace(/\D/g, ""), 10)
    if (!isNaN(na) && !isNaN(nb)) return na - nb
    return a.localeCompare(b)
  })

  return (
    <div className="mx-3 mb-2">
      <h4 className="text-[10px] font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1.5">
        <Trans>Answers</Trans>
      </h4>
      <div className="space-y-1.5">
        {sorted.map(([id, value]) => {
          const context = contexts.get(id)
          const strValue = String(value)
          const isBoolTrue = value === true || strValue === "true"
          const isBoolFalse = value === false || strValue === "false"

          return (
            <div
              key={id}
              className="flex items-center gap-2.5 rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50/80 dark:bg-amber-950/20 px-3 py-2"
            >
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-800/40 text-amber-800 dark:text-amber-300 shrink-0">
                {id}
              </span>
              <span className={cn(
                "text-[12px] font-medium shrink-0",
                isBoolTrue && "text-green-700 dark:text-green-400",
                isBoolFalse && "text-red-600 dark:text-red-400",
                !isBoolTrue && !isBoolFalse && "text-foreground/80",
              )}>
                {strValue}
              </span>
              {context && (
                <span className="text-[11px] text-muted-foreground/60 truncate" title={context}>
                  — {context}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

