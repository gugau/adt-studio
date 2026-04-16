import { useState, useRef, useCallback } from "react"
import { useQueries, useQueryClient, useMutation } from "@tanstack/react-query"
import { api, BASE_URL, type PageSummaryItem, type PageDetail } from "@/api/client"
import type { SectionPart, PageSection, ContentNodeData } from "@adt/types"
import { invalidateStoryboardDependents } from "@/hooks/use-page-mutations"
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Layers,
  Image,
  FileText,
  Loader2,
  Puzzle,
  Save,
  SlidersHorizontal,
  X,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SectionActionsDropdown } from "./SectionActionsDropdown"
import { SectionEditToolbar } from "./SectionEditToolbar"
import { ImageCropDialog } from "./ImageCropDialog"
import { AiImageDialog } from "./AiImageDialog"
import { ContentNodeBlock, updateNodeInTree, treeContainsNode, removeNodeFromTree, insertNodeIntoTree } from "./ContentNodeBlock"
import { useApiKey } from "@/hooks/use-api-key"
import { useBookRun } from "@/hooks/use-book-run"
import { useActiveConfig } from "@/hooks/use-debug"
import { Trans } from "@lingui/react/macro"
import { useLingui } from "@lingui/react/macro"
import { cn } from "@/lib/utils"
import { getSectionTypeLabel } from "@/lib/section-constants"

function getSectionTypeDisplayLabel(value: string): string {
  return getSectionTypeLabel(value) || value.replace(/_/g, " ")
}

function SectionTypeIcon({ sectionType, className }: { sectionType: string; className?: string }) {
  if (sectionType.startsWith("activity") || sectionType.startsWith("exercise")) {
    return <Puzzle className={className} />
  }
  if (sectionType === "images_only" || sectionType === "image") {
    return <Image className={className} />
  }
  return <Layers className={className} />
}

/** Recursively extract text from a ContentNodeData tree for preview */
function extractNodeText(node: ContentNodeData): string {
  if (node.text) return node.text
  if (node.children) return node.children.map(extractNodeText).join(" ")
  return ""
}

/**
 * Extract context for each activity answer item from rendered HTML.
 * Returns a map of item ID → context string (question text, option label, or surrounding text for blanks).
 */
function extractAnswerContexts(html: string): Map<string, string> {
  const ctx = new Map<string, string>()
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")

  // Multiple choice / checkboxes: find inputs with data-activity-item
  const inputs = doc.querySelectorAll("[data-activity-item]")
  for (const input of inputs) {
    const itemId = input.getAttribute("data-activity-item")
    if (!itemId) continue
    // Find the label or parent text that describes this option
    const label = input.closest("label")
    if (label) {
      ctx.set(itemId, label.textContent?.trim() ?? "")
      continue
    }
    // Check for an associated label via "for" attribute
    const id = input.getAttribute("id")
    if (id) {
      const assocLabel = doc.querySelector(`label[for="${id}"]`)
      if (assocLabel) {
        ctx.set(itemId, assocLabel.textContent?.trim() ?? "")
        continue
      }
    }
    // Fallback: use parent li/div text
    const container = input.closest("li") ?? input.closest("div")
    if (container) {
      ctx.set(itemId, container.textContent?.trim() ?? "")
    }
  }

  // Fill-in-the-blank: find [[blank:item-N]] or [[blank:item-N:hint]] markers in raw HTML
  const blankRe = /\[\[blank:(item-\d+)(?::([^\]]+))?\]\]/g
  let match
  while ((match = blankRe.exec(html)) !== null) {
    const itemId = match[1]
    if (ctx.has(itemId)) continue
    // Extract surrounding sentence context (up to 80 chars each side)
    const start = Math.max(0, match.index - 80)
    const end = Math.min(html.length, match.index + match[0].length + 80)
    let snippet = html.slice(start, end)
    // Strip HTML tags from snippet
    snippet = snippet.replace(/<[^>]+>/g, "").trim()
    // Replace the blank marker with ___
    snippet = snippet.replace(/\[\[blank:item-\d+(?::[^\]]+)?\]\]/g, "___")
    ctx.set(itemId, snippet)
  }

  return ctx
}

/** A flattened section entry with its parent page context */
interface FlatSection {
  page: PageDetail
  section: PageSection
  sectionIndex: number // index within the page
  pageNumber: number | null
}

type DetailPanel = "preview" | "metadata" | "textGroups" | "images" | "prunedImages" | "answers"
const ALL_PANELS: DetailPanel[] = ["preview", "metadata", "textGroups", "images", "prunedImages", "answers"]

interface SectioningOverviewProps {
  bookLabel: string
  pages: PageSummaryItem[]
  onNavigateToSection?: (pageId: string, sectionIndex: number) => void
}

