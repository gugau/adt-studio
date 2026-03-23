import { useEffect, useMemo, useState } from "react"
import type { AccessibilityCategoryKey, AccessibilitySeverity } from "@/lib/accessibility-summary"
import {
  ChevronDown,
  ChevronRight,
  Download,
} from "lucide-react"
import { useNavigate } from "@tanstack/react-router"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useBookConfig, useUpdateBookConfig } from "@/hooks/use-book-config"
import { useAccessibilityAssessment, useVersionHistory } from "@/hooks/use-debug"
import { buildAccessibilityOverview, buildFrequentAccessibilityFindings } from "@/lib/accessibility-summary"
import { cn } from "@/lib/utils"

interface AccessibilityTabProps {
  label: string
}

const SEVERITY_ORDER: AccessibilitySeverity[] = ["critical", "serious", "moderate", "minor", "unknown"]
const SEVERITY_LABELS: Record<AccessibilitySeverity, string> = {
  critical: "Critical",
  serious: "Serious",
  moderate: "Moderate",
  minor: "Minor",
  unknown: "Unknown",
}

function SummaryCard({
  label,
  value,
  tone = "default",
  active = false,
  onClick,
}: {
  label: string
  value: number | string
  tone?: "default" | "error" | "warning" | "caution" | "success" | "info" | "muted"
  active?: boolean
  onClick?: () => void
}) {
  const toneClass =
    tone === "error"
      ? "border-red-500 bg-red-50/50 dark:bg-red-950/10"
      : tone === "warning"
        ? "border-orange-500 bg-orange-50/40 dark:bg-orange-950/10"
        : tone === "caution"
          ? "border-yellow-500 bg-yellow-50/40 dark:bg-yellow-950/10"
          : tone === "success"
            ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/10"
            : tone === "info"
              ? "border-blue-500 bg-blue-50/40 dark:bg-blue-950/10"
              : tone === "muted"
                ? "border-gray-400 bg-muted/40"
                : "bg-card"

  const classes = cn(
    "rounded-lg border-2 p-4 text-left transition-colors",
    toneClass,
    onClick ? "cursor-pointer hover:border-primary/40 hover:bg-muted/60" : "",
    active ? "ring-2 ring-primary/35 border-primary/40" : "",
  )

  const content = (
    <>
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </>
  )

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick}>
        {content}
      </button>
    )
  }

  return <div className={classes}>{content}</div>
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

function LoadingState({ message }: { message: string }) {
  return <div className="p-6 text-sm text-muted-foreground">{message}</div>
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="p-6">
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {message}
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="p-6 text-sm text-muted-foreground">{message}</div>
}

function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  setTimeout(() => {
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }, 1500)
}

function formatFindingPageLabel(page: { pageNumber: number | null; title: string | null; href: string }): string {
  if (page.pageNumber != null) {
    return `Page ${page.pageNumber}`
  }
  if (page.title) {
    return page.title
  }
  return page.href
}

