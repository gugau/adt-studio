import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import type { AccessibilityPageResult } from "@adt/types"
import { Loader2, AlertCircle } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { api, getAdtUrl } from "@/api/client"
import { useDebugPanelState } from "@/components/debug/debug-panel-state"
import { useAccessibilityAssessment } from "@/hooks/use-debug"
import { useBookRun } from "@/hooks/use-book-run"
import {
  findAccessibilityPage,
  normalizeAccessibilityHref,
  summarizeAccessibilityPage,
} from "@/lib/accessibility-summary"
import { PreviewAccessibilityCard } from "./PreviewAccessibilityCard"
import { PreviewValidationCard } from "./PreviewValidationCard"

const HIGHLIGHT_STYLE_ID = "adt-preview-a11y-highlights"
const TOOLTIP_ID = "adt-preview-a11y-tooltip"
const ISSUE_ATTR = "data-adt-a11y-issue"
const REVIEW_ATTR = "data-adt-a11y-review"
const HOVER_ATTR = "data-adt-a11y-hover"
const HIGHLIGHT_MODE_STORAGE_PREFIX = "adt-preview-a11y-highlight"

interface ElementHighlightEntry {
  kind: "issue" | "review"
  id: string
  impact: string | null
  help: string
  description: string
  failureSummary: string | null
}

const highlightCleanupByDocument = new WeakMap<Document, AbortController>()

