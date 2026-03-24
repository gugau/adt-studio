import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { api, getAdtUrl } from "@/api/client"
import { useDebugPanelState } from "@/components/debug/debug-panel-state"
import { useAccessibilityAssessment } from "@/hooks/use-debug"
import { useBookRun } from "@/hooks/use-book-run"
import { useBookTasks } from "@/hooks/use-book-tasks"
import {
  findAccessibilityPage,
  normalizeAccessibilityHref,
  summarizeAccessibilityPage,
} from "@/lib/accessibility-summary"
import { PreviewAccessibilityCard } from "./PreviewAccessibilityCard"
import { PreviewValidationCard } from "./PreviewValidationCard"

const HIGHLIGHT_STYLE_ID = "adt-preview-a11y-highlights"
const HIGHLIGHT_ATTR = "data-adt-a11y-hover"

export function PreviewView({ bookLabel }: { bookLabel: string }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { previewHref?: string }
  const { stageState } = useBookRun()
  const { isTaskRunning, tasks } = useBookTasks(bookLabel)
  const storyboardDone = stageState("storyboard") === "done"
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const ranRef = useRef(false)
  const { panelOpen } = useDebugPanelState()
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [version, setVersion] = useState(0)
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

  const highlightFindingTargets = useCallback((targets: string[] | null) => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    clearHighlight(doc)
    if (!targets || targets.length === 0) return
    ensureHighlightStyles(doc)
    for (const selector of targets) {
      for (const el of querySelectorAllSafe(doc, selector)) {
        el.setAttribute(HIGHLIGHT_ATTR, "true")
      }
    }
  }, [])

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

  const packaging = isTaskRunning("package-adt")

  const prevPackagingRef = useRef(false)
  useEffect(() => {
    if (prevPackagingRef.current && !packaging) {
      const packagingTask = tasks.find((task) => task.kind === "package-adt")
      if (packagingTask?.status === "failed") {
        setError(packagingTask.error ?? "Packaging failed")
      } else {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "step-status"] }),
          queryClient.invalidateQueries({ queryKey: ["debug", "accessibility", bookLabel] }),
          queryClient.invalidateQueries({ queryKey: ["debug", "versions", bookLabel, "accessibility-assessment", "book"] }),
        ]).then(() => {
          setVersion((value) => Math.max(value + 1, Date.now()))
          setReady(true)
        })
      }
    }
    prevPackagingRef.current = packaging
  }, [bookLabel, packaging, queryClient, tasks])

  const runPackage = useCallback(async () => {
    setError(null)
    setReady(false)
    setCurrentPreviewPage({ sectionId: null, href: null, title: null, hasImages: false, hasActivity: false, signLanguageEnabled: false })
    try {
      await api.packageAdt(bookLabel)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Packaging failed")
    }
  }, [bookLabel])

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
          onExpandedChange={setAccessibilityCardExpanded}
          onFindingHover={highlightFindingTargets}
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

function clearHighlight(doc: Document): void {
  for (const el of doc.querySelectorAll(`[${HIGHLIGHT_ATTR}]`)) {
    el.removeAttribute(HIGHLIGHT_ATTR)
  }
}

function ensureHighlightStyles(doc: Document): void {
  if (doc.getElementById(HIGHLIGHT_STYLE_ID)) return
  const style = doc.createElement("style")
  style.id = HIGHLIGHT_STYLE_ID
  style.textContent = `
    [${HIGHLIGHT_ATTR}="true"] {
      outline: 2px solid rgba(37, 99, 235, 0.98) !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.98), 0 0 0 6px rgba(37, 99, 235, 0.28) !important;
      transition: outline-color 120ms ease, box-shadow 120ms ease;
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
