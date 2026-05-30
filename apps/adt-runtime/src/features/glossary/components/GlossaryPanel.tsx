import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { ToggleRow } from "@/features/settings/components/ToggleRow";
import { TermDetails } from "@/features/glossary/components/TermDetails";
import {
  glossaryDataAtom,
  glossaryFilterAtom,
} from "@/features/glossary/state/glossary.atoms";
import {
  activeGlossaryTabAtom,
  dockMenuValueAtom,
  glossaryModeAtom,
  selectedGlossaryTermAtom,
} from "@/shared/state/ui.atoms";
import { useTranslation } from "@/features/language/hooks/useTranslation";
import { trackToggleEvent } from "@/shared/lib/analytics";
import { DockContent } from "@/features/dock/components/DockLayout";
import { GlossaryEntry } from "@/features/glossary/state/glossary.atoms";

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

        <TabsContent value="page" className="min-h-0">
          <ScrollArea className="h-full">
            <ListItems
              entries={pageTerms}
              filter={filter}
              onSelect={setSelected}
            />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="book" className="min-h-0">
          <ScrollArea className="h-full">
            <ListItems
              entries={filteredBookTerms}
              filter={filter}
              onSelect={setSelected}
            />
          </ScrollArea>
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
            className="w-full flex flex-col items-start gap-3 px-4 py-3 text-left hover:bg-accent transition-colors border-b border-border focus:outline-none focus:bg-accent"
          >
            {entry.emoji && (
              <span className="text-2xl shrink-0" aria-hidden>
                {entry.emoji}
              </span>
            )}
            <span className="flex-1 text-base font-medium capitalize">
              {entry.word}
            </span>
            <span className="flex-1 text-base font-medium">
              {entry.definition}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