export function PreviewView({ bookLabel }: { bookLabel: string }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { previewHref?: string }
  const { stageState } = useBookRun()
  const storyboardDone = stageState("storyboard") === "done"
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const ranRef = useRef(false)
  const { panelOpen } = useDebugPanelState()
  const [packaging, setPackaging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [version, setVersion] = useState(0)
  const [highlightMode, setHighlightMode] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false
    }
    return window.sessionStorage.getItem(`${HIGHLIGHT_MODE_STORAGE_PREFIX}:${bookLabel}`) === "on"
  })
  const [currentPreviewPage, setCurrentPreviewPage] = useState<{
    sectionId: string | null
    href: string | null
    title: string | null
    hasImages: boolean
    hasActivity: boolean
    signLanguageEnabled: boolean
  }>({ sectionId: null, href: null, title: null, hasImages: false, hasActivity: false, signLanguageEnabled: false })
  const [accessibilityCardExpanded, setAccessibilityCardExpanded] = useState(false)
  const [validationCardExpanded, setValidationCardExpanded] = useState(false)
  const { data, isLoading: assessmentLoading, error: assessmentError } = useAccessibilityAssessment(bookLabel)

  const assessment = data?.assessment ?? null
  const matchedPage = useMemo(
    () => (assessment ? findAccessibilityPage(assessment, currentPreviewPage) : null),
    [assessment, currentPreviewPage],
  )
  const currentPageSummary = useMemo(
    () => summarizeAccessibilityPage(matchedPage),
    [matchedPage],
  )
  const currentValidationPage = useMemo(() => {
    const pageId = deriveReviewPageId(currentPreviewPage.sectionId, currentPreviewPage.href)
    return {
      pageId,
      pageNumber: matchedPage?.pageNumber ?? deriveReviewPageNumber(pageId),
      sectionId: currentPreviewPage.sectionId,
      href: currentPreviewPage.href,
      title: currentPreviewPage.title,
      hasImages: currentPreviewPage.hasImages,
      hasActivity: currentPreviewPage.hasActivity,
      signLanguageEnabled: currentPreviewPage.signLanguageEnabled,
    }
  }, [currentPreviewPage, matchedPage])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    window.sessionStorage.setItem(
      `${HIGHLIGHT_MODE_STORAGE_PREFIX}:${bookLabel}`,
      highlightMode ? "on" : "off",
    )
  }, [bookLabel, highlightMode])

  const syncCurrentPreviewPage = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow || !iframe.contentDocument) {
      return
    }

    try {
      const sectionId = iframe.contentDocument
        .querySelector('meta[name="title-id"]')
        ?.getAttribute("content") ?? null
      const href = normalizeAccessibilityHref(iframe.contentWindow.location.pathname)
      const title = iframe.contentDocument.title || null
      const hasImages = iframe.contentDocument.querySelectorAll("img").length > 0
      const hasActivity = iframe.contentDocument.querySelector('[data-section-type^="activity_"]') !== null
      const signLanguageEnabled =
        iframe.contentDocument.querySelector("#sl-quick-toggle-button, #sign-language-video") !== null

      setCurrentPreviewPage({ sectionId, href, title, hasImages, hasActivity, signLanguageEnabled })
    } catch {
      setCurrentPreviewPage({ sectionId: null, href: null, title: null, hasImages: false, hasActivity: false, signLanguageEnabled: false })
    }
  }, [])

  useEffect(() => {
    return () => {
      clearAccessibilityHighlights(iframeRef.current)
    }
  }, [])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentDocument) {
      return
    }

    if (!highlightMode || !matchedPage) {
      clearAccessibilityHighlights(iframe)
      return
    }

    applyAccessibilityHighlights(iframe, matchedPage)
  }, [highlightMode, matchedPage, version])

  const runPackage = useCallback(async () => {
    setPackaging(true)
    setError(null)
    setReady(false)
    setCurrentPreviewPage({ sectionId: null, href: null, title: null, hasImages: false, hasActivity: false, signLanguageEnabled: false })
    try {
      await api.packageAdt(bookLabel)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "step-status"] }),
        queryClient.invalidateQueries({ queryKey: ["debug", "accessibility", bookLabel] }),
        queryClient.invalidateQueries({ queryKey: ["debug", "versions", bookLabel, "accessibility-assessment", "book"] }),
      ])
      setVersion((value) => Math.max(value + 1, Date.now()))
      setReady(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Packaging failed")
    } finally {
      setPackaging(false)
    }
  }, [bookLabel, queryClient])

  // Only trigger packaging when storyboard is done
  useEffect(() => {
    if (!storyboardDone || ranRef.current) return
    ranRef.current = true
    runPackage()
  }, [runPackage, storyboardDone])

  useEffect(() => {
    if (!storyboardDone) return
    const handler = () => { runPackage() }
    window.addEventListener("adt:repackage", handler)
    return () => window.removeEventListener("adt:repackage", handler)
  }, [runPackage, storyboardDone])

  const navigatePreviewToHref = useCallback((href: string) => {
    const iframe = iframeRef.current
    const iframeWindow = iframe?.contentWindow
    if (!iframeWindow) {
      return
    }

    const normalizedHref = href.replace(/^\/+/, "")
    const currentHref = iframeWindow.location.href
    const fallbackBase = typeof window === "undefined"
      ? `${getAdtUrl(bookLabel)}/v-${version}/`
      : new URL(`${getAdtUrl(bookLabel)}/v-${version}/`, window.location.origin).toString()
    const baseHref = currentHref && currentHref !== "about:blank" ? currentHref : fallbackBase
    const nextUrl = new URL(normalizedHref, baseHref)
    iframeWindow.location.href = nextUrl.toString()
  }, [bookLabel, version])

  useEffect(() => {
    if (!ready || !search.previewHref) {
      return
    }

    const currentHref = currentPreviewPage.href
    const normalizedTarget = normalizeAccessibilityHref(search.previewHref)
    if (currentHref !== normalizedTarget) {
      navigatePreviewToHref(search.previewHref)
      return
    }

    void navigate({
      to: "/books/$label/$step",
      params: { label: bookLabel, step: "preview" },
      search: {},
      replace: true,
    })
  }, [bookLabel, currentPreviewPage.href, navigate, navigatePreviewToHref, ready, search.previewHref])

  if (!storyboardDone) {
    return (
      <div className="p-6 max-w-xl flex flex-col items-center gap-3 text-center">
        <AlertCircle className="w-8 h-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          A storyboard must be built before previewing.
        </p>
        <p className="text-sm text-muted-foreground">
          Run the pipeline through
          at least the <span className="font-medium text-foreground">Storyboard</span> stage first.
        </p>
      </div>
    )
  }

  if (packaging) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span className="text-sm">Packaging preview...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 max-w-xl">
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
          <p className="text-xs text-red-700 whitespace-pre-wrap break-words">{error}</p>
        </div>
      </div>
    )
  }

  if (ready) {
    return (
      <div className="relative h-full w-full bg-muted/20">
        <iframe
          ref={iframeRef}
          src={`${getAdtUrl(bookLabel)}/v-${version}/`}
          className="h-full w-full border-0"
          title="ADT Preview"
          onLoad={syncCurrentPreviewPage}
        />

        <PreviewAccessibilityCard
          label={bookLabel}
          assessment={assessment}
          isLoading={assessmentLoading}
          error={assessmentError ?? null}
          currentPage={currentPageSummary ?? (currentPreviewPage.href ? {
            sectionId: currentPreviewPage.sectionId ?? currentPreviewPage.href,
            href: currentPreviewPage.href,
            title: currentPreviewPage.title,
            issueCount: 0,
            reviewCount: 0,
            totalCount: 0,
            hasError: false,
            status: "clean",
            categories: [],
          } : null)}
          currentPageResult={matchedPage}
          panelOpen={panelOpen}
          otherCardExpanded={validationCardExpanded}
          highlightMode={highlightMode}
          onHighlightModeChange={setHighlightMode}
          onExpandedChange={setAccessibilityCardExpanded}
          onOpenValidation={() => navigate({
            to: "/books/$label/$step",
            params: { label: bookLabel, step: "validation" },
          })}
        />

        <PreviewValidationCard
          label={bookLabel}
          panelOpen={panelOpen}
          otherCardExpanded={accessibilityCardExpanded}
          currentPage={currentValidationPage}
          onNavigateToPage={navigatePreviewToHref}
          onExpandedChange={setValidationCardExpanded}
          onOpenValidation={() => navigate({
            to: "/books/$label/$step",
            params: { label: bookLabel, step: "validation" },
            search: { tab: "reviewer-validation" },
          })}
        />
      </div>
    )
  }

  return null
}

