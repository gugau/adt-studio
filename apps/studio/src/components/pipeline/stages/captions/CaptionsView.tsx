import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Check, ChevronDown, Eye, EyeOff, Image as ImageIcon, Info, Loader2, X } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { api, BASE_URL } from "@/api/client"
import type { PageDetail, VersionEntry } from "@/api/client"
import type { ContentNodeData } from "@adt/types"
import { usePages, usePage } from "@/hooks/use-pages"
import { useStepHeader } from "../../components/StepViewRouter"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { invalidateStoryboardDependents } from "@/hooks/use-page-mutations"
import { StageRunCard } from "../../components/StageRunCard"
import { StageEmptyState } from "../../components/StageEmptyState"
import { useSectionNav } from "@/routes/books.$label"
import { Trans } from "@lingui/react/macro"
import { useLingui } from "@lingui/react/macro"


type CaptioningData = NonNullable<PageDetail["imageCaptioning"]>
type CaptionEntry = CaptioningData["captions"][number]

type DecorativeFilter = "all" | "captioned" | "decorative"

function matchesDecorativeFilter(cap: CaptionEntry, filter: DecorativeFilter): boolean {
  if (filter === "captioned") return cap.decorative !== true
  if (filter === "decorative") return cap.decorative === true
  return true
}

const CAPTIONS_HINT_KEY = "adt-studio-captions-hint-dismissed"

