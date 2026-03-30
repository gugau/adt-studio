import temml from "temml"

/**
 * Regex matching common LaTeX commands found undelimited in LLM output.
 * Used to detect text nodes that are LaTeX but lack $ or \( delimiters.
 */
const UNDELIMITED_LATEX_RE =
  /\\(?:text|hat|frac|sqrt|vec|bar|overline|underline|mathbf|mathrm|mathit|circ|times|div|pm|mp|leq|geq|neq|approx|equiv|sim|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|omega|phi|psi|infty|partial|nabla|sum|prod|int|lim|log|ln|sin|cos|tan|sec|csc|cot|left|right|cdot|ldots|cdots|quad|qquad|binom)\b|[_^]\{/

function tryRender(latex: string, displayMode: boolean): string | null {
  try {
    const result = temml.renderToString(latex.trim(), { displayMode })
    // Temml may embed errors as <span class="temml-error"> instead of throwing
    if (result.includes("temml-error")) return null
    return result
  } catch {
    return null
  }
}

/**
 * Try inline mode first, fall back to display mode if that fails.
 * Handles commands like \tag{} and \\ that require display mode.
 */
function tryRenderWithFallback(latex: string): string | null {
  return tryRender(latex, false) ?? tryRender(latex, true)
}

/**
 * Returns true if the text is mixed prose with embedded math, rather than a
 * pure math expression. We detect this by looking for 3+ consecutive regular
 * English words — pure LaTeX expressions rarely have that.
 */
function isMixedContent(text: string): boolean {
  const words = text.split(/\s+/)
  let consecutive = 0
  for (const word of words) {
    if (/^[a-zA-Z]{3,}[.,;:!?]?$/.test(word)) {
      consecutive++
      if (consecutive >= 3) return true
    } else {
      consecutive = 0
    }
  }
  return false
}

/**
 * Replace delimited LaTeX ($, $$, \(, \[) with MathML in a string.
 */
function convertDelimited(text: string): string {
  // $$...$$ — display math (must come before $...$)
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (m, latex: string) => tryRender(latex, true) ?? m)

  // \[...\] — display math
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (m, latex: string) => tryRender(latex, true) ?? m)

  // $...$ — inline math
  text = text.replace(/(?<!\\)\$([^\s$](?:[^$]*[^\s$])?)\$/g, (m, latex: string) => tryRender(latex, false) ?? m)

  // \(...\) — inline math
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (m, latex: string) => tryRender(latex, false) ?? m)

  return text
}

/**
 * Convert LaTeX in an HTML string to MathML for display purposes.
 * Handles both delimited ($, $$, \(, \[) and undelimited LaTeX in text nodes.
 *
 * For mixed prose+math (e.g. "the space M = (X, V), where X ∈ ℝ^{N×3}"),
 * only delimited math is converted — the undelimited pass is skipped to
 * avoid rendering entire paragraphs as a single math expression.
 */
export function convertLatexInHtml(html: string): string {
  // Decode HTML-encoded dollar signs (htmlparser2 encodes $ as &#x24;)
  html = html.replace(/&#x24;/g, "$").replace(/&#36;/g, "$")

  // First pass: delimited math
  html = convertDelimited(html)

  // Second pass: undelimited LaTeX in pure-math text nodes (between > and <).
  // Skip mixed prose+math to avoid rendering paragraphs as math expressions.
  html = html.replace(/(>)([^<]+)(<)/g, (m, open: string, text: string, close: string) => {
    if (!UNDELIMITED_LATEX_RE.test(text)) return m
    if (text.includes("<math")) return m
    if (isMixedContent(text)) return m
    const mathml = tryRenderWithFallback(text.trim())
    return mathml ? `${open}${mathml}${close}` : m
  })

  return html
}