function deriveReviewPageId(sectionId: string | null, href: string | null): string | null {
  if (sectionId) {
    const sectionMatch = sectionId.match(/^(.+)_sec\d{3}$/)
    if (sectionMatch) {
      return sectionMatch[1] ?? null
    }
    return sectionId
  }

  if (href) {
    const fileName = href.split("/").pop() ?? href
    return fileName.replace(/\.html$/i, "") || null
  }

  return null
}

function deriveReviewPageNumber(pageId: string | null): number | null {
  if (!pageId) {
    return null
  }

  const match = pageId.match(/pg0*(\d+)/i)
  if (!match) {
    return null
  }

  const value = Number(match[1])
  return Number.isFinite(value) && value > 0 ? value : null
}

function clearAccessibilityHighlights(iframe: HTMLIFrameElement | null): void {
  const doc = iframe?.contentDocument
  if (!doc) {
    return
  }

  highlightCleanupByDocument.get(doc)?.abort()
  highlightCleanupByDocument.delete(doc)

  for (const tooltip of doc.querySelectorAll(`#${TOOLTIP_ID}, .adt-a11y-tooltip`)) {
    tooltip.remove()
  }
  doc.getElementById(HIGHLIGHT_STYLE_ID)?.remove()

  for (const element of doc.querySelectorAll(`[${ISSUE_ATTR}], [${REVIEW_ATTR}], [${HOVER_ATTR}]`)) {
    element.removeAttribute(ISSUE_ATTR)
    element.removeAttribute(REVIEW_ATTR)
    element.removeAttribute(HOVER_ATTR)
  }
}

