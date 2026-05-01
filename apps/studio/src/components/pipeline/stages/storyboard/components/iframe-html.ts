// Pure HTML utilities used by BookPreviewFrame to massage iframe content.

export function promoteFirstHeadingToH1(html: string): string {
  if (/<h1\b/i.test(html)) return html
  return html.replace(/<h([2-6])(\b[^>]*)>([\s\S]*?)<\/h\1>/i, '<h1$2>$3</h1>')
}

// Apply a text edit to the original (LaTeX) HTML by replacing the textContent
// of the element matching the given data-id. Returns the reconstructed wrapper
// HTML, or null if the element was not found.
export function reconstructHtmlWithEdit(
  originalHtml: string,
  dataId: string,
  newText: string
): string | null {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<div id="__root">${originalHtml}</div>`, "text/html")
    const el = doc.querySelector(`[data-id="${CSS.escape(dataId)}"]`)
    if (!el) return null
    el.textContent = newText
    const wrapper = doc.getElementById("content") ?? doc.getElementById("__root")
    if (!wrapper) return null
    const cls = wrapper.getAttribute("class")?.trim()
    return cls ? wrapper.outerHTML : wrapper.innerHTML
  } catch {
    return null
  }
}
