import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/api/client"
import { useActiveConfig } from "@/hooks/use-debug"
import { normalizeLocale } from "@/lib/languages"

/**
 * Returns the number of catalog entries that lack downstream output for the
 * `translate` and `speech` stages, summed across all configured output
 * languages. Used to surface a "missing" pill on the sidebar so users notice
 * when a glossary addition (or other catalog change) leaves gaps to backfill.
 *
 * Languages that have never been run contribute their full catalog size to
 * the count, so configuring a new target language surfaces as missing too.
 */
export function useStageMissingCounts(label: string): { translate: number; speech: number } {
  const { data: catalog } = useQuery({
    queryKey: ["books", label, "text-catalog"],
    queryFn: () => api.getTextCatalog(label),
    enabled: !!label,
  })

  const { data: tts } = useQuery({
    queryKey: ["books", label, "tts"],
    queryFn: () => api.getTTS(label),
    enabled: !!label,
  })

  const { data: activeConfig } = useActiveConfig(label)

  return useMemo(() => {
    if (!catalog) return { translate: 0, speech: 0 }
    const total = catalog.entries.length
    if (total === 0) return { translate: 0, speech: 0 }

    const merged = (activeConfig as { merged?: Record<string, unknown> } | undefined)?.merged
    const outputLanguages = Array.from(
      new Set(((merged?.output_languages as string[] | undefined) ?? []).map((code) => normalizeLocale(code))),
    )
    if (outputLanguages.length === 0) return { translate: 0, speech: 0 }

    let translate = 0
    for (const lang of outputLanguages) {
      const langData = catalog.translations?.[lang]
      if (!langData) {
        translate += total
        continue
      }
      const present = new Set(
        langData.entries.filter((e) => e.text && e.text.trim().length > 0).map((e) => e.id),
      )
      translate += Math.max(total - present.size, 0)
    }

    let speech = 0
    for (const lang of outputLanguages) {
      const langData = tts?.languages?.[lang]
      if (!langData) {
        speech += total
        continue
      }
      const present = new Set(langData.entries.map((e) => e.textId))
      speech += Math.max(total - present.size, 0)
    }

    return { translate, speech }
  }, [catalog, tts, activeConfig])
}
