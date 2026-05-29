import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Image as ImageIcon, Loader2, Search, X } from "lucide-react"
import { useQueryClient, useQueries } from "@tanstack/react-query"
import { api } from "@/api/client"
import type { PageDetail } from "@/api/client"
import { usePages } from "@/hooks/use-pages"
import { useStepHeader } from "../../components/StepViewRouter"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { StageRunCard } from "../../components/StageRunCard"
import { StageEmptyState } from "../../components/StageEmptyState"
import { useSectionNav } from "@/routes/books.$label"
import { useLingui } from "@lingui/react/macro"
import { CaptionsHintBanner } from "./components/CaptionsHintBanner"
import { PageCaptions } from "./components/PageCaptions"
import { PageJumper } from "./components/PageJumper"
import { Lightbox } from "./components/Lightbox"
import type { CaptioningData, DecorativeFilter, LightboxEntry, PageJumperEntry } from "./lib/types"

const TOOLBAR_HEIGHT = 64

export function CaptionsView({ bookLabel, selectedPageId, onSelectPage }: { bookLabel: string; selectedPageId?: string; onSelectPage?: (pageId: string | null) => void }) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
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
  const [searchQuery, setSearchQuery] = useState("")
  const [lightbox, setLightbox] = useState<{ entries: LightboxEntry[]; index: number } | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [activePageId, setActivePageId] = useState<string | null>(null)

  const handleRunCaptions = useCallback(() => {
    if (!hasApiKey || captionsRunning) return
    queueRun({ fromStage: "captions", toStage: "captions", apiKey })
  }, [hasApiKey, captionsRunning, apiKey, queueRun])

  const pagesWithImages = useMemo(
    () => (pages ?? []).filter((p) => p.imageCount > 0),
    [pages],
  )
  const hasCaptionData = pagesWithImages.some((p) => p.hasCaptioning)

  const displayPages = selectedPageId
    ? pagesWithImages.filter((p) => p.pageId === selectedPageId)
    : pagesWithImages
  const totalImages = displayPages.reduce((sum, p) => sum + p.imageCount, 0)

  const selectedPageSummary = selectedPageId
    ? (pages ?? []).find((p) => p.pageId === selectedPageId)
    : null
  const hasSections = selectedPageSummary && selectedPageSummary.sectionCount > 1
  const filterSectionIndex = selectedPageId && hasSections ? sectionIndex : undefined

  const pageDetailQueries = useQueries({
    queries: displayPages.map((p) => ({
      queryKey: ["books", bookLabel, "pages", p.pageId],
      queryFn: () => api.getPage(bookLabel, p.pageId),
      enabled: !!bookLabel && hasCaptionData,
    })),
  })

  const pageImageQueries = useQueries({
    queries: displayPages.map((p) => ({
      queryKey: ["books", bookLabel, "pages", p.pageId, "image"],
      queryFn: () => api.getPageImage(bookLabel, p.pageId),
      enabled: !!bookLabel && hasCaptionData,
      staleTime: Infinity,
    })),
  })

  const aggregateCounts = useMemo(() => {
    let total = 0
    let captioned = 0
    let decorative = 0
    for (const q of pageDetailQueries) {
      const captions = q.data?.imageCaptioning?.captions ?? []
      for (const c of captions) {
        total += 1
        if (c.decorative === true) decorative += 1
        else captioned += 1
      }
    }
    return { total, captioned, decorative }
  }, [pageDetailQueries])

  const pageJumperEntries: PageJumperEntry[] = useMemo(
    () =>
      displayPages.map((p, idx) => {
        const detail = pageDetailQueries[idx]?.data
        const captions = detail?.imageCaptioning?.captions ?? []
        let decorativeCount = 0
        let captionedCount = 0
        for (const c of captions) {
          if (c.decorative === true) decorativeCount += 1
          else captionedCount += 1
        }
        const imgData = pageImageQueries[idx]?.data?.imageBase64
        return {
          pageId: p.pageId,
          pageNumber: p.pageNumber,
          textPreview: p.textPreview,
          imageCount: p.imageCount,
          thumbnail: imgData ? `data:image/png;base64,${imgData}` : null,
          stats: detail?.imageCaptioning
            ? { total: captions.length, captioned: captionedCount, decorative: decorativeCount }
            : undefined,
        }
      }),
    [displayPages, pageDetailQueries, pageImageQueries],
  )

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
      </>,
    )
    return () => setExtra(null)
  }, [pages, totalImages, displayPages.length, setExtra, selectedPageId, selectedPageSummary, hasSections, sectionIndex, setSectionIndex, t])

  useEffect(() => {
    if (!scrollContainerRef.current || displayPages.length === 0) return
    const root = scrollContainerRef.current
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.boundingClientRect.top ?? 0) - (b.boundingClientRect.top ?? 0))[0]
        if (visible) {
          const id = (visible.target as HTMLElement).dataset.pageId
          if (id) setActivePageId(id)
        }
      },
      { root, rootMargin: `-${TOOLBAR_HEIGHT + 40}px 0px -60% 0px`, threshold: 0 },
    )
    const sections = root.querySelectorAll<HTMLElement>("section[data-page-id]")
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [displayPages])

  const handleJumpToPage = useCallback((pageId: string) => {
    const root = scrollContainerRef.current
    if (!root) return
    const section = root.querySelector<HTMLElement>(`section[data-page-id="${pageId}"]`)
    if (section) section.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const handleOpenLightbox = useCallback((entries: LightboxEntry[], index: number) => {
    setLightbox({ entries, index })
  }, [])

  const handleLightboxNavigate = useCallback((next: number) => {
    setLightbox((prev) => (prev ? { ...prev, index: next } : prev))
  }, [])

  const handleLightboxCaptionChange = useCallback(
    async (entry: LightboxEntry, newCaption: string) => {
      const pageData = await queryClient.fetchQuery({
        queryKey: ["books", bookLabel, "pages", entry.pageId],
        queryFn: () => api.getPage(bookLabel, entry.pageId),
      })
      if (!pageData?.imageCaptioning) return
      const next: CaptioningData = {
        ...pageData.imageCaptioning,
        captions: pageData.imageCaptioning.captions.map((c) =>
          c.imageId === entry.cap.imageId ? { ...c, caption: newCaption, source: "manual" } : c,
        ),
      }
      queryClient.setQueryData<PageDetail>(["books", bookLabel, "pages", entry.pageId], (prev) =>
        prev ? { ...prev, imageCaptioning: next } : prev,
      )
      setLightbox((prev) => {
        if (!prev) return prev
        const updated = prev.entries.map((e) =>
          e.cap.imageId === entry.cap.imageId
            ? { ...e, cap: { ...e.cap, caption: newCaption, source: "manual" as const } }
            : e,
        )
        return { ...prev, entries: updated }
      })
    },
    [bookLabel, queryClient],
  )

  const handleLightboxToggleDecorative = useCallback(
    async (entry: LightboxEntry) => {
      const pageData = await queryClient.fetchQuery({
        queryKey: ["books", bookLabel, "pages", entry.pageId],
        queryFn: () => api.getPage(bookLabel, entry.pageId),
      })
      if (!pageData?.imageCaptioning) return
      const isDecorative = !entry.cap.decorative
      const next: CaptioningData = {
        ...pageData.imageCaptioning,
        captions: pageData.imageCaptioning.captions.map((c) =>
          c.imageId === entry.cap.imageId
            ? { ...c, decorative: isDecorative, source: "manual" }
            : c,
        ),
      }
      queryClient.setQueryData<PageDetail>(["books", bookLabel, "pages", entry.pageId], (prev) =>
        prev ? { ...prev, imageCaptioning: next } : prev,
      )
      setLightbox((prev) => {
        if (!prev) return prev
        const updated = prev.entries.map((e) =>
          e.cap.imageId === entry.cap.imageId
            ? { ...e, cap: { ...e.cap, decorative: isDecorative, source: "manual" as const } }
            : e,
        )
        return { ...prev, entries: updated }
      })
    },
    [bookLabel, queryClient],
  )

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

  const chipBase =
    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-all duration-200 cursor-pointer"

  return (
    <div ref={scrollContainerRef} className="flex flex-1 flex-col overflow-y-auto">
      <CaptionsHintBanner />
      <div
        className="sticky top-0 z-20 flex items-center gap-3 px-6 py-3 bg-background/95 backdrop-blur-md border-b border-border/60"
        style={{ height: TOOLBAR_HEIGHT }}
      >
        <div className="inline-flex items-center rounded-lg border border-border/70 bg-muted/40 p-0.5">
          {([
            { value: "all", label: t`All`, count: aggregateCounts.total },
            { value: "captioned", label: t`Captioned`, count: aggregateCounts.captioned },
            { value: "decorative", label: t`Decorative`, count: aggregateCounts.decorative },
          ] as const).map((opt) => {
            const active = decorativeFilter === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDecorativeFilter(opt.value)}
                aria-pressed={active}
                className={`${chipBase} ${
                  active
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{opt.label}</span>
                <span
                  className={`tabular-nums text-[11px] ${
                    active
                      ? opt.value === "decorative"
                        ? "text-amber-600"
                        : "text-teal-700"
                      : "text-muted-foreground/60"
                  }`}
                >
                  {opt.count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t`Search captions or image IDs…`}
            className="w-full h-8 rounded-md border border-border/70 bg-background pl-8 pr-8 text-[12px] placeholder:text-muted-foreground/60 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label={t`Clear search`}
              className="absolute right-1 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {selectedPageId && (
            <button
              type="button"
              onClick={() => onSelectPage?.(null)}
              className="text-[12px] font-medium text-teal-600 hover:text-teal-700 hover:underline transition-colors"
            >
              {t`Show all pages`}
            </button>
          )}
          {!selectedPageId && displayPages.length > 1 && (
            <PageJumper
              pages={pageJumperEntries}
              activePageId={activePageId}
              onJump={handleJumpToPage}
            />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-8 px-4 pb-12 pt-3">
        {displayPages.map((page) => (
          <PageCaptions
            key={page.pageId}
            bookLabel={bookLabel}
            pageId={page.pageId}
            pageNumber={page.pageNumber}
            textPreview={page.textPreview}
            emptyState={singlePageEmptyState}
            filterSectionIndex={page.pageId === selectedPageId ? filterSectionIndex : undefined}
            decorativeFilter={decorativeFilter}
            searchQuery={searchQuery}
            onOpenLightbox={handleOpenLightbox}
            toolbarHeight={TOOLBAR_HEIGHT}
          />
        ))}
      </div>

      {lightbox && (
        <Lightbox
          bookLabel={bookLabel}
          entries={lightbox.entries}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={handleLightboxNavigate}
          onCaptionChange={handleLightboxCaptionChange}
          onToggleDecorative={handleLightboxToggleDecorative}
        />
      )}
    </div>
  )
}
