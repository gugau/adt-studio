import type { GlossaryEntry } from "@/state/glossary.atoms"

const FLASH_CLASS = "glossary-flash"
const FLASH_DURATION_MS = 2400

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

  const candidates = [entry.word, ...(entry.variations ?? [])].sort(
    (a, b) => b.length - a.length,
  )
  const wrapped = wrapFirstMatch(content, candidates)
  if (!wrapped) return false
  flash(wrapped, true)
  return true
}

function flash(el: HTMLElement, unwrap: boolean) {
  el.classList.add(FLASH_CLASS)
  el.scrollIntoView({ behavior: "smooth", block: "center" })

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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value)
  }
  return value.replace(/(["\\])/g, "\\$1")
}
