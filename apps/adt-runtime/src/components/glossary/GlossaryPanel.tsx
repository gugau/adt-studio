import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { ChevronLeft } from "lucide-react"
import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleRow } from "@/components/sidebar/ToggleRow"
import { TermDetails } from "./TermDetails"
import {
  glossaryDataAtom,
  glossaryFilterAtom,
} from "@/state/glossary.atoms"
import {
  activeGlossaryTabAtom,
  glossaryListOpenAtom,
  glossaryModeAtom,
  selectedGlossaryTermAtom,
} from "@/state/ui.atoms"
import { useTranslation } from "@/hooks/useTranslation"
import { trackToggleEvent } from "@/lib/analytics"

/**
 * Glossary panel — the alternate view of the accessibility sidebar.
 * Replaces the legacy `#glossary-content` block from interface.html.
 *
 * Top-level structure:
 *   - Back button (returns to Assistant/Settings tabs)
 *   - "Highlight words" toggle (drives `glossaryModeAtom` → DOM mutation)
 *   - Tabs:
 *       page  — only terms found in `#content`
 *       book  — every term in the glossary, with a free-text filter
 *
 * When a term is selected, the entire panel swaps to the TermDetails view.
 */
export function GlossaryPanel() {
  const { t } = useTranslation()
  const data = useAtomValue(glossaryDataAtom)
  const setGlossaryListOpen = useSetAtom(glossaryListOpenAtom)
  const [glossaryMode, setGlossaryMode] = useAtom(glossaryModeAtom)
  const [tab, setTab] = useAtom(activeGlossaryTabAtom)
  const [filter, setFilter] = useAtom(glossaryFilterAtom)
  const [selected, setSelected] = useAtom(selectedGlossaryTermAtom)

  const allTerms = useMemo(
    () => Object.values(data).sort((a, b) => a.word.localeCompare(b.word)),
    [data],
  )

  // "On this page" filters the catalog to terms whose canonical word or any
  // variation actually appears in `#content`. Cheap text scan — runs only
  // when the panel is mounted (i.e. user has opened the glossary view).
  const pageTerms = useMemo(() => {
    if (typeof document === "undefined") return [] as typeof allTerms
    const content = document.getElementById("content")
    if (!content) return []
    const haystack = (content.textContent ?? "").toLowerCase()
    if (!haystack.trim()) return []
    return allTerms.filter((entry) => {
      const candidates = [entry.word, ...(entry.variations ?? [])]
      return candidates.some((c) => haystack.includes(c.toLowerCase()))
    })
  }, [allTerms])

  const filteredBookTerms = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return allTerms
    return allTerms.filter(
      (entry) =>
        entry.word.toLowerCase().includes(q) ||
        entry.definition.toLowerCase().includes(q) ||
        entry.variations?.some((v) => v.toLowerCase().includes(q)),
    )
  }, [allTerms, filter])

  // Detail view — full-panel takeover
  if (selected) return <TermDetails />

  const renderList = (entries: typeof allTerms) => {
    if (entries.length === 0) {
      return (
        <p className="px-4 py-8 text-sm text-muted-foreground text-center">
          {filter.trim().length > 0
            ? t("glossary-no-terms-filter") || "No glossary terms found. Clear filter to view all terms."
            : t("glossary-no-terms") || "No glossary terms found."}
        </p>
      )
    }
    return (
      <ul className="flex flex-col">
        {entries.map((entry) => (
          <li key={entry.word}>
            <button
              type="button"
              onClick={() => setSelected(entry.word)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors border-b border-border focus:outline-none focus:bg-accent"
            >
              {entry.emoji ? (
                <span className="text-2xl shrink-0" aria-hidden>
                  {entry.emoji}
                </span>
              ) : null}
              <span className="flex-1 text-base font-medium">{entry.word}</span>
            </button>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setGlossaryListOpen(false)
            setSelected(null)
          }}
          aria-label={t("glossary-back-label") || "Back"}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h3 className="text-lg font-semibold">{t("glossary-label") || "Glossary"}</h3>
      </div>

      <div className="px-4 border-b border-border">
        <ToggleRow
          label={t("glossary-highlight-words") || "Highlight words"}
          checked={glossaryMode}
          onChange={(v) => {
            trackToggleEvent("GlossaryHighlight", v)
            setGlossaryMode(v)
          }}
        />
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "page" | "book")}
        className="flex-1 flex flex-col"
      >
        <TabsList className="grid grid-cols-2 mx-4 mt-3">
          <TabsTrigger value="page">
            {t("glossary-page-label") || "On this page"}
          </TabsTrigger>
          <TabsTrigger value="book">
            {t("glossary-book-label") || "Book glossary"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="page" className="flex-1 overflow-y-auto mt-3">
          {renderList(pageTerms)}
        </TabsContent>

        <TabsContent value="book" className="flex-1 flex flex-col overflow-hidden mt-3">
          <div className="px-4 pb-3 shrink-0">
            <Input
              type="text"
              placeholder={t("filter-terms") || "Filter terms..."}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="flex-1 overflow-y-auto">{renderList(filteredBookTerms)}</div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
