import { useEffect, useMemo, useState } from "react"
import type { AccessibilityAssessmentOutput, AccessibilityPageResult } from "@adt/types"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  FileWarning,
  Loader2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AccessibilityCurrentPagePanel } from "@/components/accessibility/AccessibilityCurrentPagePanel"
import { cn } from "@/lib/utils"
import {
  buildAccessibilityOverview,
  buildFrequentAccessibilityFindings,
  type PageAccessibilitySummary,
} from "@/lib/accessibility-summary"

interface PreviewAccessibilityCardProps {
  label: string
  assessment: AccessibilityAssessmentOutput | null | undefined
  isLoading: boolean
  error: Error | null
  currentPage: PageAccessibilitySummary | null
  currentPageResult: AccessibilityPageResult | null
  panelOpen: boolean
  otherCardExpanded?: boolean
  highlightMode: boolean
  onHighlightModeChange: (enabled: boolean) => void
  onOpenValidation: () => void
  onExpandedChange?: (expanded: boolean) => void
}

const SEVERITY_STYLES = {
  critical: "bg-red-600",
  serious: "bg-orange-500",
  moderate: "bg-amber-400",
  minor: "bg-yellow-300",
  unknown: "bg-slate-300",
} as const

export function PreviewAccessibilityCard({
  label,
  assessment,
  isLoading,
  error,
  currentPage,
  currentPageResult,
  panelOpen,
  otherCardExpanded = false,
  highlightMode,
  onHighlightModeChange,
  onOpenValidation,
  onExpandedChange,
}: PreviewAccessibilityCardProps) {
  const storageKey = `adt-preview-a11y-card:${label}`
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return true
    }
    return window.sessionStorage.getItem(storageKey) !== "expanded"
  })
  const [showCollapsedCard, setShowCollapsedCard] = useState(() => collapsed && !panelOpen)
  const [collapsedCardVisible, setCollapsedCardVisible] = useState(() => collapsed && !panelOpen)
  const [tab, setTab] = useState<"page" | "total">(currentPageResult ? "page" : "total")

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    window.sessionStorage.setItem(storageKey, collapsed ? "collapsed" : "expanded")
  }, [collapsed, storageKey])

  useEffect(() => {
    if (panelOpen) {
      setCollapsed(true)
    }
  }, [panelOpen])


  useEffect(() => {
    onExpandedChange?.(!collapsed)
  }, [collapsed, onExpandedChange])

  useEffect(() => {
    if (!collapsed) {
      setTab(currentPageResult ? "page" : "total")
    }
  }, [collapsed, currentPageResult])

  useEffect(() => {
    if (!collapsed || panelOpen || otherCardExpanded) {
      setCollapsedCardVisible(false)
      setShowCollapsedCard(false)
      return
    }

    if (typeof window === "undefined") {
      setShowCollapsedCard(true)
      setCollapsedCardVisible(true)
      return
    }

    const timeoutId = window.setTimeout(() => {
      setShowCollapsedCard(true)
      window.requestAnimationFrame(() => {
        setCollapsedCardVisible(true)
      })
    }, 140)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [collapsed, otherCardExpanded, panelOpen])

  const overview = useMemo(
    () => (assessment ? buildAccessibilityOverview(assessment) : null),
    [assessment],
  )
  const frequentFindings = useMemo(
    () => (assessment ? buildFrequentAccessibilityFindings(assessment, { limit: 3 }) : []),
    [assessment],
  )

  const overallIssueCount = overview?.totalChecks ?? 0
  const pagesWithFindings = assessment
    ? assessment.pages.filter((page) => page.violationCount > 0 || page.incompleteCount > 0 || Boolean(page.error)).length
    : 0
  const overallSummary = assessment
    ? `${overallIssueCount} total findings`
    : isLoading
      ? "Checking accessibility"
      : error
        ? "Unavailable"
        : "No assessment"
  const pageSummary = currentPage
    ? currentPage.hasError
      ? "Accessibility check failed for this page"
      : `${currentPage.totalCount} ${currentPage.totalCount === 1 ? "finding" : "findings"} this page`
    : assessment
      ? "Open a page to see page-level findings"
      : isLoading
        ? "Loading page-level findings"
        : "Package preview to generate results"

  if (collapsed) {
    if (!showCollapsedCard) {
      return null
    }

    return (
      <button
        type="button"
        className={cn(
          "fixed bottom-14 right-4 z-40 flex w-[min(22.5rem,calc(100vw-2rem))] items-start gap-3 rounded-2xl border bg-background/95 px-3.5 py-3 text-left shadow-md backdrop-blur-sm transition-all duration-150 ease-out supports-[backdrop-filter]:bg-background/90",
          collapsedCardVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0",
        )}
        onClick={() => setCollapsed(false)}
        title="Show accessibility summary"
      >
        <div className="mt-0.5 shrink-0">
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : error ? (
            <FileWarning className="h-3.5 w-3.5 text-destructive" />
          ) : assessment?.summary.violationCount || assessment?.summary.incompleteCount ? (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Accessibility</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{overallSummary}</span>
          </div>
          <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{pageSummary}</div>
        </div>

        <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
    )
  }

  return (
    <div className="absolute right-4 top-4 z-20 flex max-h-[calc(100%-2rem)] w-[440px] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-3xl border bg-background/95 shadow-xl backdrop-blur-sm supports-[backdrop-filter]:bg-background/90">
      <div className="flex items-start gap-3 border-b px-4 py-3.5">
        <div className="mt-0.5 shrink-0">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : error ? (
            <FileWarning className="h-4 w-4 text-destructive" />
          ) : assessment?.summary.violationCount || assessment?.summary.incompleteCount ? (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Accessibility</h3>
            {assessment ? <Badge variant="outline">axe-core</Badge> : null}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {assessment
              ? `Latest package scan from ${new Date(assessment.generatedAt).toLocaleString()}`
              : isLoading
                ? "Refreshing results for this packaged preview."
                : error
                  ? "Accessibility results are temporarily unavailable."
                  : "Package this preview to generate accessibility results."}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full"
          onClick={() => setCollapsed(true)}
          title="Collapse accessibility summary"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as "page" | "total")} className="flex min-h-0 flex-1 flex-col">
        <div className="border-b px-4 py-2.5">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted/70 p-1">
            <TabsTrigger value="page" className="px-3 py-2 text-xs">
              This page findings
            </TabsTrigger>
            <TabsTrigger value="total" className="px-3 py-2 text-xs">
              Total findings
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 pb-4 pt-3 text-sm">
          <TabsContent value="page" className="m-0 space-y-3.5">
            <AccessibilityCurrentPagePanel
              page={currentPageResult}
              summary={currentPage}
              embedded
              emptyMessage="Open a page in Preview to show its page-specific accessibility findings here."
            />

            <div className="rounded-2xl border bg-muted/20 px-3.5 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Accessibility mode</div>
                  <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Outline the current page’s flagged elements directly in Preview.
                  </div>
                </div>
                <Button
                  variant={highlightMode ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => onHighlightModeChange(!highlightMode)}
                  disabled={!currentPageResult}
                >
                  {highlightMode ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  {highlightMode ? "On" : "Off"}
                </Button>
              </div>
              <div className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                {currentPageResult
                  ? highlightMode
                    ? "Confirmed findings are outlined in red. Needs-review items are outlined in amber."
                    : "Turn this on when you want to inspect the current page directly in Preview."
                  : "Open a page in Preview to enable inline highlights."}
              </div>
            </div>

            <div className="flex items-center justify-end border-t pt-2">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onOpenValidation}>
                <ExternalLink className="h-3.5 w-3.5" />
                Open Validation
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="total" className="m-0 space-y-3.5">
            {assessment && overview ? (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <MetricTile label="Pages audited" value={assessment.summary.pageCount} />
                  <MetricTile label="Pages with findings" value={pagesWithFindings} tone={pagesWithFindings > 0 ? "warning" : "success"} />
                  <MetricTile label="Total findings" value={assessment.summary.violationCount + assessment.summary.incompleteCount} tone={assessment.summary.violationCount > 0 ? "warning" : "default"} />
                  <MetricTile label="Needs review" value={assessment.summary.incompleteCount} />
                </div>

                <div className="rounded-2xl border bg-card/70 px-3.5 py-3.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Severity</span>
                    <span>{assessment.summary.violationCount} confirmed findings</span>
                  </div>
                  <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
                    {Object.entries(overview.severity).map(([key, count]) => (
                      count > 0 ? (
                        <div
                          key={key}
                          className={SEVERITY_STYLES[key as keyof typeof SEVERITY_STYLES]}
                          style={{ width: `${(count / Math.max(assessment.summary.violationCount, 1)) * 100}%` }}
                        />
                      ) : null
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(overview.severity).map(([key, count]) => (
                      count > 0 ? (
                        <Badge key={key} variant="secondary" className="text-[11px] capitalize">
                          {key} {count}
                        </Badge>
                      ) : null
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border bg-card/70 px-3.5 py-3.5">
                  <div className="text-xs font-medium text-muted-foreground">Issue areas</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {overview.categories.slice(0, 6).map((category) => (
                      <Badge key={category.key} variant="outline" className="max-w-full text-[11px]">
                        <span className="truncate">{category.label}</span>
                        <span className="ml-1 text-muted-foreground">{category.count}</span>
                      </Badge>
                    ))}
                    {overview.categories.length === 0 ? (
                      <Badge variant="outline" className="text-[11px]">No findings reported</Badge>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border bg-card/70 px-3.5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">Recurring book-wide findings</div>
                      <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        Repeated patterns across the packaged ADT output.
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onOpenValidation}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open Validation
                    </Button>
                  </div>

                  <div className="mt-3 space-y-2.5">
                    {frequentFindings.map((finding) => (
                      <div key={`${finding.reviewOnly ? "review" : "violation"}-${finding.id}`} className="rounded-xl border bg-background/70 px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={finding.reviewOnly ? "outline" : "destructive"} className="font-mono text-[11px]">
                            {finding.id}
                          </Badge>
                          <Badge variant="secondary" className="text-[11px]">
                            {formatCoverageLabel(finding.pagesAffected, assessment.summary.pageCount)}
                          </Badge>
                          <Badge variant="outline" className="text-[11px]">
                            {finding.categoryLabel}
                          </Badge>
                        </div>
                        <div className="mt-2 text-sm font-medium leading-snug">{finding.help}</div>
                        <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                          {finding.count} observations across {finding.pagesAffected} {finding.pagesAffected === 1 ? "page" : "pages"}
                        </div>
                      </div>
                    ))}
                    {frequentFindings.length === 0 ? (
                      <div className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
                        No repeated findings were reported.
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border bg-card/70 px-4 py-4 text-sm text-muted-foreground">
                {error ? error.message : "No accessibility summary is available yet."}
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

function MetricTile({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: number
  tone?: "default" | "warning" | "success"
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3.5 py-3",
        tone === "warning"
          ? "border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/20"
          : tone === "success"
            ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/20"
            : "bg-card/70",
      )}
    >
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function formatCoverageLabel(pagesAffected: number, totalPages: number): string {
  if (totalPages > 0 && pagesAffected === totalPages) {
    return "All pages"
  }
  if (pagesAffected === 1) {
    return "1 page"
  }
  return `${pagesAffected} pages`
}
