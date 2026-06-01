// Pure HTML utilities used by BookPreviewFrame to massage iframe content.

export function promoteFirstHeadingToH1(html: string): string {
  if (/<h1\b/i.test(html)) return html
  return html.replace(/<h([2-6])(\b[^>]*)>([\s\S]*?)<\/h\1>/i, '<h1$2>$3</h1>')
}

// Inverse of `promoteFirstHeadingToH1`. Used when serializing iframe DOM back
// to persistence so the display-only promote doesn't migrate `<h2>` → `<h1>`
// in the saved rendering.
export function demoteFirstHeadingIfPromoted(
  serialized: string,
  source: string
): string {
  if (/<h1\b/i.test(source)) return serialized
  const m = source.match(/<(h[2-6])\b/i)
  if (!m) return serialized
  const originalTag = m[1].toLowerCase()
  return serialized.replace(
    /<h1(\b[^>]*)>([\s\S]*?)<\/h1>/i,
    `<${originalTag}$1>$2</${originalTag}>`
  )
}

// Apply a text edit to the original (LaTeX) HTML by splicing the iframe's
// edited innerHTML into the element matching the given data-id. Using innerHTML
// (rather than `textContent = newText`) preserves the inner span structure that
// contentEditable kept intact while the user typed — e.g. fixed-layout
// paragraphs whose words are wrapped in differently coloured `<span>`s. Returns
// the reconstructed wrapper HTML, or null if the element was not found.
export function reconstructHtmlWithEdit(
  originalHtml: string,
  dataId: string,
  editedInnerHtml: string
): string | null {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<div id="__root">${originalHtml}</div>`, "text/html")
    const el = doc.querySelector(`[data-id="${CSS.escape(dataId)}"]`)
    if (!el) return null
    el.innerHTML = editedInnerHtml
    const wrapper = doc.getElementById("content") ?? doc.getElementById("__root")
    if (!wrapper) return null
    const cls = wrapper.getAttribute("class")?.trim()
    return cls ? wrapper.outerHTML : wrapper.innerHTML
  } catch {
    return null
  }
}
