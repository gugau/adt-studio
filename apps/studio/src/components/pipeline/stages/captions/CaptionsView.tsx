import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Image as ImageIcon, Loader2 } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { api, BASE_URL } from "@/api/client"
import type { PageDetail } from "@/api/client"
import type { ContentNodeData } from "@adt/types"
import { usePages, usePage } from "@/hooks/use-pages"
import { useStepHeader } from "../../components/StepViewRouter"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { invalidateStoryboardDependents } from "@/hooks/use-page-mutations"
import { StageRunCard } from "../../components/StageRunCard"
import { VersionPicker } from "../../components/VersionPicker"
import { useSectionNav } from "@/routes/books.$label"
import { Trans } from "@lingui/react/macro"
import { useLingui } from "@lingui/react/macro"


type CaptioningData = NonNullable<PageDetail["imageCaptioning"]>

/** Build a map from imageId → sectionIndex by walking each section's tree. */
function buildImageSectionMap(page: PageDetail | undefined): Map<string, number> {
  const map = new Map<string, number>()
  if (!page?.sectioningTree) return map
  const walk = (nodes: ContentNodeData[], sectionIdx: number) => {
    for (const node of nodes) {
      if (node.role === "image") map.set(node.nodeId, sectionIdx)
      else if (node.children) walk(node.children, sectionIdx)
    }
  }
  page.sectioningTree.sections.forEach((section, idx) => {
    walk(section.nodes, idx)
  })
  return map
}

interface CaptionGroup {
  sectionIndex: number
  sectionType?: string
  captions: Array<{ imageId: string; reasoning: string; caption: string }>
}