function FindingPageLinks({
  pages,
  onOpenPage,
}: {
  pages: Array<{ sectionId: string; href: string; title: string | null; pageNumber: number | null; count: number }>
  onOpenPage: (href: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const visiblePages = expanded ? pages : pages.slice(0, 6)

  return (
    <div className="mt-3 space-y-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Affected pages</div>
      <div className="flex flex-wrap gap-2">
        {visiblePages.map((page) => (
          <Button
            key={page.sectionId}
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-[11px]"
            onClick={() => onOpenPage(page.href)}
          >
            {formatFindingPageLabel(page)}
            <span className="ml-1 text-muted-foreground">({page.count})</span>
          </Button>
        ))}
        {pages.length > 6 ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-[11px]"
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded ? "Show fewer" : `Show all ${pages.length}`}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function FrequentFindingCard({
  finding,
  pageCount,
  onOpenPage,
}: {
  finding: ReturnType<typeof buildFrequentAccessibilityFindings>[number]
  pageCount: number
  onOpenPage: (href: string) => void
}) {
  const coveragePercent = Math.round(finding.pageCoverage * 100)
  const coverageLabel = finding.pagesAffected === pageCount
    ? "All pages"
    : finding.pageCoverage >= 0.6
      ? "Most pages"
      : finding.pagesAffected === 1
        ? "One page"
        : `${finding.pagesAffected} pages`

  return (
    <div className="rounded-lg border px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("font-mono text-[11px]", !finding.reviewOnly && "border-red-200 bg-red-50 text-red-700")}>
              {finding.id}
            </Badge>
            <Badge variant="secondary" className="text-[11px]">{coverageLabel}</Badge>
            <Badge variant="outline" className="text-[11px]">{finding.categoryLabel}</Badge>
            {finding.reviewOnly ? (
              <Badge variant="outline" className="text-[11px]">Needs review</Badge>
            ) : null}
          </div>
          <div className="mt-2 font-medium">{finding.help}</div>
          <div className="mt-1 text-xs text-muted-foreground">{finding.description}</div>
        </div>

        <div className="min-w-[9rem] shrink-0 text-right">
          <div className="text-xs text-muted-foreground">{finding.pagesAffected} of {pageCount} pages</div>
          <div className="mt-1 text-sm font-semibold tabular-nums">{finding.count} observations</div>
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Page coverage</span>
          <span>{coveragePercent}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted">
          <div
            className={cn(
              "h-2 rounded-full",
              finding.reviewOnly
                ? "bg-orange-400"
                : finding.pageCoverage >= 0.6
                  ? "bg-red-500"
                  : "bg-orange-400",
            )}
            style={{ width: `${Math.max(8, coveragePercent)}%` }}
          />
        </div>
      </div>

      <FindingPageLinks pages={finding.pages} onOpenPage={onOpenPage} />
    </div>
  )
}

function SeverityFindingCard({
  finding,
  onOpenPage,
}: {
  finding: ReturnType<typeof buildFrequentAccessibilityFindings>[number]
  onOpenPage: (href: string) => void
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={finding.reviewOnly ? "outline" : "destructive"} className="font-mono text-[11px]">
              {finding.id}
            </Badge>
            <Badge variant="outline" className="text-[11px]">{finding.categoryLabel}</Badge>
            {finding.reviewOnly ? <Badge variant="outline" className="text-[11px]">Needs review</Badge> : null}
          </div>
          <div className="mt-2 font-medium">{finding.help}</div>
          <div className="mt-1 text-xs text-muted-foreground">{finding.description}</div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-xs text-muted-foreground">{finding.pagesAffected} pages affected</div>
          <div className="mt-1 text-sm font-semibold tabular-nums">{finding.count} observations</div>
        </div>
      </div>

      <FindingPageLinks pages={finding.pages} onOpenPage={onOpenPage} />
    </div>
  )
}

function VersionRow({
  version,
  data,
  currentVersion,
  onDownload,
}: {
  version: number
  data?: unknown
  currentVersion: number | null
  onDownload: (version: number, data: unknown) => void
}) {
  const [expanded, setExpanded] = useState(version === currentVersion)

  return (
    <div className="border-b border-border/50 last:border-b-0">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <Button
          variant="ghost"
          className="h-auto flex-1 justify-start rounded-none px-0 py-0 text-xs"
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? <ChevronDown className="mr-2 h-3.5 w-3.5" /> : <ChevronRight className="mr-2 h-3.5 w-3.5" />}
          Version {version}
          {version === currentVersion ? <Badge className="ml-2 text-[10px]">Latest</Badge> : null}
        </Button>

        {data ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => onDownload(version, data)}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            JSON
          </Button>
        ) : null}
      </div>

      {expanded ? (
        <div className="border-t border-border/50 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          {data ? (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-background p-3 text-[11px]">
              {JSON.stringify(data, null, 2)}
            </pre>
          ) : (
            <span>No data stored for this version.</span>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function AccessibilityOverviewTab({ label }: AccessibilityTabProps) {
  const navigate = useNavigate()
  const { data, isLoading, error } = useAccessibilityAssessment(label)
  const history = useVersionHistory(
    label,
    "accessibility-assessment",
    "book",
    true,
    { enabled: !!data?.assessment },
  )
  const [showHistory, setShowHistory] = useState(false)
  const [severityFilter, setSeverityFilter] = useState<AccessibilitySeverity | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<AccessibilityCategoryKey | null>(null)

  if (isLoading) {
    return <LoadingState message="Loading accessibility summary..." />
  }

  if (error) {
    return <ErrorState message={`Failed to load accessibility results: ${error.message}`} />
  }

  if (!data?.assessment) {
    return <EmptyState message="No accessibility assessment has been generated yet. Package the ADT output to create one." />
  }

  const assessment = data.assessment
  const overview = buildAccessibilityOverview(assessment)
  const frequentFindings = buildFrequentAccessibilityFindings(assessment, { limit: 100 })
  const recurringFindings = frequentFindings.filter((finding) => finding.pagesAffected > 1)
  const pagesWithFindings = assessment.pages.filter((page) => page.violations.length > 0 || page.incomplete.length > 0 || page.error).length
  const currentVersion = data.version
  const filteredFindings = severityFilter
    ? frequentFindings.filter((finding) => finding.impact === severityFilter)
    : []
  const filteredPageCount = new Set(
    filteredFindings.flatMap((finding) => finding.pages.map((page) => page.sectionId)),
  ).size
  const categoryFindings = categoryFilter
    ? frequentFindings.filter((finding) => finding.categoryKey === categoryFilter)
    : []
  const categoryPageCount = new Set(
    categoryFindings.flatMap((finding) => finding.pages.map((page) => page.sectionId)),
  ).size

  const openPreviewToPage = (href: string) => {
    void navigate({
      to: "/books/$label/$step",
      params: { label, step: "preview" },
      search: { previewHref: href },
    })
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span><span className="text-muted-foreground">Pages audited</span> <span className="font-semibold tabular-nums">{assessment.summary.pageCount}</span></span>
        <span className="text-muted-foreground/40">&middot;</span>
        <span><span className="text-muted-foreground">With findings</span> <span className="font-semibold tabular-nums">{pagesWithFindings}</span></span>
        <span className="text-muted-foreground/40">&middot;</span>
        <span><span className="text-muted-foreground">Total findings</span> <span className="font-semibold tabular-nums">{overview.totalChecks}</span></span>
        <span className="text-muted-foreground/40">&middot;</span>
        <span><span className="text-muted-foreground">Violations</span> <span className="font-semibold tabular-nums">{assessment.summary.violationCount}</span></span>
        <span className="text-muted-foreground/40">&middot;</span>
        <span><span className="text-muted-foreground">Needs review</span> <span className="font-semibold tabular-nums">{assessment.summary.incompleteCount}</span></span>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => downloadJson(assessment, `${label}-accessibility.json`)}
          >
            <Download className="h-3.5 w-3.5" />
            JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowHistory((open) => !open)}
          >
            {showHistory ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {showHistory ? "Hide history" : "Show history"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-medium">Severity distribution</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Select a severity level to inspect the related findings and jump directly to affected pages in Preview.
            </p>
          </div>
          {severityFilter ? (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSeverityFilter(null)}>
              Clear selection
            </Button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {SEVERITY_ORDER.map((severity) => {
            const count = overview.severity[severity]
            const tone = severity === "critical" || severity === "serious"
              ? (count > 0 ? "warning" : "success")
              : severity === "moderate"
                ? (count > 0 ? "warning" : "default")
                : severity === "minor"
                  ? (count > 0 ? "default" : "success")
                  : "default"
            return (
              <SummaryCard
                key={severity}
                label={SEVERITY_LABELS[severity]}
                value={count}
                tone={tone}
                active={severityFilter === severity}
                onClick={count > 0 ? () => setSeverityFilter((current) => current === severity ? null : severity) : undefined}
              />
            )
          })}
        </div>
        {!severityFilter ? (
          <div className="mt-4 rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            No severity selected yet. Click a severity card above to inspect the findings behind that count.
          </div>
        ) : null}
      </div>

      {severityFilter ? (
        <div className="space-y-4 rounded-xl border border-primary/25 bg-primary/5 p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-primary/15 pb-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="border-primary/20 bg-primary/10 text-[11px] text-primary hover:bg-primary/10">Severity detail</Badge>
                <Badge variant="outline" className="border-primary/30 bg-background/80 text-[11px]">{SEVERITY_LABELS[severityFilter]}</Badge>
              </div>
              <div>
                <h4 className="text-sm font-medium">{SEVERITY_LABELS[severityFilter]} findings</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  {filteredFindings.length} grouped findings across {filteredPageCount} page{filteredPageCount === 1 ? "" : "s"}. Use the page links below to open the affected page in Preview.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="h-8 border-primary/20 bg-background/80 text-xs hover:bg-background" onClick={() => setSeverityFilter(null)}>
              Back to summary
            </Button>
          </div>
          {filteredFindings.length > 0 ? (
            <div className="space-y-3">
              {filteredFindings.map((finding) => (
                <SeverityFindingCard
                  key={`${finding.reviewOnly ? "review" : "violation"}:${finding.id}`}
                  finding={finding}
                  onOpenPage={openPreviewToPage}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed px-4 py-4 text-sm text-muted-foreground">
              No findings were reported for this severity.
            </div>
          )}
        </div>
      ) : null}

      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-medium">Categories</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Select a category to inspect the related findings and where they occur.
            </p>
          </div>
          {categoryFilter ? (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setCategoryFilter(null)}>
              Clear selection
            </Button>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {overview.categories.map((category) => (
            <button
              key={category.key}
              type="button"
              onClick={() => setCategoryFilter((current) => current === category.key ? null : category.key)}
              className={cn(
                "inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] transition-colors",
                categoryFilter === category.key
                  ? "border-primary/35 bg-primary/10 text-primary ring-1 ring-primary/20"
                  : "border-border bg-background hover:border-primary/30 hover:bg-muted",
              )}
            >
              {category.label}
              <span className="ml-1 text-muted-foreground">{category.count}</span>
            </button>
          ))}
          {overview.categories.length === 0 ? (
            <span className="text-xs text-muted-foreground">No finding categories reported.</span>
          ) : null}
        </div>
        {!categoryFilter ? (
          <div className="mt-4 rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            No category selected yet. Click a category chip above to inspect the findings behind that count.
          </div>
        ) : null}
      </div>

      {categoryFilter ? (
        <div className="space-y-4 rounded-xl border border-primary/25 bg-primary/5 p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-primary/15 pb-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="border-primary/20 bg-primary/10 text-[11px] text-primary hover:bg-primary/10">Category detail</Badge>
                <Badge variant="outline" className="border-primary/30 bg-background/80 text-[11px]">
                  {overview.categories.find((category) => category.key === categoryFilter)?.label ?? categoryFilter}
                </Badge>
              </div>
              <div>
                <h4 className="text-sm font-medium">
                  {overview.categories.find((category) => category.key === categoryFilter)?.label ?? categoryFilter} findings
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  {categoryFindings.length} grouped findings across {categoryPageCount} page{categoryPageCount === 1 ? "" : "s"}. Use the page links below to open the affected page in Preview.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="h-8 border-primary/20 bg-background/80 text-xs hover:bg-background" onClick={() => setCategoryFilter(null)}>
              Back to summary
            </Button>
          </div>
          {categoryFindings.length > 0 ? (
            <div className="space-y-3">
              {categoryFindings.map((finding) => (
                <SeverityFindingCard
                  key={`category:${finding.reviewOnly ? "review" : "violation"}:${finding.id}`}
                  finding={finding}
                  onOpenPage={openPreviewToPage}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed px-4 py-4 text-sm text-muted-foreground">
              No findings were reported for this category.
            </div>
          )}
        </div>
      ) : null}

      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-medium">Recurring book-wide findings</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Findings that recur across multiple pages and are most likely to reflect shared template or workflow patterns.
          </p>
        </div>
        {recurringFindings.length > 0 ? (
          <div className="space-y-3">
            {recurringFindings.map((finding) => (
              <FrequentFindingCard
                key={`${finding.reviewOnly ? "review" : "violation"}:${finding.id}`}
                finding={finding}
                pageCount={assessment.summary.pageCount}
                onOpenPage={openPreviewToPage}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed px-4 py-4 text-sm text-muted-foreground">
            No recurring book-wide findings were reported.
          </div>
        )}
      </div>

      {showHistory ? (
        <div className="rounded-xl border bg-card">
          <div className="border-b px-4 py-3">
            <h4 className="text-sm font-medium">Assessment history</h4>
            <p className="mt-1 text-xs text-muted-foreground">Versioned accessibility assessment outputs for this book.</p>
          </div>

          {history.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading history…</div>
          ) : history.error ? (
            <div className="p-4 text-sm text-red-700">Failed to load history: {history.error.message}</div>
          ) : history.data?.versions.length ? (
            history.data.versions.map((entry) => (
              <VersionRow
                key={entry.version}
                version={entry.version}
                data={entry.data}
                currentVersion={currentVersion}
                onDownload={(version, versionData) => {
                  downloadJson(versionData, `${label}-accessibility-v${version}.json`)
                }}
              />
            ))
          ) : (
            <div className="p-4 text-xs text-muted-foreground">No previous versions found.</div>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function AccessibilityConfigTab({ label }: AccessibilityTabProps) {
  const [runOnlyTagsInput, setRunOnlyTagsInput] = useState("")
  const [disabledRulesInput, setDisabledRulesInput] = useState("")
  const [configDirty, setConfigDirty] = useState(false)

  const { data } = useAccessibilityAssessment(label)
  const { data: bookConfigData } = useBookConfig(label)
  const updateConfig = useUpdateBookConfig()

  useEffect(() => {
    if (!data?.assessment || configDirty) {
      return
    }

    const bookConfig = (bookConfigData?.config ?? {}) as Record<string, unknown>
    const existing = bookConfig.accessibility_assessment && typeof bookConfig.accessibility_assessment === "object"
      ? bookConfig.accessibility_assessment as Record<string, unknown>
      : null

    setRunOnlyTagsInput(
      stringifyList(
        Array.isArray(existing?.run_only_tags)
          ? existing.run_only_tags as string[]
          : data.assessment.runOnlyTags,
      ),
    )
    setDisabledRulesInput(
      stringifyList(
        Array.isArray(existing?.disabled_rules)
          ? existing.disabled_rules as string[]
          : data.assessment.disabledRules,
      ),
    )
  }, [bookConfigData?.config, configDirty, data?.assessment])

  const hasOverride = useMemo(() => {
    const bookConfig = (bookConfigData?.config ?? {}) as Record<string, unknown>
    return Boolean(
      bookConfig.accessibility_assessment
      && typeof bookConfig.accessibility_assessment === "object",
    )
  }, [bookConfigData?.config])

  const saveConfig = () => {
    const currentConfig = { ...(bookConfigData?.config ?? {}) } as Record<string, unknown>
    currentConfig.accessibility_assessment = {
      run_only_tags: parseList(runOnlyTagsInput),
      disabled_rules: parseList(disabledRulesInput),
    }
    updateConfig.mutate({ label, config: currentConfig })
    setConfigDirty(false)
  }

  const resetConfig = () => {
    const currentConfig = { ...(bookConfigData?.config ?? {}) } as Record<string, unknown>
    delete currentConfig.accessibility_assessment
    updateConfig.mutate({ label, config: currentConfig })
    setConfigDirty(false)
  }

  return (
    <div className="space-y-6 p-6">
      <SectionHeader
        title="Accessibility assessment configuration"
        description="Control which axe checks run during packaging for this document. Changes apply on the next package run."
      />

      <div className="rounded-xl border bg-card p-4">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="run-only-tags">Enabled axe tags</Label>
            <Textarea
              id="run-only-tags"
              value={runOnlyTagsInput}
              onChange={(event) => {
                setRunOnlyTagsInput(event.target.value)
                setConfigDirty(true)
              }}
              placeholder="wcag2a\nwcag2aa\nbest-practice"
              className="min-h-40 font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              One tag per line or comma-separated. Leave as-is to keep the current package defaults.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="disabled-rules">Disabled axe rules</Label>
            <Textarea
              id="disabled-rules"
              value={disabledRulesInput}
              onChange={(event) => {
                setDisabledRulesInput(event.target.value)
                setConfigDirty(true)
              }}
              placeholder="color-contrast"
              className="min-h-40 font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Use this for checks you intentionally want to suppress, such as known false positives.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={saveConfig}
            disabled={updateConfig.isPending}
          >
            Save settings
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={resetConfig}
            disabled={updateConfig.isPending || !hasOverride}
          >
            Reset to defaults
          </Button>
          {updateConfig.isSuccess ? (
            <span className="text-xs text-emerald-700 dark:text-emerald-400">
              Saved. Re-package Preview to apply.
            </span>
          ) : null}
          {updateConfig.isError ? (
            <span className="text-xs text-red-700">{updateConfig.error.message}</span>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h4 className="text-sm font-medium">Current effective values</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          These values reflect either the saved book override or the latest packaged defaults.
        </p>

        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Run-only tags</div>
            <div className="flex flex-wrap gap-2">
              {parseList(runOnlyTagsInput).map((tag) => (
                <Badge key={tag} variant="outline" className="font-mono text-[11px]">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Disabled rules</div>
            <div className="flex flex-wrap gap-2">
              {parseList(disabledRulesInput).map((rule) => (
                <Badge key={rule} variant="outline" className="font-mono text-[11px]">
                  {rule}
                </Badge>
              ))}
              {parseList(disabledRulesInput).length === 0 ? (
                <span className="text-xs text-muted-foreground">No disabled rules</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function stringifyList(values: string[]): string {
  return values.join("\n")
}

function parseList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}