function applyAccessibilityHighlights(
  iframe: HTMLIFrameElement | null,
  page: AccessibilityPageResult,
): void {
  const doc = iframe?.contentDocument
  if (!doc) {
    return
  }

  clearAccessibilityHighlights(iframe)
  ensureHighlightStyles(doc)

  const controller = new AbortController()
  highlightCleanupByDocument.set(doc, controller)

  const entriesByElement = new Map<Element, ElementHighlightEntry[]>()

  for (const violation of page.violations) {
    for (const node of violation.nodes) {
      const entry: ElementHighlightEntry = {
        kind: "issue",
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        description: violation.description,
        failureSummary: node.failureSummary ?? null,
      }
      for (const selector of node.target) {
        for (const element of querySelectorAllSafe(doc, selector)) {
          const entries = entriesByElement.get(element) ?? []
          entries.push(entry)
          entriesByElement.set(element, entries)
        }
      }
    }
  }

  for (const review of page.incomplete) {
    for (const node of review.nodes) {
      const entry: ElementHighlightEntry = {
        kind: "review",
        id: review.id,
        impact: review.impact,
        help: review.help,
        description: review.description,
        failureSummary: node.failureSummary ?? null,
      }
      for (const selector of node.target) {
        for (const element of querySelectorAllSafe(doc, selector)) {
          const entries = entriesByElement.get(element) ?? []
          entries.push(entry)
          entriesByElement.set(element, entries)
        }
      }
    }
  }

  for (const [element, entries] of entriesByElement.entries()) {
    const dedupedEntries = dedupeHighlightEntries(entries)
    if (dedupedEntries.some((entry) => entry.kind === "issue")) {
      element.setAttribute(ISSUE_ATTR, "true")
    } else {
      element.setAttribute(REVIEW_ATTR, "true")
    }
    entriesByElement.set(element, dedupedEntries)
  }

  const tooltip = getTooltipElement(doc)
  let activeElement: Element | null = null

  const hideTooltip = () => {
    if (controller.signal.aborted) {
      return
    }
    activeElement = null
    setHoveredElement(doc, null)
    tooltip.style.display = "none"
  }

  const inspectAtPoint = (clientX: number, clientY: number) => {
    if (controller.signal.aborted) {
      return
    }

    const highlighted = doc
      .elementsFromPoint(clientX, clientY)
      .find((candidate) => entriesByElement.has(candidate))

    if (!highlighted) {
      hideTooltip()
      return
    }

    if (activeElement !== highlighted) {
      activeElement = highlighted
      setHoveredElement(doc, highlighted)
      renderHighlightTooltip(tooltip, doc, entriesByElement.get(highlighted) ?? [], controller.signal)
    }

    positionHighlightTooltip(tooltip, doc, highlighted, clientX, clientY, controller.signal)
  }

  doc.addEventListener("mousemove", (event) => {
    const mouseEvent = event as MouseEvent
    inspectAtPoint(mouseEvent.clientX, mouseEvent.clientY)
  }, { signal: controller.signal, passive: true })

  doc.documentElement.addEventListener("mouseleave", hideTooltip, { signal: controller.signal })
  doc.defaultView?.addEventListener("scroll", hideTooltip, { signal: controller.signal, passive: true })
  doc.defaultView?.addEventListener("resize", hideTooltip, { signal: controller.signal })
}

function dedupeHighlightEntries(entries: ElementHighlightEntry[]): ElementHighlightEntry[] {
  const seen = new Set<string>()
  const deduped: ElementHighlightEntry[] = []

  for (const entry of entries) {
    const key = JSON.stringify(entry)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    deduped.push(entry)
  }

  return deduped
}

function setHoveredElement(doc: Document, element: Element | null): void {
  for (const highlighted of doc.querySelectorAll(`[${HOVER_ATTR}]`)) {
    highlighted.removeAttribute(HOVER_ATTR)
  }

  if (element) {
    element.setAttribute(HOVER_ATTR, "true")
  }
}