function PageCaptions({
  bookLabel,
  pageId,
  pageNumber,
  emptyState,
  largeImages,
  filterSectionIndex,
}: {
  bookLabel: string
  pageId: string
  pageNumber: number
  emptyState?: React.ReactNode
  largeImages?: boolean
  filterSectionIndex?: number
}) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const { data: page } = usePage(bookLabel, pageId)

  const [pending, setPending] = useState<CaptioningData | null>(null)
  const [saving, setSaving] = useState(false)

  // Reset pending when page data changes
  useEffect(() => {
    setPending(null)
  }, [page?.versions.imageCaptioning])

  const effective = pending ?? page?.imageCaptioning
  const captions = effective?.captions ?? []
  const dirty = pending != null

  // Map imageId → sectionIndex
  const imageSectionMap = useMemo(() => buildImageSectionMap(page), [page?.sectioningTree])

  // Group captions by section
  const groups = useMemo(() => {
    const sections = page?.sectioningTree?.sections
    if (!sections || sections.length <= 1) {
      // No sectioning or single section — flat list, no grouping
      return null
    }
    const grouped = new Map<number, CaptionGroup>()
    const unsectioned: Array<{ imageId: string; reasoning: string; caption: string }> = []
    for (const cap of captions) {
      const si = imageSectionMap.get(cap.imageId)
      if (si != null) {
        let group = grouped.get(si)
        if (!group) {
          group = {
            sectionIndex: si,
            sectionType: sections[si]?.sectionType,
            captions: [],
          }
          grouped.set(si, group)
        }
        group.captions.push(cap)
      } else {
        unsectioned.push(cap)
      }
    }
    // Sort by section index
    const result = Array.from(grouped.values()).sort((a, b) => a.sectionIndex - b.sectionIndex)
    if (unsectioned.length > 0) {
      result.push({ sectionIndex: -1, sectionType: undefined, captions: unsectioned })
    }
    return result
  }, [captions, imageSectionMap, page?.sectioningTree?.sections])

  if (!page?.imageCaptioning || captions.length === 0) return emptyState ?? null

  const updateCaption = (imageId: string, newCaption: string) => {
    const base = pending ?? page.imageCaptioning
    if (!base) return
    setPending({
      ...base,
      captions: base.captions.map((c) =>
        c.imageId === imageId ? { ...c, caption: newCaption } : c
      ),
    })
  }

  const saveCaptions = async () => {
    if (!pending) return
    setSaving(true)
    const minDelay = new Promise((r) => setTimeout(r, 400))
    await api.updateImageCaptioning(bookLabel, pageId, pending)
    setPending(null)
    await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "pages", pageId] })
    invalidateStoryboardDependents(queryClient, bookLabel)
    await minDelay
    setSaving(false)
  }

  const handlePreview = (data: unknown) => {
    setPending(data as CaptioningData)
  }

  // Filter captions by section when a section is selected
  const filteredCaptions = filterSectionIndex != null
    ? captions.filter((cap) => imageSectionMap.get(cap.imageId) === filterSectionIndex)
    : captions

  if (filterSectionIndex != null && filteredCaptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center mb-3">
          <ImageIcon className="w-6 h-6 text-teal-300" />
        </div>
        <p className="text-sm font-medium">{t`No images in this section`}</p>
      </div>
    )
  }

  const renderCaption = (cap: { imageId: string; reasoning: string; caption: string }) => (
    <div key={cap.imageId} className="flex items-start gap-4 rounded-md border bg-card overflow-hidden">
      <img
        src={`${BASE_URL}/books/${bookLabel}/images/${cap.imageId}`}
        alt={cap.caption}
        className={`shrink-0 self-stretch bg-muted object-cover block ${largeImages ? "w-96" : "w-48"}`}
      />
      <div className="flex-1 min-w-0 py-2.5 pr-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-medium text-teal-600">{cap.imageId}</span>
        </div>
        <textarea
          value={cap.caption}
          onChange={(e) => updateCaption(cap.imageId, e.target.value)}
          className="w-full text-sm text-foreground leading-relaxed resize-none rounded border border-transparent bg-transparent p-1.5 -ml-1.5 hover:border-border hover:bg-muted/30 focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
          rows={2}
        />
      </div>
    </div>
  )

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 px-1">
        <span className="text-sm font-medium text-foreground">
          {t`Page ${String(pageNumber)}`}
          {filterSectionIndex != null && (
            <span className="text-muted-foreground"> {t`/ Section ${String(filterSectionIndex + 1)}`}</span>
          )}
        </span>
        <div className="ml-auto">
          <VersionPicker
            step="image-captioning"
            itemId={pageId}
            currentVersion={page.versions.imageCaptioning}
            saving={saving}
            dirty={dirty}
            bookLabel={bookLabel}
            onPreview={handlePreview}
            onSave={saveCaptions}
            onDiscard={() => setPending(null)}
          />
        </div>
      </div>
      {filterSectionIndex != null ? (
        // Filtered to a specific section — flat list
        filteredCaptions.map(renderCaption)
      ) : groups ? (
        // Grouped by section
        groups.map((group) => (
          <div key={group.sectionIndex}>
            <div className="px-1 pt-1.5 pb-0.5">
              <span className="text-[9px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                {group.sectionIndex >= 0
                  ? group.sectionType
                    ? t`Section ${String(group.sectionIndex + 1)} — ${group.sectionType}`
                    : t`Section ${String(group.sectionIndex + 1)}`
                  : t`Other images`
                }
              </span>
            </div>
            {group.captions.map(renderCaption)}
          </div>
        ))
      ) : (
        // Single section or no sectioning — flat list
        filteredCaptions.map(renderCaption)
      )}
    </div>
  )
}

