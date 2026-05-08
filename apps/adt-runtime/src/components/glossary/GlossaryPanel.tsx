import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleRow } from "@/components/sidebar/ToggleRow";
import { TermDetails } from "./TermDetails";
import { glossaryDataAtom, glossaryFilterAtom } from "@/state/glossary.atoms";
import {
  activeGlossaryTabAtom,
  dockMenuValueAtom,
  glossaryModeAtom,
  selectedGlossaryTermAtom,
} from "@/state/ui.atoms";
import { useTranslation } from "@/hooks/useTranslation";
import { trackToggleEvent } from "@/lib/analytics";
import { DockContent } from "../dock/content/DockLayout";
import { GlossaryEntry } from "@/state/glossary.atoms";

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
  const { t } = useTranslation();
  const data = useAtomValue(glossaryDataAtom);
  const [glossaryMode, setGlossaryMode] = useAtom(glossaryModeAtom);
  const [tab, setTab] = useAtom(activeGlossaryTabAtom);
  const filter = useAtomValue(glossaryFilterAtom);
  const [selected, setSelected] = useAtom(selectedGlossaryTermAtom);

  const allTerms = useMemo(
    () => Object.values(data).sort((a, b) => a.word.localeCompare(b.word)),
    [data],
  );

  const pageTerms = useMemo(() => {
    if (typeof document === "undefined") return [] as typeof allTerms;
    const content = document.getElementById("content");
    if (!content) return [];
    const haystack = (content.textContent ?? "").toLowerCase();
    if (!haystack.trim()) return [];
    return allTerms.filter((entry) => {
      const candidates = [entry.word, ...(entry.variations ?? [])];
      return candidates.some((c) => haystack.includes(c.toLowerCase()));
    });
  }, [allTerms]);

  const filteredBookTerms = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return allTerms;
    return allTerms.filter(
      (entry) =>
        entry.word.toLowerCase().includes(q) ||
        entry.definition.toLowerCase().includes(q) ||
        entry.variations?.some((v) => v.toLowerCase().includes(q)),
    );
  }, [allTerms, filter]);

  if (selected) return <TermDetails />;

  return (
    <DockContent>
      <DockContent.Header>
        <DockContent.Title className="text-lg font-semibold">
          {t("glossary-label") || "Glossary"}
        </DockContent.Title>
        <ToggleRow
          label={t("glossary-highlight-words") || "Highlight words"}
          checked={glossaryMode}
          onChange={(v) => {
            trackToggleEvent("GlossaryHighlight", v);
            setGlossaryMode(v);
          }}
          className="py-0"
        />
      </DockContent.Header>

      <DockContent.Search className="text-lg font-semibold" />

      <Tabs
        value={tab}
        onValueChange={(v) => {
          if (typeof v === "string") setTab(v as "page" | "book");
        }}
        className="flex-1 min-h-0 flex flex-col"
      >
        <TabsList className="w-full grid grid-cols-2 shrink-0">
          <TabsTrigger value="page">
            {t("glossary-page-label") || "On this page"}
          </TabsTrigger>
          <TabsTrigger value="book">
            {t("glossary-book-label") || "Book glossary"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="page">
          <ListItems
            entries={pageTerms}
            filter={filter}
            onSelect={setSelected}
          />
        </TabsContent>

        <TabsContent value="book">
          <ListItems
            entries={filteredBookTerms}
            filter={filter}
            onSelect={setSelected}
          />
        </TabsContent>
      </Tabs>
    </DockContent>
  );
}

function ListItems({
  entries,
  filter,
  onSelect,
}: {
  entries: GlossaryEntry[];
  filter: string;
  onSelect: (word: string) => void;
}) {
  const { t } = useTranslation();

  if (entries.length === 0) {
    return (
      <p className="px-4 py-8 text-sm text-muted-foreground text-center">
        {filter.trim().length > 0
          ? t("glossary-no-terms-filter") ||
            "No glossary terms found. Clear filter to view all terms."
          : t("glossary-no-terms") || "No glossary terms found."}
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {entries.map((entry) => (
        <li key={entry.word}>
          <button
            type="button"
            onClick={() => onSelect(entry.word)}
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
  );
}
