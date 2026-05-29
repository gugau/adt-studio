import { useState, useEffect, useRef, useMemo } from "react"
import { ChevronDown, Search } from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import type { PageJumperEntry } from "../lib/types"

export function PageJumper({
  pages,
  activePageId,
  onJump,
}: {
  pages: PageJumperEntry[]
  activePageId: string | null
  onJump: (pageId: string) => void
}) {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [highlightIndex, setHighlightIndex] = useState(0)

  const activePage = pages.find((p) => p.pageId === activePageId) ?? pages[0]

  const filteredPages = useMemo(() => {
    if (!query.trim()) return pages
    const q = query.toLowerCase().trim()
    return pages.filter(
      (p) =>
        String(p.pageNumber).includes(q) ||
        p.textPreview.toLowerCase().includes(q),
    )
  }, [pages, query])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  useEffect(() => {
    if (open && activePage) {
      const idx = filteredPages.findIndex((p) => p.pageId === activePage.pageId)
      setHighlightIndex(Math.max(0, idx))
      setQuery("")
    }
  }, [open, activePage, filteredPages])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        setHighlightIndex((i) => Math.min(filteredPages.length - 1, i + 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setHighlightIndex((i) => Math.max(0, i - 1))
      } else if (e.key === "Enter") {
        e.preventDefault()
        const target = filteredPages[highlightIndex]
        if (target) {
          onJump(target.pageId)
          setOpen(false)
        }
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, filteredPages, highlightIndex, onJump])

  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${highlightIndex}"]`)
    if (el) el.scrollIntoView({ block: "nearest" })
  }, [open, highlightIndex])

  if (pages.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/70 bg-background pl-2.5 pr-2 text-[12px] font-medium text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
      >
        <span className="text-muted-foreground">{t`Page`}</span>
        <span className="tabular-nums">
          {activePage ? activePage.pageNumber : "—"}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-30 w-96 rounded-lg border border-border bg-popover shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="relative border-b border-border/60 p-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t`Filter pages…`}
              autoFocus
              className="w-full h-8 rounded-md bg-muted/40 pl-8 pr-3 text-[12px] placeholder:text-muted-foreground/60 focus:bg-background focus:outline-none focus:ring-2 focus:ring-teal-200 transition-colors"
            />
          </div>
          <div ref={listRef} className="max-h-[420px] overflow-y-auto py-1">
            {filteredPages.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-muted-foreground">
                <Trans>No matching pages</Trans>
              </div>
            ) : (
              filteredPages.map((p, idx) => {
                const isActive = p.pageId === activePage?.pageId
                const isHighlighted = idx === highlightIndex
                return (
                  <button
                    key={p.pageId}
                    type="button"
                    data-idx={idx}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    onClick={() => {
                      onJump(p.pageId)
                      setOpen(false)
                    }}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-100 ${
                      isHighlighted
                        ? "bg-teal-50 text-foreground"
                        : "hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <div className="flex h-10 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-muted ring-1 ring-border">
                      {p.thumbnail ? (
                        <img src={p.thumbnail} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[9px] font-mono text-muted-foreground">{p.pageNumber}</span>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[12px] font-semibold tabular-nums ${isActive ? "text-teal-700" : "text-foreground"}`}>
                          {t`Page ${String(p.pageNumber)}`}
                        </span>
                        {isActive && (
                          <span className="text-[9px] uppercase tracking-wider text-teal-600 font-semibold">
                            <Trans>Current</Trans>
                          </span>
                        )}
                      </div>
                      {p.textPreview && (
                        <span className="text-[11px] text-muted-foreground/80 truncate">
                          {p.textPreview}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end shrink-0 gap-0.5">
                      <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                        {t`${String(p.imageCount)} img`}
                      </span>
                      {p.stats && p.stats.decorative > 0 && (
                        <span className="text-[9px] text-amber-600 font-medium tabular-nums">
                          {t`${String(p.stats.decorative)} decorative`}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
