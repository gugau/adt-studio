import { useMemo, useState } from "react"
import { FileText, X, Search, Loader2 } from "lucide-react"
import { usePages } from "@/hooks/use-pages"
import { useLingui } from "@lingui/react/macro"

interface SelectQuizPagesDialogProps {
  bookLabel: string
  initialSelected: string[]
  onConfirm: (pageIds: string[]) => void
  onClose: () => void
}

/**
 * Range-only page picker. The user clicks two pages and the dialog selects
 * every page in between. Non-contiguous selection isn't possible by design —
 * a quiz built from "every second page" is rarely what anyone actually wants.
 *
 * Interaction model:
 *   - First click: anchor the range to a single page.
 *   - Second click: extend the range to that page; lower of the two becomes
 *     the start, higher becomes the end.
 *   - Third click: reset the range to that single page.
 */
export function SelectQuizPagesDialog({
  bookLabel,
  initialSelected,
  onConfirm,
  onClose,
}: SelectQuizPagesDialogProps) {
  const { t } = useLingui()
  const [filter, setFilter] = useState("")
  const pagesQuery = usePages(bookLabel)
  const pages = pagesQuery.data ?? []

  const indexById = useMemo(() => {
    const map = new Map<string, number>()
    for (let i = 0; i < pages.length; i++) map.set(pages[i].pageId, i)
    return map
  }, [pages])

  // Initial range from the props: take the lowest- and highest-indexed page
  // already selected. Pages between them that weren't in the initial set will
  // be included (the picker now enforces contiguous selection).
  const initialRange = useMemo(() => {
    if (initialSelected.length === 0) return null
    const indices = initialSelected
      .map((id) => indexById.get(id))
      .filter((idx): idx is number => idx !== undefined)
    if (indices.length === 0) return null
    const start = pages[Math.min(...indices)].pageId
    const end = pages[Math.max(...indices)].pageId
    return { start, end }
  }, [initialSelected, indexById, pages])

  const [rangeStart, setRangeStart] = useState<string | null>(initialRange?.start ?? null)
  const [rangeEnd, setRangeEnd] = useState<string | null>(initialRange?.end ?? null)

  const filtered = pages.filter((page) => {
    if (!filter) return true
    const f = filter.toLowerCase()
    return (
      page.pageId.toLowerCase().includes(f) ||
      String(page.pageNumber).includes(f) ||
      page.textPreview.toLowerCase().includes(f)
    )
  })

  const isInRange = (pageId: string): boolean => {
    if (!rangeStart || !rangeEnd) return false
    const idx = indexById.get(pageId)
    if (idx === undefined) return false
    const startIdx = indexById.get(rangeStart) ?? 0
    const endIdx = indexById.get(rangeEnd) ?? 0
    const min = Math.min(startIdx, endIdx)
    const max = Math.max(startIdx, endIdx)
    return idx >= min && idx <= max
  }

  const isAnchor = (pageId: string): boolean =>
    pageId === rangeStart || pageId === rangeEnd

  const handlePageClick = (pageId: string) => {
    // No anchor yet → set both endpoints to this page (range of 1).
    if (!rangeStart) {
      setRangeStart(pageId)
      setRangeEnd(pageId)
      return
    }
    // Anchor exists but range is a single page → extend to this page.
    if (rangeStart === rangeEnd) {
      setRangeEnd(pageId)
      return
    }
    // Multi-page range already set → start over from this page.
    setRangeStart(pageId)
    setRangeEnd(pageId)
  }

  const handleClear = () => {
    setRangeStart(null)
    setRangeEnd(null)
  }

  const selectedPageIds = useMemo(() => {
    if (!rangeStart || !rangeEnd) return []
    const startIdx = indexById.get(rangeStart)
    const endIdx = indexById.get(rangeEnd)
    if (startIdx === undefined || endIdx === undefined) return []
    const min = Math.min(startIdx, endIdx)
    const max = Math.max(startIdx, endIdx)
    return pages.slice(min, max + 1).map((p) => p.pageId)
  }, [rangeStart, rangeEnd, indexById, pages])

  const handleConfirm = () => {
    onConfirm(selectedPageIds)
  }

  const startPage = rangeStart ? pages.find((p) => p.pageId === rangeStart) : null
  const endPage = rangeEnd ? pages.find((p) => p.pageId === rangeEnd) : null
  const rangeLabel =
    startPage && endPage
      ? startPage.pageId === endPage.pageId
        ? t`Page ${String(startPage.pageNumber)}`
        : t`Pages ${String(Math.min(startPage.pageNumber, endPage.pageNumber))} – ${String(Math.max(startPage.pageNumber, endPage.pageNumber))}`
      : null

  const instruction =
    !rangeStart
      ? t`Click a page to set the start of the range.`
      : rangeStart === rangeEnd
        ? t`Click the last page to extend the range.`
        : t`Click any page to start a new range.`

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-8">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-semibold">{t`Choose a page range`}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-accent transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <p className="text-xs text-muted-foreground">{instruction}</p>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t`Filter by page number, ID, or text...`}
                className="w-full text-sm border rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            {rangeStart && (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs font-medium rounded px-3 py-2 bg-muted hover:bg-accent transition-colors cursor-pointer whitespace-nowrap"
              >
                {t`Clear`}
              </button>
            )}
          </div>

          {pagesQuery.isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {pagesQuery.isError && (
            <p className="text-center text-sm text-red-500 py-8">
              {t`Failed to load pages.`}
            </p>
          )}

          {filtered.length === 0 && !pagesQuery.isLoading && (
            <p className="text-center text-sm text-muted-foreground py-12">
              {filter ? t`No pages match your filter.` : t`No pages available.`}
            </p>
          )}

          {filtered.length > 0 && (
            <div className="rounded-md border divide-y">
              {filtered.map((page) => {
                const inRange = isInRange(page.pageId)
                const anchor = isAnchor(page.pageId)
                const isContent = page.sectionCount > page.prunedSections.length
                return (
                  <button
                    key={page.pageId}
                    type="button"
                    onClick={() => handlePageClick(page.pageId)}
                    className={`w-full flex items-start gap-3 px-3 py-2 text-left transition-colors cursor-pointer ${
                      anchor
                        ? "bg-blue-500/20 border-l-2 border-l-blue-500"
                        : inRange
                          ? "bg-blue-500/10"
                          : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">
                          {t`Page ${String(page.pageNumber)}`}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {page.pageId}
                        </span>
                        {anchor && (
                          <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
                            {page.pageId === rangeStart && page.pageId === rangeEnd
                              ? t`anchor`
                              : page.pageId === rangeStart
                                ? t`start`
                                : t`end`}
                          </span>
                        )}
                        {!isContent && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400">
                            {t`(non-content)`}
                          </span>
                        )}
                      </div>
                      {page.textPreview && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                          {page.textPreview}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-t shrink-0">
          <p className="text-[11px] text-muted-foreground">
            {rangeLabel
              ? selectedPageIds.length === 1
                ? rangeLabel
                : t`${rangeLabel} (${String(selectedPageIds.length)} pages)`
              : t`No range selected`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-medium rounded px-3 py-1.5 bg-muted hover:bg-accent transition-colors cursor-pointer"
            >
              {t`Cancel`}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedPageIds.length === 0}
              className="text-xs font-medium rounded px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t`Save selection`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
