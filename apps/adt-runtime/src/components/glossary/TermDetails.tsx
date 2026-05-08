import { useAtom, useAtomValue } from "jotai"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { glossaryDataAtom } from "@/state/glossary.atoms"
import { selectedGlossaryTermAtom } from "@/state/ui.atoms"
import { useTranslation } from "@/hooks/useTranslation"
import { DockContent } from "@/components/dock/content/DockLayout"


/**
 * Detail view for a single glossary entry — emoji, term, definition, and
 * any variations. Reached by clicking a term in the list (GlossaryPanel)
 * or the "View in glossary" button on an in-page popover.
 */
export function TermDetails() {
  const { t } = useTranslation()
  const data = useAtomValue(glossaryDataAtom)
  const [selected, setSelected] = useAtom(selectedGlossaryTermAtom)

  if (!selected) return null
  const entry = data[selected]
  if (!entry) return null

  return (
    <DockContent
      className="flex flex-col gap-4 p-4"
      role="region"
      aria-label={t("glossary-term-details") || "Glossary term details"}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setSelected(null)}
        className="self-start -ml-2 text-muted-foreground"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        {t("glossary-label") || "Glossary"}
      </Button>

      <div className="flex items-start gap-3">
        {entry.emoji ? (
          <span
            className="text-3xl shrink-0"
            role="img"
            aria-label={`Symbol for ${entry.word}`}
          >
            {entry.emoji}
          </span>
        ) : null}
        <h4 className="text-2xl font-bold leading-tight break-words">
          {entry.word}
        </h4>
      </div>

      <p className="text-base leading-relaxed">{entry.definition}</p>

      {entry.variations && entry.variations.length > 0 ? (
        <div className="text-sm text-muted-foreground">
          <p className="font-medium mb-1">
            {t("glossary-variations-label") || "Variations"}
          </p>
          <p className="italic">{entry.variations.join(", ")}</p>
        </div>
      ) : null}
    </DockContent>
  )
}
