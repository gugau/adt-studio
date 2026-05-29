/**
 * Mounts/unmounts glossary term highlights in `#content` based on the
 * "Highlight words" toggle (`glossaryModeAtom`) and the loaded glossary
 * data. Re-runs whenever either changes (e.g. language switch reloads the
 * glossary, the user toggles highlighting on/off).
 */
import { useAtomValue } from "jotai"
import { useEffect } from "react"
import {
  applyGlossaryHighlights,
  removeGlossaryHighlights,
} from "@/features/glossary/lib/highlight"
import { glossaryDataAtom } from "@/features/glossary/state/glossary.atoms"
import { glossaryModeAtom } from "@/shared/state/ui.atoms"

export function useGlossaryHighlighter(): void {
  const data = useAtomValue(glossaryDataAtom)
  const enabled = useAtomValue(glossaryModeAtom) as boolean

  useEffect(() => {
    if (!enabled) {
      removeGlossaryHighlights()
      return
    }
    if (Object.keys(data).length === 0) return
    // Always start from a clean baseline so re-applies (after a language
    // switch) don't double-wrap.
    removeGlossaryHighlights()
    applyGlossaryHighlights(data)
    return () => {
      removeGlossaryHighlights()
    }
  }, [enabled, data])
}
