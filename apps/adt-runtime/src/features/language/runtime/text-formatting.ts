export function applyPlainTextWithLineBreaks(element: HTMLElement, text: string): void {
  const fragment = document.createDocumentFragment()
  const lines = String(text ?? "").split(/\r?\n/)

  lines.forEach((line, index) => {
    if (index > 0) fragment.appendChild(document.createElement("br"))
    fragment.appendChild(document.createTextNode(line))
  })

  element.replaceChildren(fragment)
}
