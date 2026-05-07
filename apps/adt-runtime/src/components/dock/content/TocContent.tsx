import { useAtom, useAtomValue } from "jotai"
import { Fragment, useMemo } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  currentSectionIdAtom,
  pagesAtom,
  tocAtom,
  type PageEntry,
  type TocEntry,
} from "@/state/nav.atoms"
import { activeNavTabAtom } from "@/state/ui.atoms"
import { useTranslation } from "@/hooks/useTranslation"
import { cn } from "@/lib/utils"


export function TocContent() {
  const toc = useAtomValue(tocAtom)
  const pages = useAtomValue(pagesAtom)
  const currentSectionId = useAtomValue(currentSectionIdAtom)
  const [tab, setTab] = useAtom(activeNavTabAtom)
  const { t } = useTranslation()

  const tocEntries: TocEntry[] = useMemo(
    () =>
      toc.length > 0
        ? toc
        : pages.map((p) => ({
            section_id: p.section_id,
            href: p.href,
            title: p.section_id,
            chapter_id: p.section_id,
            level: undefined,
          })),
    [toc, pages],
  )

  return (
    <div className="flex flex-col w-[var(--dock-width,32rem)] max-w-[calc(100vw-2rem)]">
      <div className="px-3 py-2 border-b border-border">
        <h3 className="text-sm font-semibold">{t("toc-title") || "Contents"}</h3>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          if (typeof v === "string") setTab(v)
        }}
        className="flex flex-col"
      >
        <TabsList className="grid grid-cols-2 mx-3 mt-2 shrink-0">
          <TabsTrigger value="toc">
            {t("toc-title") || "Contents"}
          </TabsTrigger>
          <TabsTrigger value="pages">
            {t("nav-page-tab-label") || "Page list"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="toc" className="mt-1">
          <TocList entries={tocEntries} currentSectionId={currentSectionId} />
        </TabsContent>

        <TabsContent value="pages" className="mt-1">
          <PageList
            pages={pages}
            toc={toc}
            currentSectionId={currentSectionId}
            printPageLabel={t("print-page-label") || "Print Page"}
            coverLabel={t("cover-label") || "Cover"}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function TocList({
  entries,
  currentSectionId,
}: {
  entries: TocEntry[]
  currentSectionId: string | null
}) {
  return (
    <ul className="py-1 max-h-[28rem] overflow-y-auto [scrollbar-gutter:stable]">
      {entries.map((entry) => {
        const active = entry.section_id === currentSectionId
        return (
          <li key={entry.section_id}>
            <button
              type="button"
              onClick={() => {
                window.location.href = entry.href
              }}
              className={cn(
                "w-full text-left rounded-md mx-1 px-2.5 py-1.5 text-sm",
                "hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none focus:bg-accent focus:text-accent-foreground",
                active && "bg-accent text-accent-foreground font-medium",
                entry.level === 2 && "pl-6",
                entry.level === 3 && "pl-9",
              )}
              aria-current={active ? "page" : undefined}
            >
              {entry.title}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

interface PageListItem {
  page: PageEntry
  displayLabel: string
  pdfPageLabel: string | null
  chapterHeading: TocEntry | null
}

function PageList({
  pages,
  toc,
  currentSectionId,
  printPageLabel,
  coverLabel,
}: {
  pages: PageEntry[]
  toc: TocEntry[]
  currentSectionId: string | null
  printPageLabel: string
  coverLabel: string
}) {
  const items = useMemo<PageListItem[]>(() => {
    const chapterLookup = new Map<string, TocEntry>()
    for (const chapter of toc) {
      if (chapter.section_id) chapterLookup.set(chapter.section_id, chapter)
    }
    const seen = new Set<string>()
    return pages.map((page, index) => {
      const sequential = index + 1
      const displayLabel =
        sequential === 1 ? `${sequential} (${coverLabel})` : String(sequential)
      const pdfPageLabel =
        page.page_number !== undefined && page.page_number !== null
          ? String(page.page_number)
          : null

      let chapterHeading: TocEntry | null = null
      const chapter = chapterLookup.get(page.section_id)
      if (chapter && !seen.has(chapter.section_id)) {
        chapterHeading = chapter
        seen.add(chapter.section_id)
      }

      return { page, displayLabel, pdfPageLabel, chapterHeading }
    })
  }, [pages, toc, coverLabel])

  if (pages.length === 0) return null

  return (
    <ol className="py-1 max-h-[28rem] overflow-y-auto [scrollbar-gutter:stable]">
      {items.map(({ page, displayLabel, pdfPageLabel, chapterHeading }) => {
        const active = page.section_id === currentSectionId
        const ariaLabel = pdfPageLabel
          ? `Page ${displayLabel}, ${printPageLabel} ${pdfPageLabel}`
          : `Page ${displayLabel}`
        return (
          <Fragment key={page.section_id}>
            {chapterHeading ? (
              <li
                className="mx-1 px-2.5 pt-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                data-chapter-id={chapterHeading.chapter_id || undefined}
              >
                {chapterHeading.title}
              </li>
            ) : null}
            <li>
              <button
                type="button"
                onClick={() => {
                  window.location.href = page.href
                }}
                aria-label={ariaLabel}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "w-full flex items-center justify-between gap-3 mx-1 px-2.5 py-1.5 rounded-md text-sm text-left",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus:outline-none focus:bg-accent focus:text-accent-foreground",
                  active && "bg-accent text-accent-foreground font-medium",
                )}
              >
                <span className="truncate">{displayLabel}</span>
                {pdfPageLabel ? (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {printPageLabel} {pdfPageLabel}
                  </span>
                ) : null}
              </button>
            </li>
          </Fragment>
        )
      })}
    </ol>
  )
}
