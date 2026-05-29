import { useState, useEffect, useMemo } from "react"
import { Image as ImageIcon } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { api } from "@/api/client"
import { usePage, usePageImage } from "@/hooks/use-pages"
import { invalidateStoryboardDependents } from "@/hooks/use-page-mutations"
import { StageEmptyState } from "../../../components/StageEmptyState"
import { useLingui } from "@lingui/react/macro"
import { CaptionCard } from "./CaptionCard"
import { VersionPicker } from "./VersionPicker"
import { matchesDecorativeFilter, matchesSearch, buildImageSectionMap } from "../lib/utils"
import type {
  CaptioningData,
  CaptionEntry,
  CaptionGroup,
  DecorativeFilter,
  LightboxEntry,
} from "../lib/types"

export function PageCaptions({
  bookLabel,
  pageId,
  pageNumber,
  textPreview,
  emptyState,
  filterSectionIndex,
  decorativeFilter,
  searchQuery,
  onOpenLightbox,
  toolbarHeight,
}: {
  bookLabel: string
  pageId: string
  pageNumber: number
  textPreview?: string
  emptyState?: React.ReactNode
  filterSectionIndex?: number
  decorativeFilter: DecorativeFilter
  searchQuery: string
  onOpenLightbox: (entries: LightboxEntry[], index: number) => void
  toolbarHeight: number
}) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const { data: page } = usePage(bookLabel, pageId)
  const { data: pageImage } = usePageImage(bookLabel, pageId)

  const [pending, setPending] = useState<CaptioningData | null>(null)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<{ imageId: string; draft: string } | null>(null)

  useEffect(() => {
    setPending(null)
    setEditing(null)
  }, [page?.versions.imageCaptioning])

  const effective = pending ?? page?.imageCaptioning
  const captions = effective?.captions ?? []
  const dirty = pending != null

  const visibleCaptions = useMemo(
    () =>
      captions.filter(
        (c) => matchesDecorativeFilter(c, decorativeFilter) && matchesSearch(c, searchQuery),
      ),
    [captions, decorativeFilter, searchQuery],
  )

  const imageSectionMap = useMemo(() => buildImageSectionMap(page), [page?.sectioningTree])

  const groups = useMemo(() => {
    const sections = page?.sectioningTree?.sections
    if (!sections || sections.length <= 1) {
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
    const result = Array.from(grouped.values()).sort((a, b) => a.sectionIndex - b.sectionIndex)
    if (unsectioned.length > 0) {
      result.push({ sectionIndex: -1, sectionType: undefined, captions: unsectioned })
    }
    return result
  }, [visibleCaptions, imageSectionMap, page?.sectioningTree?.sections])

  if (!page?.imageCaptioning || captions.length === 0) return emptyState ?? null
  if (visibleCaptions.length === 0) return emptyState ?? null

  const applyCaption = (imageId: string, newCaption: string) => {
    const base = pending ?? page.imageCaptioning
    if (!base) return
    setPending({
      ...base,
      captions: base.captions.map((c) =>
        c.imageId === imageId ? { ...c, caption: newCaption, source: "manual" } : c,
      ),
    })
  }

  const toggleDecorative = (imageId: string) => {
    const base = pending ?? page.imageCaptioning
    if (!base) return
    setPending({
      ...base,
      captions: base.captions.map((c) =>
        c.imageId === imageId ? { ...c, decorative: !c.decorative, source: "manual" } : c,
      ),
    })
  }

  const handleStartEdit = (cap: CaptionEntry) => {
    if (editing && editing.imageId !== cap.imageId) {
      applyCaption(editing.imageId, editing.draft)
    }
    setEditing({ imageId: cap.imageId, draft: cap.caption })
  }

  const handleChangeDraft = (value: string) => {
    setEditing((prev) => (prev ? { ...prev, draft: value } : prev))
  }

  const handleCommitEdit = () => {
    if (!editing) return
    applyCaption(editing.imageId, editing.draft)
    setEditing(null)
  }

  const handleCancelEdit = () => {
    setEditing(null)
  }

  const saveCaptions = async () => {
    if (!pending) return
    setSaving(true)
    const minDelay = new Promise((r) => setTimeout(r, 400))
    await api.updateImageCaptioning(bookLabel, pageId, pending)
    setPending(null)
    setEditing(null)
    await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "pages", pageId] })
    invalidateStoryboardDependents(queryClient, bookLabel)
    await minDelay
    setSaving(false)
  }

  const handlePreview = (data: unknown) => {
    setPending(data as CaptioningData)
  }

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

  const gridClass = "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"

  const pageImgSrc = pageImage?.imageBase64
    ? `data:image/png;base64,${pageImage.imageBase64}`
    : null

  const renderCard = (cap: CaptionEntry, list: CaptionEntry[]) => (
    <CaptionCard
      key={cap.imageId}
      bookLabel={bookLabel}
      cap={cap}
      list={list}
      editing={editing}
      onStartEdit={handleStartEdit}
      onChangeDraft={handleChangeDraft}
      onCommitEdit={handleCommitEdit}
      onCancelEdit={handleCancelEdit}
      onToggleDecorative={toggleDecorative}
      onOpenLightbox={onOpenLightbox}
      pageId={pageId}
      pageNumber={pageNumber}
    />
  )

  return (
    <section
      id={`page-${pageId}`}
      data-page-id={pageId}
      style={{ scrollMarginTop: toolbarHeight + 8 }}
    >
      <div className="-mx-4 px-4 py-2 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted ring-1 ring-border">
            {pageImgSrc ? (
              <img src={pageImgSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[9px] font-mono text-muted-foreground">{pageNumber}</span>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-foreground">
                {t`Page ${String(pageNumber)}`}
              </span>
              {filterSectionIndex != null && (
                <span className="text-[11px] text-muted-foreground">
                  {t`/ Section ${String(filterSectionIndex + 1)}`}
                </span>
              )}
              <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                {filteredCaptions.length === captions.length
                  ? t`${String(captions.length)} images`
                  : t`${String(filteredCaptions.length)} of ${String(captions.length)} images`}
              </span>
            </div>
            {textPreview && (
              <span className="text-[11px] text-muted-foreground/80 truncate max-w-[60ch]">
                {textPreview}
              </span>
            )}
          </div>
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
      </div>
      <div className="pt-4 pb-2">
        {filterSectionIndex != null ? (
          <div className={gridClass}>
            {filteredCaptions.map((cap) => renderCard(cap, filteredCaptions))}
          </div>
        ) : groups ? (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.sectionIndex} className="space-y-2">
                <div className="flex items-center gap-2 pl-0.5">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-teal-700/80 bg-teal-50 rounded-full px-2 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                    {group.sectionIndex >= 0
                      ? group.sectionType
                        ? t`Section ${String(group.sectionIndex + 1)} — ${group.sectionType}`
                        : t`Section ${String(group.sectionIndex + 1)}`
                      : t`Other images`}
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {t`${String(group.captions.length)} images`}
                  </span>
                </div>
                <div className={gridClass}>
                  {group.captions.map((cap) => renderCard(cap, group.captions))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={gridClass}>
            {filteredCaptions.map((cap) => renderCard(cap, filteredCaptions))}
          </div>
        )}
      </div>
    </section>
  )
}