export function CaptionsView({ bookLabel, selectedPageId, onSelectPage }: { bookLabel: string; selectedPageId?: string; onSelectPage?: (pageId: string | null) => void }) {
  const { t } = useLingui()
  const { data: pages, isLoading } = usePages(bookLabel)
  const { setExtra } = useStepHeader()
  const { stageState, queueRun } = useBookRun()
  const { apiKey, hasApiKey } = useApiKey()
  const captionsState = stageState("captions")
  const captionsDone = captionsState === "done"
  const captionsRunning = captionsState === "running" || captionsState === "queued"
  const showRunCard = !captionsDone || captionsRunning
  const { sectionIndex, setSectionIndex } = useSectionNav()

  const handleRunCaptions = useCallback(() => {
    if (!hasApiKey || captionsRunning) return
    queueRun({ fromStage: "captions", toStage: "captions", apiKey })
  }, [hasApiKey, captionsRunning, apiKey, queueRun])

  const pagesWithImages = (pages ?? []).filter((p) => p.imageCount > 0)
  const hasCaptionData = pagesWithImages.some((p) => p.hasCaptioning)

  const displayPages = selectedPageId
    ? pagesWithImages.filter((p) => p.pageId === selectedPageId)
    : pagesWithImages
  const totalImages = displayPages.reduce((sum, p) => sum + p.imageCount, 0)

  // Determine if we should filter by section (only when a specific page is selected and it has sections)
  const selectedPageSummary = selectedPageId
    ? (pages ?? []).find((p) => p.pageId === selectedPageId)
    : null
  const hasSections = selectedPageSummary && selectedPageSummary.sectionCount > 1
  const filterSectionIndex = selectedPageId && hasSections
    ? sectionIndex
    : undefined

  useEffect(() => {
    if (!pages) return
    setExtra(
      <>
        {selectedPageSummary && (
          <>
            <span className="text-white/40 text-sm">/</span>
            <span className="text-sm font-medium">{t`Page ${String(selectedPageSummary.pageNumber)}`}</span>
            {hasSections && (
              <>
                <span className="text-white/40 text-sm">/</span>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: selectedPageSummary.sectionCount }, (_, i) => {
                    const pruned = selectedPageSummary.prunedSections?.includes(i)
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSectionIndex(i)}
                        className={`flex items-center justify-center min-w-[20px] h-5 px-1 rounded text-[10px] font-medium transition-colors ${
                          i === sectionIndex
                            ? pruned ? "bg-white/20 text-white/50 line-through decoration-white/40" : "bg-white/30 text-white"
                            : pruned ? "bg-white/5 text-white/30 line-through decoration-white/20 hover:bg-white/10 hover:text-white/50" : "bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
                        }`}
                        title={pruned ? t`Section ${String(i + 1)} (pruned)` : t`Section ${String(i + 1)}`}
                      >
                        {i + 1}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5">{t`${String(totalImages)} images`}</span>
          <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5">{t`${String(displayPages.length)} pages`}</span>
        </div>
      </>
    )
    return () => setExtra(null)
  }, [pages, totalImages, displayPages.length, setExtra, selectedPageId, selectedPageSummary?.pageNumber, selectedPageSummary?.sectionCount, hasSections, sectionIndex, setSectionIndex])

  if (!showRunCard && isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span className="text-sm">{t`Loading pages...`}</span>
      </div>
    )
  }

  if (showRunCard || pagesWithImages.length === 0 || !hasCaptionData) {
    return (
      <div className="p-4">
        <StageRunCard
          stageSlug="captions"
          isRunning={captionsRunning}
          completed={captionsDone}
          onRun={handleRunCaptions}
          disabled={!hasApiKey || captionsRunning}
        />
      </div>
    )
  }

  if (selectedPageId && displayPages.length === 0 && pagesWithImages.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center mb-3">
          <ImageIcon className="w-6 h-6 text-teal-300" />
        </div>
        <p className="text-sm font-medium">{t`No images on this page`}</p>
        <button
          type="button"
          onClick={() => onSelectPage?.(null)}
          className="mt-3 text-xs font-medium text-teal-600 hover:text-teal-700 hover:underline transition-colors"
        >
          {t`Show all`}
        </button>
      </div>
    )
  }

  const singlePageEmptyState = selectedPageId ? (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center mb-3">
        <ImageIcon className="w-6 h-6 text-teal-300" />
      </div>
      <p className="text-sm font-medium">{t`No captions for this page`}</p>
      <p className="text-xs mt-1">{t`This page has no captioned images`}</p>
    </div>
  ) : undefined

  return (
    <div className="space-y-4">
      {selectedPageId && (
        <div className="flex justify-end px-4 pt-3">
          <button
            type="button"
            onClick={() => onSelectPage?.(null)}
            className="text-xs font-medium text-teal-600 hover:text-teal-700 hover:underline transition-colors"
          >
            {t`Show all`}
          </button>
        </div>
      )}
      {displayPages.map((page) => (
        <PageCaptions
          key={page.pageId}
          bookLabel={bookLabel}
          pageId={page.pageId}
          pageNumber={page.pageNumber}
          emptyState={singlePageEmptyState}
          largeImages={!!selectedPageId}
          filterSectionIndex={page.pageId === selectedPageId ? filterSectionIndex : undefined}
        />
      ))}
    </div>
  )
}
