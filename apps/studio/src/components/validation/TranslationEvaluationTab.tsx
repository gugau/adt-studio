import { useEffect, useMemo, useState } from "react"
import { Check, CheckCircle2, ChevronDown, ChevronRight, FlaskConical, Loader2, TriangleAlert } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Trans, useLingui } from "@lingui/react/macro"
import { api, type TranslationEvaluationStatusResponse } from "@/api/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useBookTasks } from "@/hooks/use-book-tasks"
import { useApiKey } from "@/hooks/use-api-key"
import {
  useRunTranslationEvaluation,
  useTranslationEvaluations,
  translationEvaluationsKey,
} from "@/hooks/use-translation-evaluation"
import { cn } from "@/lib/utils"

type TranslationEvaluationItem = NonNullable<NonNullable<TranslationEvaluationStatusResponse["evaluation"]>["items"][number]>

function truncatePreview(text: string, maxLength = 220) {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`
}

function clampProgressPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: number | string
  tone?: "default" | "warning" | "success"
}) {
  const toneClass =
    tone === "warning"
      ? "border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20"
        : "bg-card"

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
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
  return (
    <div className="p-6">
      <div className="rounded-xl border border-dashed bg-card px-4 py-6 text-sm text-muted-foreground">
        {message}
      </div>
    </div>
  )
}

function StatusBadge({
  acceptable,
  isStale,
}: {
  acceptable: boolean | null
  isStale: boolean
}) {
  if (isStale) {
    return (
      <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
        <Trans>Stale</Trans>
      </Badge>
    )
  }
  if (acceptable === null) {
    return (
      <Badge variant="outline">
        <Trans>Not evaluated</Trans>
      </Badge>
    )
  }
  if (acceptable) {
    return (
      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
        <Trans>Acceptable</Trans>
      </Badge>
    )
  }
  return (
    <Badge className="bg-orange-600 text-white hover:bg-orange-600">
      <Trans>Needs review</Trans>
    </Badge>
  )
}

function TranslationEvaluationResultCard({
  item,
  onAcceptSuggestion,
  acceptingSuggestion,
  suggestionAccepted,
}: {
  item: TranslationEvaluationItem
  onAcceptSuggestion: (item: TranslationEvaluationItem) => void
  acceptingSuggestion: boolean
  suggestionAccepted: boolean
}) {
  const { t } = useLingui()
  const [isOpen, setIsOpen] = useState(!item.acceptable)

  useEffect(() => {
    setIsOpen(!item.acceptable)
  }, [item.acceptable, item.entry_id, item.rationale, item.source_text, item.translated_text])

  const rationalePreview = useMemo(() => truncatePreview(item.rationale), [item.rationale])

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        item.acceptable
          ? "bg-card"
          : "border-orange-200 bg-orange-50/40 dark:border-orange-900 dark:bg-orange-950/10",
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-[11px]">
                {item.entry_id}
              </Badge>
              {item.acceptable ? (
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  <Trans>Acceptable</Trans>
                </Badge>
              ) : (
                <Badge className="bg-orange-600 text-white hover:bg-orange-600">
                  <TriangleAlert className="mr-1 h-3 w-3" />
                  <Trans>Needs review</Trans>
                </Badge>
              )}
            </div>

            <p className="text-sm text-foreground">
              {isOpen ? item.rationale : rationalePreview}
            </p>
          </div>

          <div className="flex flex-col gap-2 lg:items-end">
            {item.issue_types && item.issue_types.length > 0 ? (
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {item.issue_types.map((issueType) => (
                  <Badge key={`${item.entry_id}-${issueType}`} variant="outline" className="font-mono text-[11px]">
                    {issueType}
                  </Badge>
                ))}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setIsOpen((current) => !current)}
              className="inline-flex items-center gap-1 self-start rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:self-end"
            >
              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {isOpen ? <Trans>Collapse details</Trans> : <Trans>Expand details</Trans>}
            </button>
          </div>
        </div>

        {isOpen ? (
          <div className="grid gap-4 rounded-lg border bg-background/60 p-4 md:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Trans>Original</Trans>
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {item.source_text?.trim() || t`Not stored in this evaluation version.`}
              </p>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Trans>Translation</Trans>
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {item.translated_text?.trim() || t`Not stored in this evaluation version.`}
              </p>
            </div>

            {!item.acceptable && item.suggested_text ? (
              <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 md:col-span-2 dark:border-emerald-900 dark:bg-emerald-950/20">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                      <Trans>Suggested fix</Trans>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-foreground">{item.suggested_text}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0"
                    onClick={() => onAcceptSuggestion(item)}
                    disabled={acceptingSuggestion || suggestionAccepted}
                  >
                    {acceptingSuggestion ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    {suggestionAccepted ? <Trans>Accepted</Trans> : <Trans>Accept fix</Trans>}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function TranslationEvaluationTab({ label }: { label: string }) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const evaluations = useTranslationEvaluations(label)
  const runEvaluation = useRunTranslationEvaluation(label)
  const { isTaskRunning, tasks } = useBookTasks(label)
  const { apiKey } = useApiKey()
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null)
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<Set<string>>(() => new Set())
  const openaiApiKey = apiKey.trim()
  const hasOpenaiApiKey = openaiApiKey.length > 0

  const items = evaluations.data?.evaluations ?? []
  const evaluationRunning = isTaskRunning("translation-evaluation")
  const activeEvaluationTask = useMemo(() => {
    return [...tasks]
      .filter((task) => task.kind === "translation-evaluation" && (task.status === "running" || task.status === "queued"))
      .sort((left, right) => (right.startedAt ?? 0) - (left.startedAt ?? 0))[0] ?? null
  }, [tasks])
  const latestTaskError = useMemo(() => {
    return [...tasks]
      .filter((task) => task.kind === "translation-evaluation" && task.status === "failed" && task.error)
      .sort((left, right) => (right.completedAt ?? 0) - (left.completedAt ?? 0))[0]?.error ?? null
  }, [tasks])

  useEffect(() => {
    if (items.length === 0) {
      setSelectedLanguage(null)
      return
    }
    setSelectedLanguage((current) => {
      if (current && items.some((item) => item.language === current)) {
        return current
      }
      return items[0]?.language ?? null
    })
  }, [items])

  const selectedEvaluation = useMemo(
    () => items.find((item) => item.language === selectedLanguage) ?? null,
    [items, selectedLanguage],
  )
  const selectedEvaluationIsCurrent = Boolean(selectedEvaluation?.evaluation && !selectedEvaluation.isStale)
  const acceptSuggestion = useMutation({
    mutationFn: async (variables: { language: string; entryId: string; suggestedText: string }) => {
      const catalog = await api.getTextCatalog(label)
      if (!catalog) {
        throw new Error(t`Text catalog not found for this book.`)
      }
      const translation = catalog.translations[variables.language]
      if (!translation) {
        throw new Error(t`Translated text catalog not found for this language.`)
      }
      const currentEntries = translation.entries
      const hasEntry = currentEntries.some((entry) => entry.id === variables.entryId)
      const entries = hasEntry
        ? currentEntries.map((entry) => entry.id === variables.entryId
          ? { ...entry, text: variables.suggestedText }
          : entry)
        : [...currentEntries, { id: variables.entryId, text: variables.suggestedText }]

      return api.updateTranslation(label, variables.language, { entries })
    },
    onSuccess: async (_result, variables) => {
      setAcceptedSuggestions((current) => new Set(current).add(`${variables.language}:${variables.entryId}`))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["books", label, "text-catalog"] }),
        queryClient.invalidateQueries({ queryKey: translationEvaluationsKey(label) }),
      ])
    },
  })

  const summary = selectedEvaluation?.evaluation?.summary ?? null
  const acceptable = summary ? summary.acceptable : null
  const unacceptable = summary ? summary.unacceptable : null
  const total = summary ? summary.total : selectedEvaluation?.currentTranslationVersion ? t`Pending` : 0
  const issueTypeCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of selectedEvaluation?.evaluation?.items ?? []) {
      for (const issueType of item.issue_types ?? []) {
        counts.set(issueType, (counts.get(issueType) ?? 0) + 1)
      }
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1])
  }, [selectedEvaluation?.evaluation?.items])
  const sortedEvaluationItems = useMemo(() => {
    return [...(selectedEvaluation?.evaluation?.items ?? [])].sort((left, right) => {
      if (left.acceptable !== right.acceptable) return left.acceptable ? 1 : -1
      return left.entry_id.localeCompare(right.entry_id)
    })
  }, [selectedEvaluation?.evaluation?.items])
  const activeEvaluationProgressPercent =
    typeof activeEvaluationTask?.progressPercent === "number"
      ? clampProgressPercent(activeEvaluationTask.progressPercent)
      : null

  if (evaluations.isLoading) {
    return <LoadingState message={t`Loading translation evaluations...`} />
  }

  if (evaluations.error) {
    return <ErrorState message={t`Failed to load translation evaluations: ${evaluations.error.message}`} />
  }

  if (items.length === 0) {
    return <EmptyState message={t`No translated languages are available yet. Generate translations in Text & Speech first.`} />
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold"><Trans>Translation evaluation</Trans></h3>
            </div>
            <p className="text-sm text-muted-foreground">
              <Trans>Run LLM review on translated catalog entries and inspect acceptable versus needs-review verdicts by language.</Trans>
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-64">
            <Select
              value={selectedLanguage ?? items[0]?.language ?? ""}
              onValueChange={setSelectedLanguage}
            >
              <SelectTrigger className="w-full sm:min-w-56">
                <SelectValue placeholder={t`Select language`} />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.language} value={item.language}>
                    {item.language}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              disabled={
                !selectedLanguage
                || evaluationRunning
                || runEvaluation.isPending
                || selectedEvaluationIsCurrent
              }
              onClick={() => {
                if (!selectedLanguage) return
                runEvaluation.mutate({ language: selectedLanguage, apiKey: openaiApiKey })
              }}
            >
              {evaluationRunning || runEvaluation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {selectedEvaluationIsCurrent ? <Trans>Evaluation current</Trans> : <Trans>Run evaluation</Trans>}
            </Button>
          </div>
        </div>

        {!hasOpenaiApiKey ? (
          <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-700">
            <Trans>No browser OpenAI key is saved. The API will use the server OPENAI_API_KEY if configured.</Trans>
          </div>
        ) : null}

        {activeEvaluationTask ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-800">
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <Loader2 className="mt-0.5 h-4 w-4 animate-spin" />
                <div className="space-y-1">
                  <div id="translation-evaluation-progress-title" className="font-medium">
                    <Trans>Translation evaluation is running</Trans>
                  </div>
                  <div>{activeEvaluationTask.progressMessage ?? activeEvaluationTask.description}</div>
                  <div className="text-xs text-sky-700/80">
                    <Trans>The cards below continue to show the last saved evaluation until this task finishes.</Trans>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 pl-6">
                <div
                  role="progressbar"
                  aria-labelledby="translation-evaluation-progress-title"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={activeEvaluationProgressPercent ?? undefined}
                  className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-sky-100"
                >
                  <div
                    className={cn(
                      "h-full rounded-full bg-sky-600 transition-all",
                      activeEvaluationProgressPercent === null ? "w-1/3 animate-pulse" : "",
                    )}
                    style={
                      activeEvaluationProgressPercent === null
                        ? undefined
                        : { width: `${activeEvaluationProgressPercent}%` }
                    }
                  />
                </div>
                {activeEvaluationProgressPercent !== null ? (
                  <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-sky-800">
                    {activeEvaluationProgressPercent}%
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {runEvaluation.error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {runEvaluation.error.message}
          </div>
        ) : null}

        {!runEvaluation.error && latestTaskError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {latestTaskError}
          </div>
        ) : null}

        {acceptSuggestion.error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {acceptSuggestion.error.message}
          </div>
        ) : null}
      </div>

      {selectedEvaluation ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{selectedEvaluation.language}</Badge>
            <StatusBadge
              acceptable={selectedEvaluation.evaluation ? selectedEvaluation.evaluation.summary.unacceptable === 0 : null}
              isStale={selectedEvaluation.isStale}
            />
            {selectedEvaluation.evaluationVersion != null ? (
              <Badge variant="outline" className="tabular-nums">
                <Trans>Eval v{selectedEvaluation.evaluationVersion}</Trans>
              </Badge>
            ) : null}
            {selectedEvaluation.currentTranslationVersion != null ? (
              <Badge variant="outline" className="tabular-nums">
                <Trans>Translation v{selectedEvaluation.currentTranslationVersion}</Trans>
              </Badge>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <SummaryCard label={t`Entries`} value={total} />
            <SummaryCard label={t`Acceptable`} value={acceptable ?? 0} tone="success" />
            <SummaryCard label={t`Needs review`} value={unacceptable ?? 0} tone={(unacceptable ?? 0) > 0 ? "warning" : "default"} />
            <SummaryCard label={t`Current`} value={selectedEvaluation.isStale ? t`No` : t`Yes`} tone={selectedEvaluation.isStale ? "warning" : "success"} />
          </div>

          {issueTypeCounts.length > 0 ? (
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-3 text-sm font-semibold"><Trans>Common issue types</Trans></div>
              <div className="flex flex-wrap gap-2">
                {issueTypeCounts.map(([issueType, count]) => (
                  <Badge key={issueType} variant="outline" className="font-mono text-[11px]">
                    {issueType} ({count})
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {selectedEvaluation.evaluation ? (
            <div className="space-y-3">
              {sortedEvaluationItems.map((item) => (
                <TranslationEvaluationResultCard
                  key={item.entry_id}
                  item={item}
                  onAcceptSuggestion={(evaluationItem) => {
                    if (!selectedEvaluation.language || !evaluationItem.suggested_text) return
                    acceptSuggestion.mutate({
                      language: selectedEvaluation.language,
                      entryId: evaluationItem.entry_id,
                      suggestedText: evaluationItem.suggested_text,
                    })
                  }}
                  acceptingSuggestion={
                    acceptSuggestion.isPending
                    && acceptSuggestion.variables?.language === selectedEvaluation.language
                    && acceptSuggestion.variables?.entryId === item.entry_id
                  }
                  suggestionAccepted={acceptedSuggestions.has(`${selectedEvaluation.language}:${item.entry_id}`)}
                />
              ))}
            </div>
          ) : (
            <EmptyState message={t`No evaluation has been stored for this language yet. Run an evaluation to generate verdicts.`} />
          )}

        </>
      ) : null}
    </div>
  )
}
