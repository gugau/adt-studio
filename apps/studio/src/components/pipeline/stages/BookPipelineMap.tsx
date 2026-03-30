import { useCallback, useEffect, useMemo } from "react"
import { Link } from "@tanstack/react-router"
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Check,
  ChevronRight,
  Loader2,
  Minus,
  Play,
  RotateCcw,
  XCircle,
} from "lucide-react"
import type { StageName } from "@adt/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { STAGES, getPipelineStages, type PipelineStageDefinition, type PipelineStageSlug } from "../stage-config"
import { buildBookPipelineSegments } from "../pipeline-book-layout"
import { STAGE_SUB_STEPS } from "../StageRunCard"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import {
  getPipelineBookParallelHintI18n,
  getPipelineBookParallelTitleI18n,
  getStageDescriptionI18n,
  getStageLabelI18n,
  getStageRunningLabelI18n,
  getStepLabelI18n,
} from "../pipeline-i18n"
import { Trans, useLingui } from "@lingui/react/macro"
import { useRightSidebarControls } from "../RightSidebarContext"

function stageDef(slug: PipelineStageSlug): PipelineStageDefinition {
  const s = getPipelineStages().find((x) => x.slug === slug)
  if (!s) throw new Error(`Unknown pipeline stage: ${slug}`)
  return s
}

const HOVER_BG: Record<string, string> = {
  "bg-blue-600": "hover:bg-blue-600",
  "bg-violet-600": "hover:bg-violet-600",
  "bg-orange-600": "hover:bg-orange-600",
  "bg-teal-600": "hover:bg-teal-600",
  "bg-lime-600": "hover:bg-lime-600",
  "bg-amber-600": "hover:bg-amber-600",
  "bg-pink-600": "hover:bg-pink-600",
  "bg-gray-600": "hover:bg-gray-600",
  "bg-emerald-600": "hover:bg-emerald-600",
}

function PhaseKicker({ n, accent }: { n: number; accent?: "violet" }) {
  return (
    <p
      className={cn(
        "pl-1 text-[11px] font-bold uppercase tracking-[0.25em]",
        accent === "violet"
          ? "text-violet-700 dark:text-violet-400"
          : "text-muted-foreground",
      )}
    >
      <Trans>Phase {n}</Trans>
    </p>
  )
}

function ExportAfterStoryboardHint({
  bookLabel,
  storyboardDone,
}: {
  bookLabel: string
  storyboardDone: boolean
}) {
  return (
    <div className="mt-5 rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/[0.12] to-emerald-500/[0.03] p-4 shadow-sm md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-700 dark:text-emerald-400">
          <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-bold tracking-tight text-foreground md:text-base">
            <Trans>You can export right after Storyboard</Trans>
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            <Trans>
              Export is not blocked by the stages below. As soon as Storyboard is done, you can ship a
              bundle. Quizzes, captions, glossary, Text & Speech, and Preview are optional ways to
              enrich the book—you can export again anytime later.
            </Trans>
          </p>
          {storyboardDone ? (
            <Link
              to="/books/$label/$step"
              params={{ label: bookLabel, step: "export" }}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-700"
            >
              <Trans>Go to Export</Trans>
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <p className="text-xs font-medium text-emerald-800/90 dark:text-emerald-300/90">
              <Trans>Finish Storyboard first, then Export unlocks in the sidebar too.</Trans>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function FlowDivider({ label }: { label: string }) {
  return (
    <div
      className="flex flex-col items-center gap-2 py-6 text-muted-foreground/70"
      aria-hidden
    >
      <div className="h-8 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
      <ArrowDown className="h-5 w-5 shrink-0" strokeWidth={2.5} />
      <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{label}</span>
      <div className="h-8 w-px bg-gradient-to-b from-border via-border to-transparent" />
    </div>
  )
}

function StatusPill({
  state,
  isRunning,
}: {
  state: string
  isRunning: boolean
}) {
  if (state === "done") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
        <Check className="h-3 w-3" strokeWidth={3} />
        <Trans>Done</Trans>
      </span>
    )
  }
  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400">
        <XCircle className="h-3 w-3" />
        <Trans>Error</Trans>
      </span>
    )
  }
  if (isRunning || state === "running" || state === "queued") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        <Trans>Running</Trans>
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      <Trans>Ready</Trans>
    </span>
  )
}