function getTooltipElement(doc: Document): HTMLDivElement {
  const existingTooltips = Array.from(doc.querySelectorAll(`#${TOOLTIP_ID}, .adt-a11y-tooltip`))
  const primary = existingTooltips.find((node): node is HTMLDivElement => node instanceof HTMLDivElement)
  if (primary) {
    primary.id = TOOLTIP_ID
    for (const extra of existingTooltips) {
      if (extra !== primary) {
        extra.remove()
      }
    }
    return primary
  }

  const tooltip = doc.createElement("div")
  tooltip.id = TOOLTIP_ID
  tooltip.className = "adt-a11y-tooltip"
  tooltip.style.display = "none"
  tooltip.style.position = "fixed"
  tooltip.style.left = "12px"
  tooltip.style.top = "12px"
  tooltip.style.zIndex = "2147483647"
  tooltip.style.maxWidth = "320px"
  tooltip.style.minWidth = "220px"
  tooltip.style.maxHeight = "260px"
  tooltip.style.overflow = "auto"
  tooltip.style.pointerEvents = "none"
  tooltip.style.border = "1px solid rgba(148, 163, 184, 0.42)"
  tooltip.style.borderRadius = "12px"
  tooltip.style.background = "rgba(255, 255, 255, 0.98)"
  tooltip.style.boxShadow = "0 12px 28px rgba(15, 23, 42, 0.18)"
  tooltip.style.color = "rgb(15, 23, 42)"
  tooltip.style.padding = "10px 12px"
  tooltip.style.fontFamily = "ui-sans-serif, system-ui, sans-serif"
  tooltip.style.fontSize = "12px"
  tooltip.style.lineHeight = "1.45"
  doc.body.appendChild(tooltip)
  return tooltip
}

function renderHighlightTooltip(tooltip: HTMLDivElement, doc: Document, entries: ElementHighlightEntry[], signal?: AbortSignal): void {
  if (signal?.aborted) {
    return
  }

  tooltip.replaceChildren()
  tooltip.style.display = entries.length > 0 ? "block" : "none"

  if (entries.length === 0) {
    return
  }

  const title = doc.createElement("div")
  title.className = "adt-a11y-tooltip__title"
  title.textContent = entries.length === 1 ? "Accessibility finding" : `${entries.length} findings on this element`
  tooltip.appendChild(title)

  for (const entry of entries.slice(0, 3)) {
    const item = doc.createElement("div")
    item.className = "adt-a11y-tooltip__item"

    const meta = doc.createElement("div")
    meta.className = "adt-a11y-tooltip__meta"

    const kind = doc.createElement("span")
    kind.className = `adt-a11y-tooltip__badge ${entry.kind === "issue" ? "is-issue" : "is-review"}`
    kind.textContent = entry.kind === "issue" ? "Issue" : "Review"
    meta.appendChild(kind)

    const rule = doc.createElement("span")
    rule.className = "adt-a11y-tooltip__rule"
    rule.textContent = entry.id
    meta.appendChild(rule)

    if (entry.impact) {
      const impact = doc.createElement("span")
      impact.className = "adt-a11y-tooltip__impact"
      impact.textContent = entry.impact
      meta.appendChild(impact)
    }

    item.appendChild(meta)

    const help = doc.createElement("div")
    help.className = "adt-a11y-tooltip__help"
    help.textContent = entry.help
    item.appendChild(help)

    const description = doc.createElement("div")
    description.className = "adt-a11y-tooltip__description"
    description.textContent = entry.description
    item.appendChild(description)

    if (entry.failureSummary) {
      const failure = doc.createElement("div")
      failure.className = "adt-a11y-tooltip__failure"
      failure.textContent = entry.failureSummary
      item.appendChild(failure)
    }

    tooltip.appendChild(item)
  }

  if (entries.length > 3) {
    const more = doc.createElement("div")
    more.className = "adt-a11y-tooltip__more"
    more.textContent = `+${entries.length - 3} more findings on this element`
    tooltip.appendChild(more)
  }
}

