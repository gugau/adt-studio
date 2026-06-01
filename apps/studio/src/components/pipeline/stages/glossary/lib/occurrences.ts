import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/api/client"
import type { GlossaryItem } from "@/api/client"

export interface TermOccurrence {
  count: number
  pages: number[]
}

const PAGE_ID_RE = /^pg(\d+)(?:_|$)/
// Built from regex literals (not string literals) so each fragment stays a
// regex source, never a translation target.
const BOUNDARY_BEFORE = /(?<![\p{L}\p{M}])/u.source
const BOUNDARY_AFTER = /(?![\p{L}\p{M}])/u.source

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function termStrings(item: GlossaryItem): string[] {
  return [item.word, ...item.variations].map((s) => s.trim()).filter(Boolean)
}

function itemKey(item: GlossaryItem): string {
  return item.id ?? item.word
}

/**
 * Count how often each glossary term (its word plus variations) appears in the
 * book's body text, and on which pages. Reads the single text-catalog fetch and
 * derives the page number from each page-scoped entry id (`pg007_…` → page 7);
 * glossary and quiz entries carry non-page ids, so they are ignored. Matching is
 * case-insensitive with Unicode word boundaries, and a single combined regex pass
 * per page keeps it cheap regardless of how many terms there are.
 */
export function useGlossaryOccurrences(
  bookLabel: string,
  items: GlossaryItem[],
): { byItem: Map<string, TermOccurrence>; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ["books", bookLabel, "text-catalog"],
    queryFn: () => api.getTextCatalog(bookLabel),
  })

  const pageText = useMemo(() => {
    const grouped = new Map<number, string[]>()
    for (const entry of data?.entries ?? []) {
      if (!entry.text) continue
      const match = PAGE_ID_RE.exec(entry.id)
      if (!match) continue
      const pageNumber = parseInt(match[1], 10)
      const bucket = grouped.get(pageNumber)
      if (bucket) bucket.push(entry.text)
      else grouped.set(pageNumber, [entry.text])
    }
    const joined = new Map<number, string>()
    for (const [pageNumber, texts] of grouped) {
      joined.set(pageNumber, texts.join(" "))
    }
    return joined
  }, [data])

  const byItem = useMemo(() => {
    const result = new Map<string, TermOccurrence>()
    for (const item of items) {
      result.set(itemKey(item), { count: 0, pages: [] })
    }
    if (pageText.size === 0) return result

    const variantToItem = new Map<string, string>()
    const variants: string[] = []
    for (const item of items) {
      const key = itemKey(item)
      for (const term of termStrings(item)) {
        const lower = term.toLocaleLowerCase()
        if (!variantToItem.has(lower)) {
          variantToItem.set(lower, key)
          variants.push(lower)
        }
      }
    }
    if (variants.length === 0) return result

    variants.sort((a, b) => b.length - a.length)
    const pattern =
      BOUNDARY_BEFORE + "(" + variants.map(escapeRegExp).join("|") + ")" + BOUNDARY_AFTER
    let re: RegExp
    try {
      re = new RegExp(pattern, "giu")
    } catch {
      return result
    }

    const pageSets = new Map<string, Set<number>>()
    for (const [pageNumber, text] of pageText) {
      for (const match of text.matchAll(re)) {
        const key = variantToItem.get(match[0].toLocaleLowerCase())
        if (!key) continue
        const occ = result.get(key)
        if (!occ) continue
        occ.count += 1
        let set = pageSets.get(key)
        if (!set) {
          set = new Set<number>()
          pageSets.set(key, set)
        }
        set.add(pageNumber)
      }
    }
    for (const [key, set] of pageSets) {
      const occ = result.get(key)
      if (occ) occ.pages = Array.from(set).sort((a, b) => a - b)
    }
    return result
  }, [pageText, items])

  return { byItem, isLoading }
}