function SpineStagePanel({
  bookLabel,
  slug,
  phaseNumber,
  onRun,
  hasApiKey,
  showRun,
}: {
  bookLabel: string
  slug: PipelineStageSlug
  phaseNumber: number
  onRun: (slug: string) => void
  hasApiKey: boolean
  showRun: boolean
}) {
  const { t } = useLingui()
  const stage = stageDef(slug)
  const { stageState, stepState, stepProgress, stepError, error } = useBookRun()
  const state = stageState(slug)
  const running = state === "running" || state === "queued"
  const Icon = stage.icon
  const subSteps = STAGE_SUB_STEPS[slug as StageName] ?? []
  const hasError = state === "error"
  const completed = state === "done"
  const desc = getStageDescriptionI18n(slug)
  const title = running ? getStageRunningLabelI18n(slug) : getStageLabelI18n(slug)
  const hoverTone = HOVER_BG[stage.color] ?? "hover:bg-gray-600"
  const runDisabled = !hasApiKey || running
  const buttonClass = hasError
    ? cn("bg-red-600", "text-white", "hover:bg-red-700")
    : completed
      ? cn(stage.color, "text-white", hoverTone)
      : cn("bg-muted", "text-foreground", "hover:text-white", hoverTone)

  return (
    <div className="space-y-3">
      <PhaseKicker n={phaseNumber} />
      <Link
        to="/books/$label/$step"
        params={{ label: bookLabel, step: slug }}
        className={cn(
          "group block rounded-2xl border-2 border-border/80 bg-card text-left shadow-md transition-all duration-200",
          "hover:border-border hover:shadow-xl",
          running && "ring-2 ring-blue-500/40 ring-offset-2 ring-offset-background",
          completed && !hasError && "border-emerald-500/30",
          hasError && "border-red-500/40",
        )}
      >
        <div className="flex flex-col lg:flex-row lg:min-h-[148px]">
          <div className={cn("h-2 lg:h-auto lg:w-3 lg:min-h-full shrink-0", stage.color)} />
          <div className="flex flex-1 flex-col gap-5 p-5 md:p-7 lg:flex-row lg:items-center lg:gap-8">
            <div
              className={cn(
                "flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl shadow-inner md:h-20 md:w-20",
                stage.bgLight,
              )}
            >
              <Icon className={cn("h-9 w-9 md:h-10 md:w-10", stage.textColor)} strokeWidth={1.75} />
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-black tracking-tight md:text-3xl">{title}</h2>
                <StatusPill state={state} isRunning={running} />
              </div>
              {desc && (
                <p className="max-w-prose text-sm leading-relaxed text-muted-foreground md:text-base">
                  {desc}
                </p>
              )}
              {subSteps.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {subSteps.map(({ key }) => {
                    const st = stepState(key)
                    const progress = stepProgress(key)
                    const err = stepError(key)
                    const done = st === "done"
                    const skipped = st === "skipped"
                    const errSt = st === "error"
                    const subRun = st === "running"
                    const pages =
                      subRun &&
                      progress?.page != null &&
                      progress?.totalPages != null &&
                      progress.totalPages > 0

                    return (
                      <div
                        key={key}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                          done && "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
                          skipped && "border-amber-500/30 bg-amber-500/5 text-muted-foreground",
                          errSt && "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
                          subRun && "border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-300",
                          !done && !skipped && !errSt && !subRun && "border-border/80 bg-muted/40 text-muted-foreground",
                        )}
                        title={errSt && err ? err : undefined}
                      >
                        {done ? (
                          <Check className="h-3 w-3 shrink-0 text-emerald-600" strokeWidth={3} />
                        ) : skipped ? (
                          <Minus className="h-3 w-3 shrink-0 text-amber-600" strokeWidth={3} />
                        ) : errSt ? (
                          <XCircle className="h-3 w-3 shrink-0" />
                        ) : subRun ? (
                          <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                        ) : (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/30" />
                        )}
                        <span>{getStepLabelI18n(key)}</span>
                        {pages && (
                          <span className="tabular-nums opacity-80">
                            {progress?.page}/{progress?.totalPages}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-3 lg:flex-col lg:items-end">
              {showRun && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={runDisabled}
                  title={
                    hasError
                      ? t`Retry`
                      : completed
                        ? t`Re-run ${getStageLabelI18n(slug)}`
                        : t`Run ${getStageLabelI18n(slug)}`
                  }
                  className={cn(
                    "h-14 w-14 rounded-2xl shadow-md transition-transform hover:scale-105 active:scale-95 [&_svg]:size-6",
                    "disabled:pointer-events-none disabled:opacity-35 disabled:hover:scale-100",
                    buttonClass,
                  )}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onRun(slug)
                  }}
                >
                  {running ? (
                    <Loader2 className="animate-spin text-white" />
                  ) : hasError || completed ? (
                    <RotateCcw />
                  ) : (
                    <Play className="ml-1" />
                  )}
                </Button>
              )}
              <ChevronRight className="hidden h-6 w-6 text-muted-foreground opacity-40 transition group-hover:opacity-100 lg:block" />
            </div>
          </div>
        </div>
      </Link>

      {hasError && error && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription className="text-sm whitespace-pre-wrap break-words">{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function ParallelStageTile({
  bookLabel,
  slug,
  onRun,
  hasApiKey,
}: {
  bookLabel: string
  slug: PipelineStageSlug
  onRun: (slug: string) => void
  hasApiKey: boolean
}) {
  const { t } = useLingui()
  const stage = stageDef(slug)
  const { stageState, stepState, stepProgress, stepError } = useBookRun()
  const state = stageState(slug)
  const running = state === "running" || state === "queued"
  const Icon = stage.icon
  const completed = state === "done"
  const hasError = state === "error"
  const subSteps = STAGE_SUB_STEPS[slug as StageName] ?? []
  const hoverTone = HOVER_BG[stage.color] ?? "hover:bg-gray-600"
  const runDisabled = !hasApiKey || running
  const buttonClass = hasError
    ? cn("bg-red-600", "text-white", "hover:bg-red-700")
    : completed
      ? cn(stage.color, "text-white", hoverTone)
      : cn("bg-background/80", "text-foreground", "shadow-sm", "hover:text-white", hoverTone)

  return (
    <Link
      to="/books/$label/$step"
      params={{ label: bookLabel, step: slug }}
      className={cn(
        "group relative flex min-h-[200px] flex-col overflow-hidden rounded-3xl border-2 border-border/70 bg-gradient-to-b from-card to-muted/40 p-5 shadow-lg transition-all duration-200",
        "hover:-translate-y-1 hover:border-border hover:shadow-2xl",
        running && "ring-2 ring-blue-500/50 ring-offset-2 ring-offset-background",
        completed && !hasError && "border-emerald-500/35",
        hasError && "border-red-500/40",
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1 opacity-90"
        style={{ backgroundColor: stage.hex }}
      />
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm",
            stage.bgLight,
          )}
        >
          <Icon className={cn("h-6 w-6", stage.textColor)} strokeWidth={2} />
        </div>
        <StatusPill state={state} isRunning={running} />
      </div>
      <h3 className="mt-4 text-lg font-bold leading-tight tracking-tight">
        {running ? getStageRunningLabelI18n(slug) : getStageLabelI18n(slug)}
      </h3>
      {getStageDescriptionI18n(slug) && (
        <p className="mt-2 line-clamp-3 flex-1 text-xs leading-relaxed text-muted-foreground">
          {getStageDescriptionI18n(slug)}
        </p>
      )}
      {subSteps.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {subSteps.map(({ key }) => {
            const st = stepState(key)
            const progress = stepProgress(key)
            const err = stepError(key)
            const done = st === "done"
            const skipped = st === "skipped"
            const errSt = st === "error"
            const subRun = st === "running"
            return (
              <span
                key={key}
                className={cn(
                  "inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                  done && "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
                  skipped && "bg-amber-500/10 text-muted-foreground",
                  errSt && "bg-red-500/15 text-red-700 dark:text-red-400",
                  subRun && "bg-blue-500/15 text-blue-800 dark:text-blue-300",
                  !done && !skipped && !errSt && !subRun && "bg-muted/80 text-muted-foreground",
                )}
                title={errSt && err ? err : undefined}
              >
                <span className="inline-flex shrink-0 items-center justify-center">
                  {done ? (
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  ) : skipped ? (
                    <Minus className="h-2.5 w-2.5" strokeWidth={3} />
                  ) : errSt ? (
                    <XCircle className="h-2.5 w-2.5 shrink-0" />
                  ) : subRun ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  ) : (
                    <span className="block h-1.5 w-1.5 rounded-full bg-current opacity-40" />
                  )}
                </span>
                <span className="min-w-0 truncate">{getStepLabelI18n(key)}</span>
                {subRun &&
                  progress?.page != null &&
                  progress?.totalPages != null &&
                  progress.totalPages > 0 && (
                    <span className="tabular-nums">
                      {progress.page}/{progress.totalPages}
                    </span>
                  )}
              </span>
            )
          })}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <Trans>Open</Trans>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={runDisabled}
          title={
            hasError
              ? t`Retry`
              : completed
                ? t`Re-run ${getStageLabelI18n(slug)}`
                : t`Run ${getStageLabelI18n(slug)}`
          }
          className={cn(
            "h-11 w-11 shrink-0 rounded-xl [&_svg]:size-5",
            buttonClass,
          )}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onRun(slug)
          }}
        >
          {running ? (
            <Loader2 className="animate-spin text-white" />
          ) : hasError || completed ? (
            <RotateCcw />
          ) : (
            <Play className="ml-0.5" />
          )}
        </Button>
      </div>
    </Link>
  )
}

export function BookPipelineMap({ bookLabel }: { bookLabel: string }) {
  const { t } = useLingui()
  const segments = useMemo(() => buildBookPipelineSegments(), [])
  const { stageState, queueRun } = useBookRun()
  const { apiKey, hasApiKey, azureKey, azureRegion, geminiKey } = useApiKey()
  const { setHeader } = useRightSidebarControls()

  useEffect(() => {
    setHeader(
      <div className="space-y-1">
        <p className="text-sm font-semibold leading-none">
          <Trans>Pipeline map</Trans>
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          <Trans>
            This is a dependency graph, not a single queue. Once Storyboard is done, you can already
            export—everything below is optional enrichment. Four stages then branch in parallel and
            merge again before Text & Speech.
          </Trans>
        </p>
      </div>,
    )

    return () => setHeader(null)
  }, [setHeader])

  const onRun = useCallback(
    (slug: string) => {
      if (!hasApiKey) return
      const s = stageState(slug)
      if (s === "running" || s === "queued") return
      queueRun({
        fromStage: slug,
        toStage: slug,
        apiKey,
        providerCredentials: {
          azure: { key: azureKey, region: azureRegion },
          geminiApiKey: geminiKey,
        },
      })
    },
    [hasApiKey, stageState, apiKey, azureKey, azureRegion, geminiKey, queueRun],
  )

  const exportStage = STAGES.find((s) => s.slug === "export")!
  const ExportIcon = exportStage.icon

  let phaseNum = 0

  return (
    <div className="relative w-full pb-20">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-40 dark:opacity-25"
        aria-hidden
      >
        <div className="absolute -left-20 top-0 h-[420px] w-[420px] rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute right-0 top-[28%] h-[380px] w-[380px] rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute bottom-10 left-1/3 h-[300px] w-[300px] rounded-full bg-pink-500/15 blur-3xl" />
      </div>

      <div className="mx-auto max-w-5xl px-3 sm:px-4">
        {!hasApiKey && (
          <Alert className="mb-8 rounded-xl border-amber-500/40 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm font-medium text-amber-950 dark:text-amber-100">
              <Trans>Add an API key in settings to run pipeline stages.</Trans>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          {segments.map((seg, i) => {
            if (seg.kind === "spine") {
              const showDivider = i > 0
              const pn = ++phaseNum
              return (
                <div key={seg.slug}>
                  {showDivider && <FlowDivider label={t`Continue`} />}
                  <SpineStagePanel
                    bookLabel={bookLabel}
                    slug={seg.slug}
                    phaseNumber={pn}
                    onRun={onRun}
                    hasApiKey={hasApiKey}
                    showRun={seg.slug !== "preview"}
                  />
                  {seg.slug === "storyboard" && (
                    <ExportAfterStoryboardHint
                      bookLabel={bookLabel}
                      storyboardDone={stageState("storyboard") === "done"}
                    />
                  )}
                </div>
              )
            }

            const pn = ++phaseNum
            return (
              <div key={seg.slugs.join("-")} className="space-y-4">
                <FlowDivider label={t`Branch out`} />
                <div className="relative overflow-hidden rounded-3xl border-2 border-dashed border-violet-500/35 bg-gradient-to-br from-violet-500/[0.08] via-background to-background p-6 shadow-inner md:p-10">
                  <div className="relative space-y-2">
                    <PhaseKicker n={pn} accent="violet" />
                    <h2 className="text-2xl font-black tracking-tight md:text-3xl">
                      {getPipelineBookParallelTitleI18n()}
                    </h2>
                    <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                      {getPipelineBookParallelHintI18n()}
                    </p>
                  </div>
                  <div className="relative mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {seg.slugs.map((slug) => (
                      <ParallelStageTile
                        key={slug}
                        bookLabel={bookLabel}
                        slug={slug}
                        onRun={onRun}
                        hasApiKey={hasApiKey}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )
          })}

          <FlowDivider label={t`Ship`} />
          <div className="space-y-3">
            <PhaseKicker n={++phaseNum} />
            <Link
              to="/books/$label/$step"
              params={{ label: bookLabel, step: "export" }}
              className={cn(
                "group flex flex-col overflow-hidden rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 via-card to-card shadow-lg transition-all hover:shadow-2xl sm:flex-row sm:items-center",
              )}
            >
              <div className={cn("h-2 sm:h-auto sm:w-3 sm:min-h-[100px]", exportStage.color)} />
              <div className="flex flex-1 items-center gap-5 p-6 md:p-8">
                <div
                  className={cn(
                    "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
                    exportStage.bgLight,
                  )}
                >
                  <ExportIcon className={cn("h-7 w-7", exportStage.textColor)} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-black tracking-tight md:text-2xl">
                    {getStageLabelI18n("export")}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <Trans>
                      Available once Storyboard is complete. Re-export anytime after optional stages add
                      more content.
                    </Trans>
                  </p>
                </div>
                <ChevronRight className="h-8 w-8 shrink-0 text-muted-foreground opacity-50 transition group-hover:translate-x-1 group-hover:opacity-100" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