function positionHighlightTooltip(
  tooltip: HTMLDivElement,
  doc: Document,
  element: Element,
  clientX: number,
  clientY: number,
  signal?: AbortSignal,
): void {
  if (signal?.aborted) {
    return
  }

  if (tooltip.style.display === "none") {
    return
  }

  const rect = element.getBoundingClientRect()
  const viewportWidth = doc.documentElement.clientWidth
  const viewportHeight = doc.documentElement.clientHeight
  const tooltipRect = tooltip.getBoundingClientRect()

  let left = clientX + 16
  let top = clientY + 16

  if (left + tooltipRect.width > viewportWidth - 12) {
    left = Math.max(12, rect.left - tooltipRect.width - 12)
  }
  if (top + tooltipRect.height > viewportHeight - 12) {
    top = Math.max(12, rect.top - tooltipRect.height - 12)
  }

  tooltip.style.left = `${Math.round(left)}px`
  tooltip.style.top = `${Math.round(top)}px`
}

function ensureHighlightStyles(doc: Document): void {
  if (doc.getElementById(HIGHLIGHT_STYLE_ID)) {
    return
  }

  const style = doc.createElement("style")
  style.id = HIGHLIGHT_STYLE_ID
  style.textContent = `
    [${ISSUE_ATTR}="true"] {
      outline: 2px solid rgba(220, 38, 38, 0.95) !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.12) !important;
      transition: outline-color 120ms ease, box-shadow 120ms ease;
    }

    [${REVIEW_ATTR}="true"] {
      outline: 2px solid rgba(217, 119, 6, 0.95) !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 4px rgba(217, 119, 6, 0.12) !important;
      transition: outline-color 120ms ease, box-shadow 120ms ease;
    }

    [${HOVER_ATTR}="true"] {
      outline: 2px solid rgba(37, 99, 235, 0.98) !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.98), 0 0 0 6px rgba(37, 99, 235, 0.28) !important;
    }

    .adt-a11y-tooltip {
      position: fixed;
      left: 12px;
      top: 12px;
      z-index: 2147483647;
      max-width: 320px;
      min-width: 220px;
      border: 1px solid rgba(148, 163, 184, 0.42);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.98);
      color: rgb(15, 23, 42);
      pointer-events: none;
    }

    .adt-a11y-tooltip__title {
      font-weight: 700;
      font-size: 12px;
      margin-bottom: 6px;
    }

    .adt-a11y-tooltip__item + .adt-a11y-tooltip__item {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid rgba(226, 232, 240, 1);
    }

    .adt-a11y-tooltip__meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }

    .adt-a11y-tooltip__badge {
      display: inline-flex;
      align-items: center;
      padding: 1px 6px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.01em;
      text-transform: uppercase;
    }

    .adt-a11y-tooltip__badge.is-issue {
      background: rgb(254, 226, 226);
      color: rgb(153, 27, 27);
    }

    .adt-a11y-tooltip__badge.is-review {
      background: rgb(254, 243, 199);
      color: rgb(146, 64, 14);
    }

    .adt-a11y-tooltip__rule {
      font-family: ui-monospace, SFMono-Regular, monospace;
      font-size: 11px;
      color: rgb(51, 65, 85);
    }

    .adt-a11y-tooltip__impact {
      color: rgb(100, 116, 139);
      text-transform: capitalize;
      font-size: 11px;
    }

    .adt-a11y-tooltip__help {
      font-weight: 600;
      margin-bottom: 2px;
    }

    .adt-a11y-tooltip__description,
    .adt-a11y-tooltip__failure,
    .adt-a11y-tooltip__more {
      color: rgb(71, 85, 105);
      white-space: pre-wrap;
    }

    .adt-a11y-tooltip__failure {
      margin-top: 6px;
      padding: 6px 8px;
      border-radius: 8px;
      background: rgb(248, 250, 252);
      font-size: 11px;
    }

    .adt-a11y-tooltip__more {
      margin-top: 8px;
      font-size: 11px;
      color: rgb(100, 116, 139);
    }
  `
  doc.head.appendChild(style)
}

function querySelectorAllSafe(doc: Document, selector: string): Element[] {
  try {
    return Array.from(doc.querySelectorAll(selector))
  } catch {
    return []
  }
}
