import type { GlossaryEntry } from "@/features/glossary/state/glossary.atoms"

const FLASH_CLASS = "glossary-flash"
const FLASH_DURATION_MS = 3500
const SKIP_PARENT_SELECTOR =
  "script, style, .glossary-flash, .glossary-popup"

export function locateGlossaryTerm(entry: GlossaryEntry): boolean {
  if (typeof document === "undefined") return false
  const content = document.getElementById("content")
  if (!content) return false

  const existing = content.querySelector<HTMLElement>(
    `.glossary-term[data-glossary-key="${cssEscape(entry.word)}"]`,
  )
  if (existing) {
    flash(existing, false)
    return true
  }

  const candidates = sortedCandidates(entry)
  const wrapped = wrapFirstMatch(content, candidates)
  if (!wrapped) return false
  flash(wrapped, true)
  return true
}

export function isGlossaryTermOnPage(entry: GlossaryEntry): boolean {
  if (typeof document === "undefined") return false
  const content = document.getElementById("content")
  if (!content) return false

  if (
    content.querySelector(
      `.glossary-term[data-glossary-key="${cssEscape(entry.word)}"]`,
    )
  ) {
    return true
  }

  return matchesAny(content.textContent ?? "", entry)
}

export async function findPageWithGlossaryTerm(
  entry: GlossaryEntry,
  pages: { href: string }[],
): Promise<{ href: string } | null> {
  const candidates = sortedCandidates(entry)
  if (candidates.length === 0 || pages.length === 0) return null
  const re = buildBoundaryRegExp(candidates)

  const results = await Promise.all(
    pages.map<Promise<{ href: string } | null>>(async (p) => {
      try {
        const res = await fetch(p.href)
        if (!res.ok) return null
        const html = await res.text()
        return re.test(html) ? p : null
      } catch {
        return null
      }
    }),
  )
  return results.find((r) => r !== null) ?? null
}

function flash(el: HTMLElement, unwrap: boolean) {
  el.classList.add(FLASH_CLASS)
  scrollIntoViewWithRetry(el)

  window.setTimeout(() => {
    el.classList.remove(FLASH_CLASS)
    if (unwrap) {
      const parent = el.parentNode
      if (!parent) return
      parent.replaceChild(document.createTextNode(el.textContent ?? ""), el)
      parent.normalize?.()
    }
  }, FLASH_DURATION_MS)
}

function scrollIntoViewWithRetry(el: HTMLElement) {
  const opts: ScrollIntoViewOptions = { behavior: "smooth", block: "center" }
  el.scrollIntoView(opts)
  // Late layout shifts (image loads, font swaps) can cancel or
  // mis-target the smooth scroll. Re-issue once the page has settled.
  window.setTimeout(() => {
    const rect = el.getBoundingClientRect()
    const fullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight
    if (!fullyVisible) el.scrollIntoView(opts)
  }, 500)
}

function wrapFirstMatch(root: HTMLElement, terms: string[]): HTMLElement | null {
  for (const term of terms) {
    const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i")
    const span = walkAndWrap(root, re)
    if (span) return span
  }
  return null
}

function walkAndWrap(root: HTMLElement, re: RegExp): HTMLElement | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (parent.closest(SKIP_PARENT_SELECTOR)) return NodeFilter.FILTER_REJECT
      const text = node.textContent
      if (!text || !text.trim()) return NodeFilter.FILTER_REJECT
      return re.test(text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    },
  })
  const node = walker.nextNode() as Text | null
  if (!node || !node.parentNode) return null

  const original = node.textContent ?? ""
  const m = original.match(re)
  if (!m || m.index === undefined) return null

  const before = original.slice(0, m.index)
  const matched = m[0]
  const after = original.slice(m.index + matched.length)

  const span = document.createElement("span")
  span.textContent = matched

  const parent = node.parentNode
  if (before) parent.insertBefore(document.createTextNode(before), node)
  parent.insertBefore(span, node)
  if (after) parent.insertBefore(document.createTextNode(after), node)
  parent.removeChild(node)

  return span
}

function sortedCandidates(entry: GlossaryEntry): string[] {
  return [entry.word, ...(entry.variations ?? [])].sort(
    (a, b) => b.length - a.length,
  )
}

function buildBoundaryRegExp(candidates: string[]): RegExp {
  const escaped = candidates.map(escapeRegExp).join("|")
  return new RegExp(`\\b(?:${escaped})\\b`, "i")
}

function matchesAny(haystack: string, entry: GlossaryEntry): boolean {
  const candidates = sortedCandidates(entry)
  if (candidates.length === 0) return false
  return buildBoundaryRegExp(candidates).test(haystack)
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value)
  }
  return value.replace(/(["\\])/g, "\\$1")
}