export function SectioningOverview({ bookLabel, pages, onNavigateToSection }: SectioningOverviewProps) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const { stageState } = useBookRun()
  const storyboardRunning = stageState("storyboard") === "running" || stageState("storyboard") === "queued"
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const [visiblePanels, setVisiblePanels] = useState<Set<DetailPanel>>(() => new Set(ALL_PANELS))
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [allExpanded, setAllExpanded] = useState(false)
  // Pending (unsaved) sectioning changes per page
  const [pendingByPage, setPendingByPage] = useState<Map<string, NonNullable<PageDetail["sectioning"]>>>(new Map())
  const [saving, setSaving] = useState(false)
  const { apiKey, hasApiKey } = useApiKey()
  const hasPendingChanges = pendingByPage.size > 0

  const { data: activeConfigData } = useActiveConfig(bookLabel)
  const mergedConfig = activeConfigData?.merged as Record<string, unknown> | undefined
  const containerTypes = mergedConfig?.container_types as Record<string, string> | undefined
  const leafTypes = mergedConfig?.text_types as Record<string, string> | undefined
  const allSectionTypes = mergedConfig?.section_types as Record<string, string> | undefined
  const disabledSectionTypes = new Set(mergedConfig?.disabled_section_types as string[] ?? [])
  const sectionTypes = allSectionTypes
    ? Object.fromEntries(Object.entries(allSectionTypes).filter(([k]) => !disabledSectionTypes.has(k)))
    : undefined
  // Drag state for section reordering
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)

  const togglePanel = (panel: DetailPanel) => {
    setVisiblePanels((prev) => {
      const next = new Set(prev)
      if (next.has(panel)) next.delete(panel)
      else next.add(panel)
      return next
    })
  }

  const panelLabels: Record<DetailPanel, string> = {
    preview: t`Preview`,
    metadata: t`Metadata`,
    textGroups: t`Text Groups`,
    images: t`Images`,
    prunedImages: t`Pruned Images`,
    answers: t`Answers`,
  }

  // Fetch full page details for all pages that have sections
  const pagesWithSections = pages.filter((p) => p.sectionCount > 0)
  const pageQueries = useQueries({
    queries: pagesWithSections.map((p) => ({
      queryKey: ["books", bookLabel, "pages", p.pageId],
      queryFn: () => api.getPage(bookLabel, p.pageId),
      staleTime: 30_000,
    })),
  })

  const isLoading = pageQueries.some((q) => q.isLoading)
  const pageDetails = pageQueries
    .map((q) => q.data)
    .filter((d): d is PageDetail => d != null)

  // Build ordered list of all page IDs for adjacency checks
  const allPageIds = pages.map((p) => p.pageId)

  // Build effective page details — overlaying pending sectioning changes
  const effectivePages: PageDetail[] = pageDetails.map((p) => {
    const pending = pendingByPage.get(p.pageId)
    return pending ? { ...p, sectioning: pending } : p
  })

  // Build flat section list across all pages
  const flatSections: FlatSection[] = []
  for (const page of effectivePages) {
    if (!page.sectioning) continue
    for (let si = 0; si < page.sectioning.sections.length; si++) {
      const section = page.sectioning.sections[si]
      flatSections.push({
        page,
        section,
        sectionIndex: si,
        pageNumber: section.pageNumber ?? null,
      })
    }
  }

  const invalidatePages = (...pageIds: string[]) => {
    for (const pid of pageIds) {
      queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "pages", pid] })
    }
    queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "pages"] })
    invalidateStoryboardDependents(queryClient, bookLabel)
  }

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
      const page = pageDetails.find((p) => p.pageId === pageId)
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

  const updateSectioningMutation = useMutation({
    mutationFn: ({ pageId, sectioning }: { pageId: string; sectioning: NonNullable<PageDetail["sectioning"]> }) =>
      api.updateSectioning(bookLabel, pageId, sectioning),
    onSuccess: (_data, vars) => invalidatePages(vars.pageId),
  })

  // Defer a sectioning edit to the pending state (shown immediately, persisted on Save)
  const stagePendingSectioning = useCallback((pageId: string, sectioning: NonNullable<PageDetail["sectioning"]>) => {
    setPendingByPage((prev) => {
      const next = new Map(prev)
      next.set(pageId, sectioning)
      return next
    })
  }, [])

  const discardPending = useCallback(() => {
    setPendingByPage(new Map())
  }, [])

  const saveAllPending = useCallback(async () => {
    if (pendingByPage.size === 0 || saving) return
    setSaving(true)
    const entries = Array.from(pendingByPage.entries())
    try {
      for (const [pageId, sectioning] of entries) {
        await api.updateSectioning(bookLabel, pageId, sectioning)
      }
      // Trigger re-render for each affected page
      if (hasApiKey) {
        for (const [pageId] of entries) {
          api.reRenderPage(bookLabel, pageId, apiKey).catch(() => {})
        }
      }
      setPendingByPage(new Map())
      for (const [pageId] of entries) {
        invalidatePages(pageId)
      }
    } finally {
      setSaving(false)
    }
  }, [pendingByPage, saving, bookLabel, hasApiKey, apiKey])

  const isMutating = saving || storyboardRunning || mergeMutation.isPending || mergeCrossPageMutation.isPending || cloneMutation.isPending || deleteMutation.isPending || togglePruneMutation.isPending || updateSectioningMutation.isPending

  const toggleSection = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  // Drag-and-drop reorder handler (same-page only)
  const handleDrop = useCallback((fromGlobalIdx: number, toGlobalIdx: number) => {
    if (fromGlobalIdx === toGlobalIdx) return
    const from = flatSections[fromGlobalIdx]
    const to = flatSections[toGlobalIdx]
    if (!from || !to) return
    // Only allow same-page reorder
    if (from.page.pageId !== to.page.pageId) return
    const page = from.page
    if (!page.sectioning) return

    const sections = [...page.sectioning.sections]
    const [moved] = sections.splice(from.sectionIndex, 1)
    sections.splice(to.sectionIndex, 0, moved)

    const updated = { ...page.sectioning, sections }
    stagePendingSectioning(page.pageId, updated)
  }, [flatSections, stagePendingSectioning])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <Trans>Loading sectioning data...</Trans>
      </div>
    )
  }

  if (flatSections.length === 0) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        <Trans>No sectioning data available.</Trans>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-4 space-y-3">
        {/* Filter bar */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground"><Trans>Show:</Trans></span>
          {ALL_PANELS.map((panel) => (
            <button
              key={panel}
              type="button"
              onClick={() => togglePanel(panel)}
              className={cn(
                "px-2 py-1 text-xs rounded border transition-colors",
                visiblePanels.has(panel)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-accent"
              )}
            >
              {panelLabels[panel]}
            </button>
          ))}
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-2 py-2 font-medium text-muted-foreground w-6" />
                <th className="text-left px-1 py-2 font-medium text-muted-foreground w-8">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !allExpanded
                      setAllExpanded(next)
                      if (next) {
                        setExpanded(new Set(flatSections.map((_, i) => i)))
                      } else {
                        setExpanded(new Set())
                      }
                    }}
                    className="hover:bg-accent rounded p-0.5 transition-colors"
                    title={allExpanded ? t`Collapse all sections` : t`Expand all sections`}
                  >
                    {allExpanded ? (
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )}
                  </button>
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground w-10">
                  #
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground w-40">
                  <Trans>Section</Trans>
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">
                  <Trans>Type</Trans>
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                  <Trans>Content</Trans>
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground w-16 text-center">
                  <Trans>Parts</Trans>
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground w-10" />
              </tr>
            </thead>
            <tbody>
              {flatSections.map((entry, globalIdx) => {
                const { page, section, sectionIndex } = entry
                const pageIdx = allPageIds.indexOf(page.pageId)
                const hasPrevPage = pageIdx > 0
                const hasNextPage = pageIdx < allPageIds.length - 1
                const sectionCount = page.sectioning!.sections.length
                const isExpanded = expanded.has(globalIdx)

                const textParts = section.parts.filter((p) => p.type === "text_group")
                const imageParts = section.parts.filter((p) => p.type === "image")
                const contentNodeParts = section.parts.filter((p) => p.type === "content_node")
                const textCount = textParts.length + contentNodeParts.length
                const imageCount = imageParts.length

                // Content preview
                const firstText = textParts[0]
                let preview: string | null = null
                if (firstText?.type === "text_group") {
                  preview = firstText.texts.map((tx) => tx.text).join(" ").slice(0, 120)
                } else if (contentNodeParts.length > 0) {
                  const firstNode = contentNodeParts[0]
                  if (firstNode.type === "content_node") {
                    preview = extractNodeText(firstNode.node).slice(0, 120)
                  }
                }

                // Rendering data
                const renderSection = page.rendering?.sections.find((r) => r.sectionIndex === sectionIndex)

                // Determine if this row is a drop target
                const isDragOver = dropIdx === globalIdx && dragIdx !== null && dragIdx !== globalIdx
                // Only highlight if same page
                const dragEntry = dragIdx != null ? flatSections[dragIdx] : null
                const samePageDrag = dragEntry != null && dragEntry.page.pageId === page.pageId

                return (
                  <SectionRow
                    key={`${page.pageId}-${section.sectionId}`}
                    page={page}
                    section={section}
                    sectionIndex={sectionIndex}
                    sectionCount={sectionCount}
                    globalIndex={globalIdx + 1}
                    hasPrevPage={hasPrevPage}
                    hasNextPage={hasNextPage}
                    textParts={textParts}
                    imageParts={imageParts}
                    textCount={textCount}
                    imageCount={imageCount}
                    preview={preview}
                    isExpanded={isExpanded}
                    onToggle={() => toggleSection(globalIdx)}
                    renderReasoning={renderSection?.reasoning}
                    activityAnswers={renderSection?.activityAnswers}
                    renderedHtml={renderSection?.html}
                    bookLabel={bookLabel}
                    onMerge={(direction) => mergeMutation.mutate({ pageId: page.pageId, sectionIndex, direction })}
                    onMergeCrossPage={(direction) => mergeCrossPageMutation.mutate({ pageId: page.pageId, sectionIndex, direction })}
                    onClone={() => cloneMutation.mutate({ pageId: page.pageId, sectionIndex })}
                    onDelete={() => deleteMutation.mutate({ pageId: page.pageId, sectionIndex })}
                    onTogglePrune={() => togglePruneMutation.mutate({ pageId: page.pageId, sectionIndex })}
                    onConfirmAction={setConfirmDialog}
                    isMutating={isMutating}
                    visiblePanels={visiblePanels}
                    renderingVersion={page.versions.rendering}
                    onInvalidatePages={invalidatePages}
                    containerTypes={containerTypes}
                    leafTypes={leafTypes}
                    sectionTypes={sectionTypes}
                    onUpdateSectioning={(sectioning) => stagePendingSectioning(page.pageId, sectioning)}
                    sectioning={page.sectioning!}
                    disabled={isMutating}
                    pageNumber={entry.pageNumber}
                    isDragOver={isDragOver && samePageDrag}
                    onDragStart={() => setDragIdx(globalIdx)}
                    onDragOver={() => setDropIdx(globalIdx)}
                    onDragEnd={() => {
                      if (dragIdx != null && dropIdx != null && dragIdx !== dropIdx) {
                        handleDrop(dragIdx, dropIdx)
                      }
                      setDragIdx(null)
                      setDropIdx(null)
                    }}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation dialog */}
      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onConfirm={() => {
            confirmDialog.onConfirm()
            setConfirmDialog(null)
          }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* Floating save/discard bar — shown when there are pending changes */}
      {hasPendingChanges && !saving && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-popover border shadow-lg rounded-full px-3 py-1.5 animate-in slide-in-from-bottom-4">
          <span className="text-xs text-muted-foreground pl-1">
            <Trans>Unsaved changes on {pendingByPage.size} {pendingByPage.size === 1 ? "page" : "pages"}</Trans>
          </span>
          <button
            type="button"
            onClick={discardPending}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border hover:bg-accent transition-colors"
          >
            <X className="h-3 w-3" />
            <Trans>Discard</Trans>
          </button>
          <button
            type="button"
            onClick={saveAllPending}
            disabled={!hasApiKey}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            title={!hasApiKey ? t`API key required to save and re-render` : undefined}
          >
            <Save className="h-3 w-3" />
            <Trans>Save</Trans>
          </button>
        </div>
      )}

      {saving && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-popover border shadow-lg rounded-full px-3 py-1.5">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground"><Trans>Saving...</Trans></span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Confirmation dialog
// ---------------------------------------------------------------------------

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useLingui()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-popover border rounded-lg shadow-lg p-4 max-w-sm mx-4">
        <p className="text-sm mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded border hover:bg-accent transition-colors"
          >
            {t`Cancel`}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {t`Continue`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Individual section row
// ---------------------------------------------------------------------------

function SectionRow({
  page,
  section,
  sectionIndex,
  sectionCount,
  globalIndex,
  hasPrevPage,
  hasNextPage,
  textParts,
  imageParts,
  textCount,
  imageCount,
  preview,
  isExpanded,
  onToggle,
  renderReasoning,
  activityAnswers,
  renderedHtml,
  bookLabel,
  onMerge,
  onMergeCrossPage,
  onClone,
  onDelete,
  onTogglePrune,
  onConfirmAction,
  isMutating,
  visiblePanels,
  renderingVersion,
  onInvalidatePages,
  containerTypes,
  leafTypes,
  sectionTypes,
  onUpdateSectioning,
  sectioning,
  disabled,
  pageNumber,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragEnd,
}: {
  page: PageDetail
  section: PageSection
  sectionIndex: number
  sectionCount: number
  globalIndex: number
  hasPrevPage: boolean
  hasNextPage: boolean
  textParts: SectionPart[]
  imageParts: SectionPart[]
  textCount: number
  imageCount: number
  preview: string | null
  isExpanded: boolean
  onToggle: () => void
  renderReasoning?: string
  activityAnswers?: Record<string, string | boolean | number>
  renderedHtml?: string
  bookLabel: string
  onMerge: (direction: "prev" | "next") => void
  onMergeCrossPage: (direction: "prev" | "next") => void
  onClone: () => void
  onDelete: () => void
  onTogglePrune: () => void
  onConfirmAction: (dialog: { message: string; onConfirm: () => void }) => void
  isMutating: boolean
  visiblePanels: Set<DetailPanel>
  renderingVersion: number | null
  onInvalidatePages: (...pageIds: string[]) => void
  containerTypes?: Record<string, string>
  leafTypes?: Record<string, string>
  sectionTypes?: Record<string, string>
  onUpdateSectioning: (sectioning: NonNullable<PageDetail["sectioning"]>) => void
  sectioning: NonNullable<PageDetail["sectioning"]>
  disabled: boolean
  pageNumber: number | null
  isDragOver: boolean
  onDragStart: () => void
  onDragOver: () => void
  onDragEnd: () => void
}) {
  const { t } = useLingui()

  const handleSectionTypeChange = (newType: string) => {
    const updated: NonNullable<PageDetail["sectioning"]> = {
      ...sectioning,
      sections: sectioning.sections.map((s, i) =>
        i === sectionIndex ? { ...s, sectionType: newType } : s
      ),
    }
    onUpdateSectioning(updated)
  }

  return (
    <>
      <tr
        className={cn(
          "border-b hover:bg-muted/30 cursor-pointer transition-colors",
          section.isPruned && "opacity-50",
          isDragOver && "bg-violet-100/50 dark:bg-violet-900/20"
        )}
        onClick={onToggle}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move"
          onDragStart()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = "move"
          onDragOver()
        }}
        onDrop={(e) => {
          e.preventDefault()
          onDragEnd()
        }}
        onDragEnd={onDragEnd}
      >
        {/* Drag handle */}
        <td className="px-2 py-2">
          <GripVertical className="h-3 w-3 text-muted-foreground/40 cursor-grab" />
        </td>
        {/* Expand toggle */}
        <td className="px-1 py-2">
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
        </td>
        {/* Global index */}
        <td className="px-3 py-2">
          <span className="font-mono text-muted-foreground">
            {globalIndex}
          </span>
        </td>
        {/* Section ID */}
        <td className="px-3 py-2">
          <span
            className="font-mono text-foreground"
            title={section.sectionId}
          >
            {section.sectionId}
          </span>
          {section.isPruned && (
            <span className="ml-1.5 text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1 rounded">
              <Trans>pruned</Trans>
            </span>
          )}
        </td>
        {/* Section type */}
        <td className="px-3 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          {sectionTypes ? (
            <Select
              value={section.sectionType}
              onValueChange={handleSectionTypeChange}
              disabled={isMutating}
            >
              <SelectTrigger className="h-6 text-xs font-medium px-1.5 py-0 w-auto border-0 bg-muted/50 whitespace-nowrap gap-1 [&>span]:line-clamp-none [&>span]:flex [&>span]:items-center [&>span]:gap-1.5">
                <SectionTypeIcon sectionType={section.sectionType} className="h-3.5 w-3.5 shrink-0" />
                <span>{getSectionTypeDisplayLabel(section.sectionType)}</span>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(sectionTypes).map(([key, desc]) => (
                  <SelectItem key={key} value={key} className="text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      <SectionTypeIcon sectionType={key} className="h-3.5 w-3.5 shrink-0" />
                      {getSectionTypeDisplayLabel(key)}
                    </span>
                    {desc && (
                      <span className="ml-1 text-muted-foreground text-[10px]">{desc}</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-muted text-muted-foreground whitespace-nowrap">
              <SectionTypeIcon sectionType={section.sectionType} className="h-3.5 w-3.5 shrink-0" />
              {getSectionTypeDisplayLabel(section.sectionType)}
            </span>
          )}
        </td>
        {/* Content preview */}
        <td className="px-3 py-2 text-muted-foreground truncate max-w-xs">
          {preview ? (
            <span title={preview}>{preview}…</span>
          ) : imageCount > 0 ? (
            <span className="italic"><Trans>Images only</Trans></span>
          ) : (
            <span className="italic"><Trans>Empty section</Trans></span>
          )}
        </td>
        {/* Part counts */}
        <td className="px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-2">
            {textCount > 0 && (
              <span className="flex items-center gap-0.5" title={t`${textCount} text groups`}>
                <FileText className="h-3 w-3 text-blue-500" />
                {textCount}
              </span>
            )}
            {imageCount > 0 && (
              <span className="flex items-center gap-0.5" title={t`${imageCount} images`}>
                <Image className="h-3 w-3 text-green-500" />
                {imageCount}
              </span>
            )}
          </div>
        </td>
        {/* Actions dropdown */}
        <td className="px-3 py-2">
          <SectionActionsDropdown
            sectionIndex={sectionIndex}
            sectionCount={sectionCount}
            isPruned={section.isPruned}
            hasPrevPage={hasPrevPage}
            hasNextPage={hasNextPage}
            onMerge={onMerge}
            onMergeCrossPage={onMergeCrossPage}
            onClone={onClone}
            onDelete={() => {
              onConfirmAction({
                message: t`Are you sure you want to delete this section? This action cannot be undone.`,
                onConfirm: onDelete,
              })
            }}
            onTogglePrune={onTogglePrune}
            onConfirmMerge={(label, action) => {
              onConfirmAction({
                message: t`Are you sure you want to ${label}? This action cannot be undone.`,
                onConfirm: action,
              })
            }}
            disabled={isMutating}
          />
        </td>
      </tr>

      {/* Expanded detail */}
      {isExpanded && (
        <tr className="border-b bg-muted/10">
          <td colSpan={8} className="px-6 py-3">
            <SectionDetail
              section={section}
              sectionIndex={sectionIndex}
              textParts={textParts as Extract<SectionPart, { type: "text_group" }>[]}
              imageParts={imageParts as Extract<SectionPart, { type: "image" }>[]}
              renderReasoning={renderReasoning}
              activityAnswers={activityAnswers}
              renderedHtml={renderedHtml}
              bookLabel={bookLabel}
              pageId={page.pageId}
              onConfirmAction={onConfirmAction}
              visiblePanels={visiblePanels}
              renderingVersion={renderingVersion}
              onInvalidatePages={onInvalidatePages}
              containerTypes={containerTypes}
              leafTypes={leafTypes}
              onUpdateSectioning={onUpdateSectioning}
              sectioning={sectioning}
              disabled={disabled}
              pageNumber={pageNumber}
            />
          </td>
        </tr>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Expanded section detail panel
// ---------------------------------------------------------------------------

function SectionDetail({
  section,
  sectionIndex,
  textParts,
  imageParts,
  renderReasoning,
  activityAnswers,
  renderedHtml,
  bookLabel,
  pageId,
  onConfirmAction,
  visiblePanels,
  renderingVersion,
  onInvalidatePages,
  containerTypes,
  leafTypes,
  onUpdateSectioning,
  sectioning,
  disabled,
  pageNumber,
}: {
  section: { sectionId: string; sectionType: string; backgroundColor: string; textColor: string; parts: SectionPart[] }
  sectionIndex: number
  textParts: Array<{ type: "text_group"; groupId: string; groupType: string; texts: Array<{ textId: string; textType: string; text: string; isPruned: boolean }>; isPruned: boolean }>
  imageParts: Array<{ type: "image"; imageId: string; isPruned: boolean; reason?: string }>
  renderReasoning?: string
  activityAnswers?: Record<string, string | boolean | number>
  renderedHtml?: string
  bookLabel: string
  pageId: string
  onConfirmAction: (dialog: { message: string; onConfirm: () => void }) => void
  visiblePanels: Set<DetailPanel>
  renderingVersion: number | null
  onInvalidatePages: (...pageIds: string[]) => void
  containerTypes?: Record<string, string>
  leafTypes?: Record<string, string>
  onUpdateSectioning: (sectioning: NonNullable<PageDetail["sectioning"]>) => void
  sectioning: NonNullable<PageDetail["sectioning"]>
  disabled: boolean
  pageNumber: number | null
}) {
  const { t } = useLingui()
  const { apiKey, hasApiKey } = useApiKey()
  const { stageState: detailStageState } = useBookRun()
  const storyboardRunning = detailStageState("storyboard") === "running" || detailStageState("storyboard") === "queued"
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const replaceTargetRef = useRef<string | null>(null)

  const [selectedImage, setSelectedImage] = useState<{
    imageId: string
    isPruned: boolean
    rect: DOMRect
  } | null>(null)
  const [cropTarget, setCropTarget] = useState<string | null>(null)
  const [recropPageSrc, setRecropPageSrc] = useState<string | null>(null)
  const [aiImageTarget, setAiImageTarget] = useState<string | null>(null)

  // Content node handlers
  const contentNodeParts = section.parts
    .map((p, i) => ({ part: p, index: i }))
    .filter((x) => x.part.type === "content_node")

  const showAnswers = visiblePanels.has("answers")

  const updatePartNode = (partIndex: number, updater: (node: ContentNodeData) => ContentNodeData) => {
    const updated: NonNullable<PageDetail["sectioning"]> = {
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

  const handleMoveNode = (targetPartIndex: number, dragNodeId: string, targetParentId: string | null, insertIndex: number) => {
    // Find which part contains the dragged node
    const sourceEntry = contentNodeParts.find(({ part }) =>
      part.type === "content_node" && treeContainsNode(part.node, dragNodeId)
    )
    if (!sourceEntry) return

    const sourcePartIndex = sourceEntry.index

    if (sourcePartIndex === targetPartIndex) {
      // Same-part move: use existing single-tree logic
      updatePartNode(targetPartIndex, (root) => {
        const [treeWithout, draggedNode] = removeNodeFromTree(root, dragNodeId)
        if (!treeWithout || !draggedNode) return root
        const result = insertNodeIntoTree(treeWithout, draggedNode, targetParentId, insertIndex)
        return result ?? root
      })
    } else {
      // Cross-part move: remove from source, insert into target
      const sourcePart = sourceEntry.part
      if (sourcePart.type !== "content_node") return

      const [sourceTreeAfter, draggedNode] = removeNodeFromTree(sourcePart.node, dragNodeId)
      if (!draggedNode) return

      const targetEntry = contentNodeParts.find(({ index: i }) => i === targetPartIndex)
      if (!targetEntry || targetEntry.part.type !== "content_node") return

      const targetResult = insertNodeIntoTree(targetEntry.part.node, draggedNode, targetParentId, insertIndex)
      if (!targetResult) return

      // Build updated parts array
      const updated: NonNullable<PageDetail["sectioning"]> = {
        ...sectioning,
        sections: sectioning.sections.map((s, si) => {
          if (si !== sectionIndex) return s
          const newParts = s.parts.map((p, pi) => {
            if (pi === sourcePartIndex && p.type === "content_node") {
              // Source part: removed the node — if root was removed, mark for deletion
              if (!sourceTreeAfter) return null
              return { ...p, node: sourceTreeAfter }
            }
            if (pi === targetPartIndex && p.type === "content_node") {
              return { ...p, node: targetResult }
            }
            return p
          }).filter((p): p is NonNullable<typeof p> => p !== null)
          return { ...s, parts: newParts }
        }),
      }
      onUpdateSectioning(updated)
    }
  }

  const handleImageClick = useCallback((e: React.MouseEvent, img: { imageId: string; isPruned: boolean }) => {
    if (storyboardRunning) return
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setSelectedImage({ imageId: img.imageId, isPruned: img.isPruned, rect })
  }, [storyboardRunning])

  const handleCrop = useCallback((dataId: string) => {
    setSelectedImage(null)
    setCropTarget(dataId)
  }, [])

  const handleCropApply = useCallback(async (blob: Blob) => {
    if (!cropTarget) return
    const result = await api.uploadCroppedImage(bookLabel, pageId, cropTarget, blob)
    const pageData = queryClient.getQueryData<PageDetail>(["books", bookLabel, "pages", pageId])
    if (pageData?.sectioning) {
      const updated = {
        ...pageData.sectioning,
        sections: pageData.sectioning.sections.map((s: PageSection, si: number) => {
          if (si !== sectionIndex) return s
          return {
            ...s,
            parts: s.parts.map((p: SectionPart) =>
              p.type === "image" && p.imageId === cropTarget ? { ...p, imageId: result.imageId } : p
            ),
          }
        }),
      }
      await api.updateSectioning(bookLabel, pageId, updated)
    }
    setCropTarget(null)
    setRecropPageSrc(null)
    onInvalidatePages(pageId)
  }, [cropTarget, bookLabel, pageId, sectionIndex, queryClient, onInvalidatePages])

  const handleRecropFromPage = useCallback(async (dataId: string) => {
    setSelectedImage(null)
    try {
      const { imageBase64 } = await api.getPageImage(bookLabel, pageId)
      setCropTarget(dataId)
      setRecropPageSrc(`data:image/png;base64,${imageBase64}`)
    } catch (err) {
      console.error(t`Failed to load page image`, err)
    }
  }, [bookLabel, pageId, t])

  const handleReplace = useCallback((dataId: string) => {
    setSelectedImage(null)
    replaceTargetRef.current = dataId
    fileInputRef.current?.click()
  }, [])

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const targetId = replaceTargetRef.current
    if (!file || !targetId) return
    e.target.value = ""
    replaceTargetRef.current = null
    const result = await api.uploadCroppedImage(bookLabel, pageId, targetId, file)
    const pageData = queryClient.getQueryData<PageDetail>(["books", bookLabel, "pages", pageId])
    if (pageData?.sectioning) {
      const updated = {
        ...pageData.sectioning,
        sections: pageData.sectioning.sections.map((s: PageSection, si: number) => {
          if (si !== sectionIndex) return s
          return {
            ...s,
            parts: s.parts.map((p: SectionPart) =>
              p.type === "image" && p.imageId === targetId ? { ...p, imageId: result.imageId } : p
            ),
          }
        }),
      }
      await api.updateSectioning(bookLabel, pageId, updated)
    }
    onInvalidatePages(pageId)
  }, [bookLabel, pageId, sectionIndex, queryClient, onInvalidatePages])

  const handleAiImage = useCallback((dataId: string) => {
    setSelectedImage(null)
    setAiImageTarget(dataId)
  }, [])

  const handleAiImageSubmit = useCallback(async (
    prompt: string,
    referenceImageId?: string,
    options?: { style?: string; imageType?: string; styleImageId?: string },
  ) => {
    if (!aiImageTarget) return
    setAiImageTarget(null)
    await api.aiGenerateImage(bookLabel, pageId, prompt, apiKey, aiImageTarget, referenceImageId, undefined, {
      ...options,
      sectionIndex,
      mode: "swap",
    })
    setTimeout(() => onInvalidatePages(pageId), 2000)
  }, [aiImageTarget, bookLabel, pageId, apiKey, sectionIndex, onInvalidatePages])

  const handleDelete = useCallback(async (dataId: string) => {
    setSelectedImage(null)
    const pageData = queryClient.getQueryData<PageDetail>(["books", bookLabel, "pages", pageId])
    if (pageData?.sectioning) {
      const updated = {
        ...pageData.sectioning,
        sections: pageData.sectioning.sections.map((s: PageSection, si: number) => {
          if (si !== sectionIndex) return s
          return { ...s, parts: s.parts.filter((p: SectionPart) => !(p.type === "image" && p.imageId === dataId)) }
        }),
      }
      await api.updateSectioning(bookLabel, pageId, updated)
    }
    onInvalidatePages(pageId)
  }, [bookLabel, pageId, sectionIndex, queryClient, onInvalidatePages])

  const handleTogglePrune = useCallback(async (dataId: string) => {
    setSelectedImage(null)
    const pageData = queryClient.getQueryData<PageDetail>(["books", bookLabel, "pages", pageId])
    if (pageData?.sectioning) {
      const updated = {
        ...pageData.sectioning,
        sections: pageData.sectioning.sections.map((s: PageSection, si: number) => {
          if (si !== sectionIndex) return s
          return {
            ...s,
            parts: s.parts.map((p: SectionPart) =>
              p.type === "image" && p.imageId === dataId ? { ...p, isPruned: !p.isPruned } : p
            ),
          }
        }),
      }
      await api.updateSectioning(bookLabel, pageId, updated)
    }
    onInvalidatePages(pageId)
  }, [bookLabel, pageId, sectionIndex, queryClient, onInvalidatePages])

  const thumbnailFilename = `${pageId}_sec${String(sectionIndex + 1).padStart(3, "0")}.png`
  const thumbnailSrc = `${BASE_URL}/books/${bookLabel}/thumbnails/${thumbnailFilename}?v=${renderingVersion ?? 0}`

  return (
    <div className="space-y-3">
      <div className="flex gap-4">
        {/* Rendered section thumbnail */}
        {visiblePanels.has("preview") && renderingVersion != null && (
          <div className="shrink-0">
            <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              <Trans>Preview</Trans>
            </h4>
            <div
              className="w-[200px] h-[260px] border rounded overflow-hidden bg-white relative"
            >
              <img
                src={thumbnailSrc}
                alt={t`Section preview`}
                className="w-full h-full object-contain"
                loading="lazy"
              />
            </div>
          </div>
        )}

        {/* Detail panels */}
        <div className="flex-1 space-y-3 min-w-0">
          {/* Section metadata */}
          {visiblePanels.has("metadata") && (
            <>
              <div className="flex items-center gap-4 text-xs">
                {pageNumber != null && (
                  <>
                    <span className="text-muted-foreground"><Trans>From page</Trans>:</span>
                    <span className="font-mono">{pageNumber}</span>
                  </>
                )}
                <span className="text-muted-foreground"><Trans>Background</Trans>:</span>
                <span className="flex items-center gap-1">
                  <span
                    className="inline-block w-3 h-3 rounded border"
                    style={{ backgroundColor: section.backgroundColor }}
                  />
                  <span className="font-mono">{section.backgroundColor}</span>
                </span>
                <span className="text-muted-foreground"><Trans>Text</Trans>:</span>
                <span className="flex items-center gap-1">
                  <span
                    className="inline-block w-3 h-3 rounded border"
                    style={{ backgroundColor: section.textColor }}
                  />
                  <span className="font-mono">{section.textColor}</span>
                </span>
              </div>

              {/* Render reasoning */}
              {renderReasoning && (
                <div className="rounded border bg-violet-50/50 dark:bg-violet-950/20 p-2">
                  <span className="text-[10px] font-medium text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                    {t`Render Reasoning`}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{renderReasoning}</p>
                </div>
              )}

            </>
          )}

          {/* Content tree (interactive) — for content_node parts */}
          {visiblePanels.has("textGroups") && contentNodeParts.length > 0 && (
            <div>
              <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                <Trans>Content</Trans>
              </h4>
              <div className="space-y-1">
                {contentNodeParts.map(({ part, index: partIndex }) => {
                  if (part.type !== "content_node") return null
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
                      onTogglePruned={(nodeId) => handleToggleNodePruned(partIndex, nodeId)}
                      onEditText={(nodeId, newText) => handleEditNodeText(partIndex, nodeId, newText)}
                      onChangeType={(nodeId, field, newType) => handleChangeNodeType(partIndex, nodeId, field, newType)}
                      onMoveNode={(dragId, targetParentId, insertIdx) => handleMoveNode(partIndex, dragId, targetParentId, insertIdx)}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {/* Text groups (legacy flat format) */}
          {visiblePanels.has("textGroups") && contentNodeParts.length === 0 && textParts.length > 0 && (
            <div>
              <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                <Trans>Text Groups</Trans>
              </h4>
              <div className="space-y-2">
                {textParts.map((part) => (
                  <div
                    key={part.groupId}
                    className={cn(
                      "border rounded p-2",
                      part.isPruned && "opacity-50 border-dashed"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10px] text-muted-foreground">{part.groupId}</span>
                      <span className="text-[10px] px-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                        {part.groupType}
                      </span>
                      {part.isPruned && (
                        <span className="text-[10px] px-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                          <Trans>pruned</Trans>
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {part.texts.map((text) => (
                        <div
                          key={text.textId}
                          className={cn(
                            "flex gap-2 text-xs",
                            text.isPruned && "opacity-40 line-through"
                          )}
                        >
                          <span className="shrink-0 text-[10px] font-mono text-muted-foreground w-24">{text.textType}</span>
                          <span className="text-foreground">{text.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity answers — after tree, with context from rendered HTML */}
          {showAnswers && activityAnswers != null && Object.keys(activityAnswers).length > 0 && (
            <ActivityAnswerKey answers={activityAnswers} renderedHtml={renderedHtml} />
          )}

          {/* Images */}
          {visiblePanels.has("images") && imageParts.length > 0 && (() => {
            const showPruned = visiblePanels.has("prunedImages")
            const filteredImages = showPruned ? imageParts : imageParts.filter((img) => !img.isPruned)
            if (filteredImages.length === 0) return null
            return (
            <div>
              <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                <Trans>Images</Trans>
              </h4>
              <div className="flex flex-wrap gap-2">
                {filteredImages.map((img) => (
                  <div
                    key={img.imageId}
                    className={cn(
                      "border rounded p-1.5 flex flex-col items-center gap-1 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-shadow",
                      img.isPruned && "opacity-50 border-dashed",
                      selectedImage?.imageId === img.imageId && "ring-2 ring-primary"
                    )}
                    onClick={(e) => handleImageClick(e, img)}
                  >
                    <img
                      src={`${BASE_URL}/books/${bookLabel}/images/${img.imageId}`}
                      alt={img.imageId}
                      className="h-16 w-auto object-contain rounded"
                    />
                    <span className="text-[10px] font-mono text-muted-foreground">{img.imageId}</span>
                    {img.isPruned && (
                      <span className="text-[10px] text-amber-600"><Trans>pruned</Trans></span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            )
          })()}
        </div>
      </div>

      {/* Image action toolbar (same as storyboard) */}
      {selectedImage && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setSelectedImage(null)} />
          <SectionEditToolbar
            dataId={selectedImage.imageId}
            rect={selectedImage.rect}
            containerOffset={{ top: 0, left: 0 }}
            isImage
            isPruned={selectedImage.isPruned}
            imageSrc={`${BASE_URL}/books/${bookLabel}/images/${selectedImage.imageId}`}
            onCrop={!storyboardRunning ? handleCrop : undefined}
            onRecropFromPage={!storyboardRunning ? handleRecropFromPage : undefined}
            onReplace={!storyboardRunning ? handleReplace : undefined}
            onAiImage={hasApiKey && !storyboardRunning ? handleAiImage : undefined}
            onDelete={!storyboardRunning ? (dataId) => {
              onConfirmAction({
                message: t`Are you sure you want to delete this image? This action cannot be undone.`,
                onConfirm: () => handleDelete(dataId),
              })
            } : undefined}
            onTogglePrune={!storyboardRunning ? handleTogglePrune : undefined}
          />
        </>
      )}

      {/* Hidden file input for image replace */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Crop dialog */}
      {cropTarget && (
        <ImageCropDialog
          imageSrc={recropPageSrc ?? `${BASE_URL}/books/${bookLabel}/images/${cropTarget}`}
          onApply={handleCropApply}
          onClose={() => { setCropTarget(null); setRecropPageSrc(null) }}
        />
      )}

      {/* AI image dialog */}
      {aiImageTarget && (
        <AiImageDialog
          currentImageSrc={`${BASE_URL}/books/${bookLabel}/images/${aiImageTarget}`}
          imageId={aiImageTarget}
          bookLabel={bookLabel}
          onSubmit={handleAiImageSubmit}
          onClose={() => setAiImageTarget(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Activity Answer Key — shows answers with context from rendered HTML
// ---------------------------------------------------------------------------

function ActivityAnswerKey({
  answers,
  renderedHtml,
}: {
  answers: Record<string, string | boolean | number>
  renderedHtml?: string
}) {
  // Extract context for each answer item from the rendered HTML
  const contexts = renderedHtml ? extractAnswerContexts(renderedHtml) : new Map<string, string>()

  // Sort entries by item number (item-1, item-2, ...)
  const sorted = Object.entries(answers).sort(([a], [b]) => {
    const na = parseInt(a.replace(/\D/g, ""), 10)
    const nb = parseInt(b.replace(/\D/g, ""), 10)
    if (!isNaN(na) && !isNaN(nb)) return na - nb
    return a.localeCompare(b)
  })

  return (
    <div>
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