/** Dismissible banner explaining that captions are AI-generated and editable. */
function CaptionsHint() {
  const { t } = useLingui()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(CAPTIONS_HINT_KEY) === "1"
    } catch {
      return false
    }
  })

  if (dismissed) return null

  const dismiss = () => {
    try {
      localStorage.setItem(CAPTIONS_HINT_KEY, "1")
    } catch {
      // localStorage unavailable
    }
    setDismissed(true)
  }

  return (
    <div className="flex gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3">
      <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-[13px] font-medium text-teal-800">
          <Trans>These captions were generated automatically</Trans>
        </span>
        <span className="text-[12px] text-teal-700 leading-relaxed">
          <Trans>
            Click any caption to edit it, or mark an image as decorative to hide it from screen
            readers when it doesn't need a caption. Changes are saved as a new version, so you can
            always roll back.
          </Trans>
        </span>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t`Dismiss`}
        className="shrink-0 -mr-1 -mt-1 rounded p-1 text-teal-600 hover:bg-teal-100 hover:text-teal-800 transition-colors cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function VersionPicker({
  currentVersion,
  saving,
  dirty,
  bookLabel,
  itemId,
  onPreview,
  onSave,
  onDiscard,
}: {
  currentVersion: number | null
  saving: boolean
  dirty: boolean
  bookLabel: string
  itemId: string
  onPreview: (data: unknown) => void
  onSave: () => void
  onDiscard: () => void
}) {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  const [versions, setVersions] = useState<VersionEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const handleOpen = async () => {
    if (saving || currentVersion == null) return
    setOpen(true)
    setLoading(true)
    const res = await api.getVersionHistory(bookLabel, "image-captioning", itemId, true)
    setVersions(res.versions)
    setLoading(false)
  }

  const handlePick = (v: VersionEntry) => {
    if (v.version === currentVersion && !dirty) {
      setOpen(false)
      return
    }
    setOpen(false)
    onPreview(v.data)
  }

  if (saving) {
    return <Loader2 className="h-3 w-3 animate-spin" />
  }

  if (currentVersion == null) return null

  if (dirty) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onDiscard}
          className="text-[10px] font-medium rounded px-2 py-0.5 bg-muted hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
        >
          {t`Discard`}
        </button>
        <button
          type="button"
          onClick={onSave}
          className="flex items-center gap-1 text-[10px] font-medium rounded px-2 py-0.5 bg-green-600 hover:bg-green-500 text-white cursor-pointer transition-colors"
        >
          <Check className="h-3 w-3" />
          {t`Save`}
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-0.5 text-[10px] font-normal normal-case tracking-normal bg-muted hover:bg-muted/80 rounded px-1.5 py-0.5 transition-colors"
      >
        v{currentVersion}
        <ChevronDown className="h-2.5 w-2.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-popover border rounded shadow-md min-w-[80px] py-1">
          {loading ? (
            <div className="flex items-center justify-center py-2 px-3">
              <Loader2 className="h-3 w-3 animate-spin" />
            </div>
          ) : versions && versions.length > 0 ? (
            versions.map((v) => (
              <button
                key={v.version}
                type="button"
                onClick={() => handlePick(v)}
                className={`w-full text-left px-3 py-1 text-xs hover:bg-accent transition-colors ${
                  v.version === currentVersion ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                v{v.version}
              </button>
            ))
          ) : (
            <div className="px-3 py-1 text-xs text-muted-foreground">{t`No versions`}</div>
          )}
        </div>
      )}
    </div>
  )
}

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
  captions: CaptionEntry[]
}

function PageCaptions({
  bookLabel,
  pageId,
  pageNumber,
  emptyState,
  largeImages,
  filterSectionIndex,
  decorativeFilter,
}: {
  bookLabel: string
  pageId: string
  pageNumber: number
  emptyState?: React.ReactNode
  largeImages?: boolean
  filterSectionIndex?: number
  decorativeFilter: DecorativeFilter
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

  // Apply the show/hide decorative filter (display only — editing still
  // operates on the full caption list).
  const visibleCaptions = useMemo(
    () => captions.filter((c) => matchesDecorativeFilter(c, decorativeFilter)),
    [captions, decorativeFilter]
  )

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
    const unsectioned: CaptionEntry[] = []
    for (const cap of visibleCaptions) {
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
  }, [visibleCaptions, imageSectionMap, page?.sectioningTree?.sections])

  if (!page?.imageCaptioning || captions.length === 0) return emptyState ?? null
  // Nothing matches the active filter on this page — drop it from the gallery.
  if (visibleCaptions.length === 0) return emptyState ?? null

  const updateCaption = (imageId: string, newCaption: string) => {
    const base = pending ?? page.imageCaptioning
    if (!base) return
    setPending({
      ...base,
      captions: base.captions.map((c) =>
        c.imageId === imageId ? { ...c, caption: newCaption, source: "manual" } : c
      ),
    })
  }

  const toggleDecorative = (imageId: string) => {
    const base = pending ?? page.imageCaptioning
    if (!base) return
    setPending({
      ...base,
      captions: base.captions.map((c) =>
        c.imageId === imageId ? { ...c, decorative: !c.decorative, source: "manual" } : c
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
    ? visibleCaptions.filter((cap) => imageSectionMap.get(cap.imageId) === filterSectionIndex)
    : visibleCaptions

  if (filterSectionIndex != null && filteredCaptions.length === 0) {
    return (
      <StageEmptyState
        icon={ImageIcon}
        color="teal"
        title={t`No images in this section`}
      />
    )
  }

  const gridClass = largeImages
    ? "grid grid-cols-1 sm:grid-cols-2 gap-3"
    : "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
  const imgHeightClass = largeImages ? "h-64" : "h-44"

  const renderCaption = (cap: CaptionEntry) => {
    const isDecorative = cap.decorative === true
    return (
      <div
        key={cap.imageId}
        className={`flex flex-col rounded-lg border bg-card overflow-hidden ${
          isDecorative ? "border-dashed border-amber-300" : ""
        }`}
      >
        <img
          src={`${BASE_URL}/books/${bookLabel}/images/${cap.imageId}`}
          alt={isDecorative ? "" : cap.caption}
          aria-hidden={isDecorative || undefined}
          className={`w-full ${imgHeightClass} bg-muted object-contain block ${
            isDecorative ? "opacity-60" : ""
          }`}
        />
        <div className="flex flex-1 flex-col gap-1.5 p-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-teal-600">{cap.imageId}</span>
            <button
              type="button"
              onClick={() => toggleDecorative(cap.imageId)}
              aria-pressed={isDecorative}
              title={t`Decorative images are hidden from screen readers and don't need a caption`}
              className={`ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
                isDecorative
                  ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {isDecorative ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
              {t`Decorative`}
            </button>
          </div>
          {isDecorative ? (
            <p className="flex flex-1 items-center rounded-md border border-dashed border-amber-200 bg-amber-50/60 p-2 text-[11px] leading-relaxed text-amber-700">
              <Trans>Marked as decorative — hidden from screen readers, no caption needed.</Trans>
            </p>
          ) : (
            <textarea
              value={cap.caption}
              onChange={(e) => updateCaption(cap.imageId, e.target.value)}
              aria-label={t`Caption for ${cap.imageId}`}
              className="w-full flex-1 text-sm text-foreground leading-relaxed resize-none rounded-md border border-input bg-background p-2 hover:border-ring/60 focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
              rows={3}
            />
          )}
        </div>
      </div>
    )
  }

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
            currentVersion={page.versions.imageCaptioning}
            saving={saving}
            dirty={dirty}
            bookLabel={bookLabel}
            itemId={pageId}
            onPreview={handlePreview}
            onSave={saveCaptions}
            onDiscard={() => setPending(null)}
          />
        </div>
      </div>
      {filterSectionIndex != null ? (
        // Filtered to a specific section — flat gallery
        <div className={gridClass}>{filteredCaptions.map(renderCaption)}</div>
      ) : groups ? (
        // Grouped by section — gallery per section
        groups.map((group) => (
          <div key={group.sectionIndex} className="space-y-1.5">
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
            <div className={gridClass}>{group.captions.map(renderCaption)}</div>
          </div>
        ))
      ) : (
        // Single section or no sectioning — flat gallery
        <div className={gridClass}>{filteredCaptions.map(renderCaption)}</div>
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
  const [decorativeFilter, setDecorativeFilter] = useState<DecorativeFilter>("all")

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
      <StageEmptyState
        icon={ImageIcon}
        color="teal"
        title={t`No images on this page`}
        cta={
          <button
            type="button"
            onClick={() => onSelectPage?.(null)}
            className="text-xs font-medium text-teal-600 hover:text-teal-700 hover:underline transition-colors"
          >
            {t`Show all`}
          </button>
        }
      />
    )
  }

  const singlePageEmptyState = selectedPageId ? (
    <StageEmptyState
      icon={ImageIcon}
      color="teal"
      title={t`No captions for this page`}
      subtitle={t`This page has no captioned images`}
    />
  ) : undefined

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="px-4 pt-3">
        <CaptionsHint />
      </div>
      <div className="flex items-center gap-2 px-4">
        <span className="text-[11px] font-medium text-muted-foreground">{t`Show`}</span>
        <div className="inline-flex items-center rounded-md border bg-muted/40 p-0.5">
          {([
            { value: "all", label: t`All` },
            { value: "captioned", label: t`Captioned` },
            { value: "decorative", label: t`Decorative` },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDecorativeFilter(opt.value)}
              aria-pressed={decorativeFilter === opt.value}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                decorativeFilter === opt.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {selectedPageId && (
          <button
            type="button"
            onClick={() => onSelectPage?.(null)}
            className="ml-auto text-xs font-medium text-teal-600 hover:text-teal-700 hover:underline transition-colors"
          >
            {t`Show all`}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-4 px-4 pb-4">
        {displayPages.map((page) => (
          <PageCaptions
            key={page.pageId}
            bookLabel={bookLabel}
            pageId={page.pageId}
            pageNumber={page.pageNumber}
            emptyState={singlePageEmptyState}
            largeImages={!!selectedPageId}
            filterSectionIndex={page.pageId === selectedPageId ? filterSectionIndex : undefined}
            decorativeFilter={decorativeFilter}
          />
        ))}
      </div>
    </div>
  )
}
