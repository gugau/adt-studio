import { useRef, useMemo, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from "react"
import DOMPurify from "dompurify"
import { BASE_URL } from "@/api/client"
import type { DeviceView } from "./style-editor/device-breakpoint"
import {
  getDeviceFrame,
  getTargetVisibleWidth,
} from "./style-editor/device-chrome"
import { IPhoneFrame } from "./style-editor/device-frames/iphone-frame"
import { IPadFrame } from "./style-editor/device-frames/ipad-frame"
import {
  demoteFirstHeadingIfPromoted,
  promoteFirstHeadingToH1,
  reconstructHtmlWithEdit,
} from "./iframe-html"
import { INTERACTIVE_SCRIPT, INTERACTIVE_STYLES } from "./iframe-interactive"

// In Desktop version, BASE_URL is "http://localhost:3001/api"; extract the origin so the iframe
// can resolve relative image URLs (stored in the DB) via a <base> tag (see Lesson #2).
// Use new URL().origin instead of string slicing — immune to path changes (Lesson #11).
const IFRAME_BASE = BASE_URL.startsWith("http") ? new URL(BASE_URL).origin : ""

/** Build the URL prefix for adt-preview asset routes for the given book. */
function previewAssetsUrl(bookLabel: string): string {
  return `${BASE_URL}/books/${bookLabel}/adt-preview`
}

/** Default render-width when no `width` prop is supplied — matches a typical
 *  desktop preview. The iframe is scaled down via CSS transform to fit the
 *  actual panel width. */
const DEFAULT_RENDER_WIDTH = 1280

export interface BookPreviewFrameHandle {
  /** Get the iframe element's bounding rect in the viewport */
  getIframeRect: () => DOMRect | null
  /** Regenerate Tailwind CSS including the given extra HTML, then inject into iframe.
   *  Use after AI edits introduce new Tailwind classes not yet in the DB. */
  refreshCss: (extraHtml: string) => Promise<void>
  /** Read the Tailwind classes on an element by data-id */
  getElementClasses: (dataId: string) => string[]
  /** Set the full class list on an element by data-id. Returns updated full HTML, or null. */
  setElementClasses: (dataId: string, classes: string[]) => string | null
  /** Re-inject the current `html` prop into the iframe, discarding any in-iframe
   *  DOM mutations (e.g. live `setElementClasses` edits). Used when the parent
   *  wants to revert to the saved state without changing the html prop. */
  resetContent: () => void
}

export interface BookPreviewFrameProps {
  html: string
  /** Book label — used to load the correct Tailwind CSS and font assets from the API */
  bookLabel: string
  className?: string
  /** Enable interactive mode — click/edit elements with data-id attributes */
  editable?: boolean
  /** data-id values of pruned elements — shown faded/greyed in the preview */
  prunedDataIds?: string[]
  /** Elements that have been edited — shows subtle indicator + original on hover */
  changedElements?: Array<{ dataId: string; originalText?: string }>
  /** Called when a data-id element is clicked (single click).
   *  tagName is provided for container elements (div, section, etc.) that don't have a pre-existing data-id. */
  onSelectElement?: (dataId: string, rect: DOMRect, tagName?: string) => void
  /** Called when a text element is edited (blur/Enter after contenteditable) */
  onTextChanged?: (dataId: string, newText: string, fullHtml: string) => void
  /** When true (default), applies data-background-color to the iframe body */
  applyBodyBackground?: boolean
  /** data-id of the currently selected element; re-applied after each body rebuild. */
  selectedDataId?: string | null
  /** Inner viewport width the iframe renders at; the wrapper scales it to fit. */
  renderWidth?: number
  /** When set, draws device chrome (bezel + rounded corners) around the iframe. */
  deviceView?: DeviceView
  /** Reports the iframe's current on-screen width in CSS pixels (renderWidth × scale).
   *  Updates whenever the canvas resizes — useful for showing the active viewport size. */
  onVisibleWidthChange?: (width: number) => void
}

/**
 * Renders section HTML in an iframe that matches the final book output structure.
 * Uses the same CSS, fonts, and body layout as the preview so rendering is pixel-identical.
 *
 * The iframe always renders at a fixed desktop-width viewport (RENDER_WIDTH) then
 * scales down via CSS transform to fit the available panel width. This ensures
 * responsive breakpoints, overlay positions, and image sizing match the preview.
 *
 * When `editable` is true, injects interactive scripts that allow clicking and
 * editing data-id elements, communicating changes back via postMessage.
 */
export const BookPreviewFrame = forwardRef<BookPreviewFrameHandle, BookPreviewFrameProps>(function BookPreviewFrame({
  html,
  bookLabel,
  className,
  editable = false,
  prunedDataIds,
  changedElements,
  onSelectElement,
  onTextChanged,
  applyBodyBackground,
  selectedDataId,
  renderWidth = DEFAULT_RENDER_WIDTH,
  deviceView,
  onVisibleWidthChange,
}, ref) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const refreshIdRef = useRef(0)

  const assetsPrefix = previewAssetsUrl(bookLabel)

  useImperativeHandle(ref, () => ({
    getIframeRect: () => iframeRef.current?.getBoundingClientRect() ?? null,
    refreshCss: async (extraHtml: string) => {
      const id = ++refreshIdRef.current
      const doc = iframeRef.current?.contentDocument
      if (!doc?.head) return
      const res = await fetch(`${assetsPrefix}/content/tailwind_output.css`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extraHtml }),
      })
      if (id !== refreshIdRef.current || !res.ok) return
      const css = await res.text()
      if (id !== refreshIdRef.current) return
      const styleId = "adt-dynamic-css"
      let styleEl = doc.getElementById(styleId) as HTMLStyleElement | null
      if (!styleEl) {
        styleEl = doc.createElement("style")
        styleEl.id = styleId
        doc.head.appendChild(styleEl)
      }
      styleEl.textContent = css
      requestAnimationFrame(() => {
        const main = doc.querySelector("main")
        const h = (main ?? doc.body)?.scrollHeight
        if (h && h > 0) setContentHeight(h)
      })
    },
    getElementClasses: (dataId: string): string[] => {
      const doc = iframeRef.current?.contentDocument
      if (!doc) return []
      const el = doc.querySelector(`[data-id="${CSS.escape(dataId)}"]`) as HTMLElement | null
      if (!el) return []
      return Array.from(el.classList)
    },
    setElementClasses: (dataId: string, classes: string[]): string | null => {
      const doc = iframeRef.current?.contentDocument
      if (!doc) return null
      const el = doc.querySelector(`[data-id="${CSS.escape(dataId)}"]`) as HTMLElement | null
      if (!el) return null
      el.className = classes.join(" ")
      // Don't strip `_el#` data-ids here — the inspector relies on them across
      // edits in a session. They're stripped only at API persist time.
      const transientEls = doc.querySelectorAll("[data-adt-selected], [data-adt-editing]")
      transientEls.forEach((te) => {
        te.removeAttribute("data-adt-selected")
        te.removeAttribute("data-adt-editing")
      })
      const wrapper = doc.getElementById("content")
      let html: string
      if (wrapper) {
        const cls = (wrapper.getAttribute("class") || "").trim()
        html = cls ? wrapper.outerHTML : wrapper.innerHTML
      } else {
        html = doc.body.innerHTML
      }
      el.setAttribute("data-adt-selected", "true")
      return demoteFirstHeadingIfPromoted(html, sanitizedHtmlRef.current)
    },
    resetContent: () => {
      if (readyRef.current) injectContent(latestHtmlRef.current)
    },
  }))
  const [iframeReady, setIframeReady] = useState(false)
  const [scale, setScale] = useState(1)
  const [contentHeight, setContentHeight] = useState(800)
  const readyRef = useRef(false)
  const latestHtmlRef = useRef("")
  const sanitizedHtmlRef = useRef("")
  const originalTextsRef = useRef<Record<string, string>>({})
  const measureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sanitizedHtml = useMemo(() => DOMPurify.sanitize(html), [html])
  // Convert LaTeX to MathML for display via the API — the underlying data stays as LaTeX.
  // Start with sanitized HTML immediately, then update when the API responds.
  const [displayHtml, setDisplayHtml] = useState(sanitizedHtml)
  useEffect(() => {
    setDisplayHtml(sanitizedHtml)
    let cancelled = false
    fetch(`${assetsPrefix}/convert-math`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: sanitizedHtml }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { html: string } | null) => {
        if (!cancelled && data?.html && data.html !== sanitizedHtml) {
          setDisplayHtml(data.html)
        }
      })
      .catch(() => {}) // fallback: display without math conversion
    return () => { cancelled = true }
  }, [sanitizedHtml, assetsPrefix])
  latestHtmlRef.current = displayHtml
  sanitizedHtmlRef.current = sanitizedHtml

  // Build a map of data-id → original LaTeX innerHTML so the iframe can swap
  // MathML back to LaTeX when the user clicks to edit an element.
  useMemo(() => {
    const map: Record<string, string> = {}
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<div>${sanitizedHtml}</div>`, "text/html")
    doc.querySelectorAll("[data-id]").forEach((el) => {
      const id = el.getAttribute("data-id")
      if (id) map[id] = el.innerHTML
    })
    originalTextsRef.current = map
  }, [sanitizedHtml])

  // Stable shell — loaded once, never changes.
  // Mirrors the preview's renderPageHtml output: same CSS, fonts, body classes.
  const srcdoc = useMemo(
    // eslint-disable-next-line lingui/no-unlocalized-strings
    () => `<!DOCTYPE html>
<html>
<head>
  ${IFRAME_BASE ? `<base href="${IFRAME_BASE}">` : ""}
  <meta charset="utf-8" />
  <meta content="width=device-width, initial-scale=1" name="viewport" />
  <link href="${assetsPrefix}/content/tailwind_output.css" rel="stylesheet">
  <link href="${assetsPrefix}/assets/fonts.css" rel="stylesheet">
  <link href="${assetsPrefix}/assets/libs/fontawesome/css/all.min.css" rel="stylesheet">
  <style>
    ${INTERACTIVE_STYLES}
  </style>
</head>
<body class="min-h-screen flex items-center justify-center">
${INTERACTIVE_SCRIPT}
</body>
</html>`,
    [assetsPrefix]
  )

  // Listen for postMessage from iframe
  const callbacksRef = useRef({ onSelectElement, onTextChanged })
  callbacksRef.current = { onSelectElement, onTextChanged }

  const handleMessage = useCallback((e: MessageEvent) => {
    const data = e.data ?? {}
    if (typeof data !== "object" || !data.type) return
    const { type, dataId, rect, newText, fullHtml, tagName } = data
    if (type === "select" || type === "select-image" || type === "select-container") {
      callbacksRef.current.onSelectElement?.(dataId, rect, tagName)
    } else if (type === "text-changed") {
      // Reconstruct fullHtml from original LaTeX HTML to prevent MathML
      // from leaking into the data model when saving edits
      const reconstructed = reconstructHtmlWithEdit(sanitizedHtmlRef.current, dataId, newText)
      callbacksRef.current.onTextChanged?.(dataId, newText, reconstructed ?? fullHtml)
    } else if (type === "deselect") {
      callbacksRef.current.onSelectElement?.("", {} as DOMRect)
    }
  }, [])

  useEffect(() => {
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [handleMessage])

  /** Measure the intrinsic content height of the iframe document. We measure
   *  the inner <main> rather than <body> because the body uses `min-h-screen`
   *  + flex centering for desktop layout, which inflates body.scrollHeight to
   *  the iframe viewport even when the actual content is shorter. */
  function measureHeight() {
    const doc = iframeRef.current?.contentDocument
    if (!doc?.body) return
    const main = doc.querySelector("main")
    const h = (main ?? doc.body).scrollHeight
    if (h > 0) setContentHeight(h)
  }

  /** Inject HTML into the iframe body (preserving the interactive script). */
  function injectContent(newHtml: string) {
    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    if (!doc?.body) return

    // Preserve the interactive script if present
    const scriptEl = doc.body.querySelector("script")
    const normalizedHtml = promoteFirstHeadingToH1(newHtml)
    // Mirror the packaged page shell closely: a page-level <main> containing
    // either the existing #content wrapper or a generated one.
    const hasOwnMain = /^\s*<main\b/.test(normalizedHtml)
    const hasOwnWrapper = /^\s*<div\b[^>]*\bid="content"/.test(normalizedHtml)
    const contentHtml = hasOwnWrapper ? normalizedHtml : `<div id="content">${normalizedHtml}</div>`
    doc.body.innerHTML = hasOwnMain ? normalizedHtml : `<main class="w-full">${contentHtml}</main>`
    if (scriptEl) {
      doc.body.appendChild(scriptEl)
    }

    // Inject original LaTeX texts so startEditing can swap MathML → LaTeX
    const textsEl = doc.createElement("script")
    textsEl.id = "adt-original-texts"
    textsEl.textContent = `window.__origTexts=${JSON.stringify(originalTextsRef.current)};`
    doc.body.appendChild(textsEl)

    // Apply data-background-color from content to iframe body
    if (applyBodyBackground !== false) {
      const bgEl = doc.querySelector("[data-background-color]")
      doc.body.style.backgroundColor = bgEl?.getAttribute("data-background-color") ?? ""
    } else {
      doc.body.style.backgroundColor = ""
    }

    // Force synchronous reflow so the browser repaints the scaled iframe
    // immediately after innerHTML changes (fixes delayed style rendering).
    void doc.body.offsetHeight

    // Measure after fonts + images settle
    requestAnimationFrame(() => {
      measureHeight()
      if (doc.fonts?.ready) {
        doc.fonts.ready.then(measureHeight)
      }
    })

    doc.querySelectorAll("img").forEach((img) => {
      if (!img.complete) {
        img.addEventListener("load", measureHeight, { once: true })
        img.addEventListener("error", measureHeight, { once: true })
      }
    })

    if (measureTimerRef.current) clearTimeout(measureTimerRef.current)
    measureTimerRef.current = setTimeout(measureHeight, 500)
  }

  // injectContent re-measures synchronously, so don't reset contentHeight
  // here — collapsing to 800 first causes a layout jump on every commit.
  useEffect(() => {
    if (readyRef.current) injectContent(displayHtml)
  }, [displayHtml, applyBodyBackground])

  // Re-stamp the selection attribute after every body rebuild. Must run
  // after the inject effect above (declaration order matters).
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    doc.querySelectorAll("[data-adt-selected]").forEach((el) => {
      if (el.getAttribute("data-id") !== selectedDataId) {
        el.removeAttribute("data-adt-selected")
      }
    })
    if (!selectedDataId) return
    const el = doc.querySelector(`[data-id="${CSS.escape(selectedDataId)}"]`)
    if (el) el.setAttribute("data-adt-selected", "true")
  }, [selectedDataId, displayHtml, iframeReady])

  // Toggle editability dynamically via data attribute (no iframe reload needed)
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc?.body) return
    doc.body.dataset.editable = editable ? "true" : "false"
  }, [editable, iframeReady])

  // Suppress the iframe's own scrollbar in desktop view (where the iframe is
  // sized to its content and the host container provides the scroll). Phone
  // and tablet frames keep the default since their fixed-height chrome relies
  // on internal scrolling.
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    const desktop = !deviceView || deviceView === "desktop"
    const value = desktop ? "hidden" : ""
    if (doc.documentElement) doc.documentElement.style.overflow = value
    if (doc.body) doc.body.style.overflow = value
  }, [deviceView, iframeReady])

  // Inject/update pruned element styles into the iframe
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc?.head) return
    const styleId = "adt-pruned-styles"
    let styleEl = doc.getElementById(styleId) as HTMLStyleElement | null
    if (!prunedDataIds?.length) {
      styleEl?.remove()
      return
    }
    if (!styleEl) {
      styleEl = doc.createElement("style")
      styleEl.id = styleId
      doc.head.appendChild(styleEl)
    }
    const selectors = prunedDataIds.map((id) => `[data-id="${id}"]`).join(",\n")
    // eslint-disable-next-line lingui/no-unlocalized-strings
    styleEl.textContent = `${selectors} { opacity: 0.3; filter: grayscale(1); transition: opacity 0.3s, filter 0.3s; }`
  }, [prunedDataIds, iframeReady])

  // Inject/update changed-element indicators + hover tooltips
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc?.head) return
    const styleId = "adt-changed-styles"
    let styleEl = doc.getElementById(styleId) as HTMLStyleElement | null

    // Clean up previous title attributes
    doc.querySelectorAll("[data-adt-changed]").forEach((el) => {
      el.removeAttribute("title")
      el.removeAttribute("data-adt-changed")
    })

    if (!changedElements?.length) {
      styleEl?.remove()
      return
    }

    if (!styleEl) {
      styleEl = doc.createElement("style")
      styleEl.id = styleId
      doc.head.appendChild(styleEl)
    }

    const selectors = changedElements.map((c) => `[data-id="${c.dataId}"]`).join(",\n")
    // eslint-disable-next-line lingui/no-unlocalized-strings
    styleEl.textContent = `
${selectors} {
  position: relative;
  box-shadow: -3px 0 0 0 rgba(245, 158, 11, 0.6);
  transition: box-shadow 0.3s;
}
${selectors}:hover {
  box-shadow: -3px 0 0 0 rgba(245, 158, 11, 1);
}`

    // Set title attribute on changed elements for native hover tooltip
    for (const { dataId, originalText } of changedElements) {
      const el = doc.querySelector(`[data-id="${dataId}"]`)
      if (el && originalText) {
        el.setAttribute("data-adt-changed", "true")
        const preview = originalText.length > 120 ? originalText.slice(0, 120) + "…" : originalText
        el.setAttribute("title", `Original: ${preview}`)
      } else if (el) {
        el.setAttribute("data-adt-changed", "true")
      }
    }
  }, [changedElements, iframeReady])

  const frame = useMemo(() => getDeviceFrame(deviceView, renderWidth), [deviceView, renderWidth])
  const targetVisibleWidth = getTargetVisibleWidth(deviceView)
  const baseWidth = frame.chromeWidth

  // Compute the scale factor. The chrome (when present) is rendered at its
  // full logical size; we then `transform: scale()` the entire wrapper so it
  // fits the canvas. Desktop is capped at 1×; mobile/tablet grow up to a
  // target visible width for legibility.
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const availableWidth = entry.contentRect.width
      const fitScale = Math.max(0, availableWidth / baseWidth)
      const cap =
        deviceView === "desktop" || deviceView === undefined
          ? 1
          : targetVisibleWidth / baseWidth
      setScale(Math.min(cap, fitScale))
    })
    ro.observe(wrapper)
    return () => ro.disconnect()
  }, [baseWidth, targetVisibleWidth, deviceView])

  // Ref callback so the iframe re-initializes whenever the conditional
  // device-frame branch swaps it out (toggling Desktop ↔ Mobile ↔ Tablet
  // remounts the <iframe> element). Without this, the new iframe never
  // gets its load listener attached and the preview shows white until the
  // section is re-selected.
  const initIframe = useCallback((iframe: HTMLIFrameElement | null) => {
    iframeRef.current = iframe
    if (!iframe) {
      readyRef.current = false
      setIframeReady(false)
      return
    }

    const onLoad = () => {
      const doc = iframe.contentDocument
      if (!doc) return
      const start = () => {
        readyRef.current = true
        setIframeReady(true)
        injectContent(latestHtmlRef.current)
      }
      if (doc.fonts?.ready) {
        doc.fonts.ready.then(start)
      } else {
        start()
      }
    }

    iframe.addEventListener("load", onLoad)
  }, [])

  // Tear down measurement timer on unmount.
  useEffect(() => {
    return () => {
      if (measureTimerRef.current) clearTimeout(measureTimerRef.current)
    }
  }, [])

  const visibleWidth = Math.round(renderWidth * scale)
  useEffect(() => {
    onVisibleWidthChange?.(visibleWidth)
  }, [visibleWidth, onVisibleWidthChange])

  // Mobile/tablet keep their fixed device-screen height (the chrome is meant
  // to look like a real phone/tablet). Desktop has no chrome — making the
  // iframe content-tall avoids the dead space `min-h-screen flex items-center`
  // produces when a section is shorter than the canvas.
  const isDesktop = !deviceView || deviceView === "desktop"
  const iframeHeight = isDesktop ? contentHeight : frame.screenHeight
  const visibleHeight = isDesktop
    ? contentHeight * scale
    : frame.chromeHeight * scale

  const iframeNode = (
    <iframe
      ref={initIframe}
      srcDoc={srcdoc}
      className="block"
      style={{
        width: frame.screenWidth,
        height: iframeHeight,
        border: "none",
      }}
    />
  )

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{
        height: visibleHeight,
        overflow: "hidden",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          transformOrigin: "50% 0",
          transform: `scale(${scale})`,
        }}
      >
        {deviceView === "mobile" ? (
          <IPhoneFrame width={frame.chromeWidth}>{iframeNode}</IPhoneFrame>
        ) : deviceView === "tablet" ? (
          <IPadFrame screenWidth={frame.screenWidth} screenHeight={frame.screenHeight}>
            {iframeNode}
          </IPadFrame>
        ) : (
          <div
            style={{
              width: frame.screenWidth,
              height: iframeHeight,
              overflow: "hidden",
            }}
          >
            {iframeNode}
          </div>
        )}
      </div>
    </div>
  )
})
