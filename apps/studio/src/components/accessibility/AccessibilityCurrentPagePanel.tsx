import { Fragment } from "react"
import type { AccessibilityPageResult } from "@adt/types"
import type { PageAccessibilitySummary } from "@/lib/accessibility-summary"
import { AlertTriangle, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface AccessibilityCurrentPagePanelProps {
  page: AccessibilityPageResult | null
  summary: PageAccessibilitySummary | null
  emptyMessage?: string
  className?: string
  embedded?: boolean
}

const URL_PATTERN = /https?:\/\/[^\s<>"']+/g

function SummaryCard({
  label,
  value,
  tone = "default",
  compact = false,
}: {
  label: string
  value: number | string
  tone?: "default" | "warning" | "success"
  compact?: boolean
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20"
        : "bg-card"

  return (
    <div className={cn("rounded-xl border", compact ? "px-3 py-2.5" : "p-3", toneClass)}>
      <div className="mb-1 text-[11px] text-muted-foreground">{label}</div>
      <div className={cn("font-semibold tabular-nums", compact ? "text-lg" : "text-xl")}>{value}</div>
    </div>
  )
}

function splitTrailingPunctuation(url: string) {
  const match = url.match(/[),.;:!?]+$/)
  if (!match) {
    return { href: url, trailing: "" }
  }

  return {
    href: url.slice(0, -match[0].length),
    trailing: match[0],
  }
}

function LinkifiedText({
  text,
  className,
  preserveWhitespace = false,
}: {
  text: string
  className?: string
  preserveWhitespace?: boolean
}) {
  const matches = [...text.matchAll(URL_PATTERN)]

  if (matches.length === 0) {
    return <div className={className}>{text}</div>
  }

  let lastIndex = 0

  return (
    <div className={className}>
      {matches.map((match, index) => {
        const rawUrl = match[0]
        const start = match.index ?? 0
        const before = text.slice(lastIndex, start)
        const { href, trailing } = splitTrailingPunctuation(rawUrl)
        lastIndex = start + rawUrl.length

        return (
          <Fragment key={`${href}-${index}`}>
            {before}
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "break-all text-foreground underline underline-offset-2 hover:text-primary",
                preserveWhitespace ? "whitespace-pre-wrap" : undefined,
              )}
              onClick={(event) => event.stopPropagation()}
            >
              {href}
            </a>
            {trailing}
          </Fragment>
        )
      })}
      {text.slice(lastIndex)}
    </div>
  )
}

