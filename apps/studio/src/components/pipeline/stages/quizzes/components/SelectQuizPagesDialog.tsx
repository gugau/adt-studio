import { useState } from "react"
import { Check, FileText, X, Search, Loader2 } from "lucide-react"
import { usePages } from "@/hooks/use-pages"
import { useLingui } from "@lingui/react/macro"

interface SelectQuizPagesDialogProps {
  bookLabel: string
  initialSelected: string[]
  onConfirm: (pageIds: string[]) => void
  onClose: () => void
}

/**
 * Dialog that lets the user pick which pages should be included in quiz generation.
 * Source list comes from /books/:label/pages. The order of page IDs in the
 * returned array matches the order pages appear in the book.
 */
export function SelectQuizPagesDialog({
  bookLabel,
  initialSelected,
  onConfirm,
  onClose,
}: SelectQuizPagesDialogProps) {
  const { t } = useLingui()
  const [filter, setFilter] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected))

  const pagesQuery = usePages(bookLabel)

  const filtered = pagesQuery.data?.filter((page) => {
    if (!filter) return true
    const f = filter.toLowerCase()
    return (
      page.pageId.toLowerCase().includes(f) ||
      String(page.pageNumber).includes(f) ||
      page.textPreview.toLowerCase().includes(f)
    )
  })

  const toggleAll = () => {
    if (!filtered) return
    if (filtered.every((page) => selected.has(page.pageId))) {
      setSelected((prev) => {
        const next = new Set(prev)
        for (const page of filtered) next.delete(page.pageId)
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        for (const page of filtered) next.add(page.pageId)
        return next
      })
    }
  }

  const toggleOne = (pageId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(pageId)) next.delete(pageId)
      else next.add(pageId)
      return next
    })
  }

  const handleConfirm = () => {
    const ordered = (pagesQuery.data ?? [])
      .filter((page) => selected.has(page.pageId))
      .map((page) => page.pageId)
    onConfirm(ordered)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-8">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-semibold">{t`Select pages for quizzes`}</h2>
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
          <p className="text-xs text-muted-foreground">
            {t`Pick the pages you want to base quiz questions on. Selected pages are still grouped according to "Pages per quiz".`}
          </p>

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
            {filtered && filtered.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs font-medium rounded px-3 py-2 bg-muted hover:bg-accent transition-colors cursor-pointer whitespace-nowrap"
              >
                {filtered.every((page) => selected.has(page.pageId))
                  ? t`Deselect all`
                  : t`Select all`}
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

          {filtered && filtered.length === 0 && !pagesQuery.isLoading && (
            <p className="text-center text-sm text-muted-foreground py-12">
              {filter ? t`No pages match your filter.` : t`No pages available.`}
            </p>
          )}

          {filtered && filtered.length > 0 && (
            <div className="rounded-md border divide-y">
              {filtered.map((page) => {
                const isSelected = selected.has(page.pageId)
                const isContent = page.sectionCount > page.prunedSections.length
                return (
                  <button
                    key={page.pageId}
                    type="button"
                    onClick={() => toggleOne(page.pageId)}
                    className={`w-full flex items-start gap-3 px-3 py-2 text-left transition-colors cursor-pointer ${
                      isSelected ? "bg-blue-500/10" : "hover:bg-muted/50"
                    }`}
                  >
                    <div
                      className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "bg-blue-500 border-blue-500"
                          : "border-input bg-background"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">
                          {t`Page ${String(page.pageNumber)}`}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {page.pageId}
                        </span>
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
            {selected.size === 1
              ? t`1 page selected`
              : t`${String(selected.size)} pages selected`}
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
              className="text-xs font-medium rounded px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-colors"
            >
              {t`Save selection`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
