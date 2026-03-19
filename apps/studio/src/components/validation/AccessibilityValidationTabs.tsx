import { useEffect, useMemo, useState } from "react"
import type { AccessibilityAssessmentOutput } from "@adt/types"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileWarning,
} from "lucide-react"
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

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: number | string
  tone?: "default" | "error" | "warning" | "caution" | "success" | "info" | "muted"
}) {
  const accentClass =
    tone === "error"
      ? "border-red-500"
      : tone === "warning"
        ? "border-orange-500"
        : tone === "caution"
          ? "border-yellow-500"
          : tone === "success"
            ? "border-emerald-500"
            : tone === "info"
              ? "border-blue-500"
              : tone === "muted"
                ? "border-gray-400"
                : ""

  return (
    <div className={`rounded-lg border-2 bg-card p-4 ${accentClass}`}>
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  )
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

function FrequentFindingCard({
  finding,
  pageCount,
}: {
  finding: ReturnType<typeof buildFrequentAccessibilityFindings>[number]
  pageCount: number
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
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="font-medium">Version {version}</span>
          {version === currentVersion ? (
            <Badge variant="secondary" className="ml-2 text-[11px]">
              Current
            </Badge>
          ) : null}
        </Button>

        {data != null ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onDownload(version, data)}
          >
            <Download className="h-3.5 w-3.5" />
            JSON
          </Button>
        ) : null}
      </div>

      {expanded && data != null ? (
        <div className="bg-muted/20 px-4 py-3">
          <pre className="max-h-72 overflow-auto rounded-lg border bg-card p-4 text-[11px] whitespace-pre-wrap">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      ) : null}

      {expanded && data == null ? (
        <div className="px-4 py-3 text-xs text-muted-foreground">
          No data available for this version.
        </div>
      ) : null}
    </div>
  )
}

export function AccessibilityOverviewTab({ label }: AccessibilityTabProps) {
  const { data, isLoading, error } = useAccessibilityAssessment(label)
  const history = useVersionHistory(
    label,
    "accessibility-assessment",
    "book",
    true,
    { enabled: !!data?.assessment },
  )
  const [showHistory, setShowHistory] = useState(false)

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
  const frequentFindings = buildFrequentAccessibilityFindings(assessment)
  const recurringFindings = frequentFindings.filter((finding) => finding.pagesAffected > 1)
  const pagesWithFindings = assessment.pages.filter((page) => page.violations.length > 0 || page.incomplete.length > 0 || page.error).length
  const currentVersion = data.version

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
        <h4 className="text-sm font-medium">Severity distribution</h4>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Critical" value={overview.severity.critical} tone={overview.severity.critical > 0 ? "error" : "default"} />
          <SummaryCard label="Serious" value={overview.severity.serious} tone={overview.severity.serious > 0 ? "warning" : "default"} />
          <SummaryCard label="Moderate" value={overview.severity.moderate} tone={overview.severity.moderate > 0 ? "caution" : "default"} />
          <SummaryCard label="Minor" value={overview.severity.minor} tone={overview.severity.minor > 0 ? "info" : "default"} />
          <SummaryCard label="Unknown" value={overview.severity.unknown} tone={overview.severity.unknown > 0 ? "muted" : "default"} />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h4 className="text-sm font-medium">Categories</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Distribution of findings across accessibility categories.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {overview.categories.map((category) => (
            <Badge key={category.key} variant="outline" className="text-[11px]">
              {category.label}
              <span className="ml-1 text-muted-foreground">{category.count}</span>
            </Badge>
          ))}
          {overview.categories.length === 0 ? (
            <span className="text-xs text-muted-foreground">No finding categories reported.</span>
          ) : null}
        </div>
      </div>

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