function FindingsList({ page, embedded = false }: { page: AccessibilityPageResult; embedded?: boolean }) {
  return (
    <div className={cn("space-y-3", embedded ? "" : "border-t px-4 py-4")}>
      {page.error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {page.error}
        </div>
      ) : (
        <>
          {page.violations.length === 0 && page.incomplete.length === 0 ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-400">
              No accessibility findings were reported for this page.
            </div>
          ) : null}

          {page.violations.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground">Violations</h4>
              {page.violations.map((violation) => (
                <div key={`v-${page.sectionId}-${violation.id}`} className="space-y-2 rounded-xl border bg-card/80 px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="destructive" className="font-mono text-[11px]">
                      {violation.id}
                    </Badge>
                    {violation.impact ? (
                      <Badge variant="outline" className="text-[11px] capitalize">
                        {violation.impact}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-sm font-medium leading-snug">{violation.help}</div>
                  <LinkifiedText text={violation.description} className="text-xs leading-relaxed text-muted-foreground" />
                  <LinkifiedText text={violation.helpUrl} className="break-all text-[11px] text-muted-foreground" />
                  {violation.nodes.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="text-xs font-medium text-muted-foreground">Nodes</div>
                      {violation.nodes.map((node, index) => (
                        <div key={`${violation.id}-${index}`} className="rounded-lg bg-muted/40 px-2.5 py-2 text-xs font-mono">
                          <div>{node.target.join(", ") || "(no target)"}</div>
                          {node.failureSummary ? (
                            <LinkifiedText
                              text={node.failureSummary}
                              className="mt-1 font-sans leading-relaxed text-muted-foreground whitespace-pre-wrap"
                              preserveWhitespace
                            />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {page.incomplete.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground">Needs review</h4>
              {page.incomplete.map((item) => (
                <div key={`i-${page.sectionId}-${item.id}`} className="space-y-2 rounded-xl border bg-card/80 px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {item.id}
                    </Badge>
                    {item.impact ? (
                      <Badge variant="outline" className="text-[11px] capitalize">
                        {item.impact}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-sm font-medium leading-snug">{item.help}</div>
                  <LinkifiedText text={item.description} className="text-xs leading-relaxed text-muted-foreground" />
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export function AccessibilityCurrentPagePanel({
  page,
  summary,
  emptyMessage = "Open a page in Preview to show its page-specific accessibility findings here.",
  className = "",
  embedded = false,
}: AccessibilityCurrentPagePanelProps) {
  if (!page || !summary) {
    return (
      <div className={cn(embedded ? "rounded-2xl border bg-card/70 px-3 py-3" : "rounded-xl border bg-card p-4", className)}>
        <div className="rounded-lg border border-dashed px-4 py-4 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      </div>
    )
  }

  const hasFindings = summary.totalCount > 0 || summary.hasError

  if (embedded) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="rounded-2xl border bg-card/80 px-3.5 py-3.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {hasFindings ? (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                )}
                <h4 className="truncate text-sm font-semibold">{summary.title ?? summary.sectionId}</h4>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{summary.href}</p>
            </div>
            <Badge variant="secondary" className="shrink-0">Current Preview Page</Badge>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <SummaryCard
              label="Total findings"
              value={summary.totalCount}
              tone={summary.totalCount > 0 || summary.hasError ? "warning" : "success"}
              compact
            />
            <SummaryCard
              label="Violations"
              value={summary.issueCount}
              tone={summary.issueCount > 0 ? "warning" : "success"}
              compact
            />
            <SummaryCard
              label="Needs review"
              value={summary.reviewCount}
              tone={summary.reviewCount > 0 ? "warning" : "default"}
              compact
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {summary.categories.map((category) => (
              <Badge key={category.key} variant="outline" className="text-[11px]">
                {category.label}
                <span className="ml-1 text-muted-foreground">{category.count}</span>
              </Badge>
            ))}
            {summary.categories.length === 0 ? (
              <Badge variant="secondary" className="text-[11px]">No finding categories</Badge>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border bg-card/70 px-3.5 py-3.5">
          <FindingsList page={page} embedded />
        </div>
      </div>
    )
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card", className)}>
      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {hasFindings ? (
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              )}
              <h4 className="truncate text-sm font-medium">{summary.title ?? summary.sectionId}</h4>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{summary.href}</p>
          </div>
          <Badge variant="secondary">Current Preview Page</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard
            label="Total findings"
            value={summary.totalCount}
            tone={summary.totalCount > 0 || summary.hasError ? "warning" : "success"}
          />
          <SummaryCard
            label="Violations"
            value={summary.issueCount}
            tone={summary.issueCount > 0 ? "warning" : "success"}
          />
          <SummaryCard
            label="Needs review"
            value={summary.reviewCount}
            tone={summary.reviewCount > 0 ? "warning" : "default"}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {summary.categories.map((category) => (
            <Badge key={category.key} variant="outline" className="text-[11px]">
              {category.label}
              <span className="ml-1 text-muted-foreground">{category.count}</span>
            </Badge>
          ))}
          {summary.categories.length === 0 ? (
            <Badge variant="secondary" className="text-[11px]">No finding categories</Badge>
          ) : null}
        </div>
      </div>

      <FindingsList page={page} />
    </div>
  )
}
