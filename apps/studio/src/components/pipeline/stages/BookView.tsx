import {
  Fragment,
  useCallback,
  type MouseEvent,
  type ReactNode,
} from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Check,
  ChevronRight,
  FileText,
  Loader2,
  Play,
  RotateCcw,
  type LucideIcon,
} from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import { type StageName } from "@adt/types"
import {
  STAGES,
  getBookOverviewStages,
  isPipelineStage,
  type NonBookStageDefinition,
  type StageGroup,
} from "../stage-config"
import {
  STAGE_SUB_STEPS,
  type StageSubStep,
} from "../components/StageRunCard"
import {
  getStageDescriptionI18n,
  getStageLabelI18n,
  getStageRunningLabelI18n,
  getStepLabelI18n,
} from "../pipeline-i18n"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { useAccessibilityAssessment } from "@/hooks/use-debug"
import { useBook, usePackageAdtStatus } from "@/hooks/use-books"
import { useBookTasks } from "@/hooks/use-book-tasks"
import { usePages, usePageImage } from "@/hooks/use-pages"
import { useSignLanguageVideos } from "@/hooks/use-sign-language-videos"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface ViewProps {
  bookLabel: string
  selectedPageId?: string
  onSelectPage?: (pageId: string | null) => void
}

const GROUP_ORDER: StageGroup[] = [
  "convert",
  "enhancements",
  "localization",
  "packaging",
]

const RECOMMENDED_STAGES = new Set<string>(["captions"])

export function BookView({ bookLabel }: ViewProps) {
  const { t } = useLingui()
  const overviewSteps = getBookOverviewStages()
  const { stageState, stepState, queueRun } = useBookRun()
  const { apiKey, hasApiKey } = useApiKey()
  const { data: accessibilityAssessment } = useAccessibilityAssessment(bookLabel)
  const { data: signLanguageData } = useSignLanguageVideos(bookLabel)
  const { data: packageStatus } = usePackageAdtStatus(bookLabel)
  const { tasks } = useBookTasks(bookLabel)
  const validationCompleted = Boolean(accessibilityAssessment?.assessment)
  const signLanguageCompleted =
    signLanguageData?.videos?.some((v) => v.sectionId !== null) ?? false
  const previewCompleted = packageStatus?.hasAdt ?? false
  const exportCompleted = tasks.some(
    (t) => t.kind === "prepare-export" && t.status === "completed",
  )
  const completionOverrides: Record<string, boolean> = {
    "sign-language": signLanguageCompleted,
    validation: validationCompleted,
    preview: previewCompleted,
    export: exportCompleted,
  }

  const handleRun = useCallback(
    (stage: NonBookStageDefinition) => {
      if (!hasApiKey || !isPipelineStage(stage)) return
      const state = stageState(stage.slug)
      if (state === "running" || state === "queued") return
      queueRun({ fromStage: stage.slug, toStage: stage.slug, apiKey })
    },
    [hasApiKey, stageState, queueRun, apiKey],
  )

  const grouped: Record<StageGroup, NonBookStageDefinition[]> = {
    convert: [],
    enhancements: [],
    localization: [],
    packaging: [],
  }
  for (const step of overviewSteps) {
    const group =
      "group" in step ? (step.group as StageGroup | undefined) : undefined
    if (group) grouped[group].push(step)
  }

  // Assign sequential phase numbers — Core Pipeline stages first, then the
  // Parallel Enrichment block counts as one phase, then Localization stages
  // each get a phase, then Packaging stages each get a phase.
  const phaseNumberByStage = new Map<string, number>()
  let phaseCounter = 0
  for (const step of grouped.convert) {
    phaseCounter += 1
    phaseNumberByStage.set(step.slug, phaseCounter)
  }
  const enrichmentPhase = grouped.enhancements.length > 0 ? ++phaseCounter : null
  for (const step of grouped.localization) {
    phaseCounter += 1
    phaseNumberByStage.set(step.slug, phaseCounter)
  }
  for (const step of grouped.packaging) {
    phaseCounter += 1
    phaseNumberByStage.set(step.slug, phaseCounter)
  }

  const cardPropsFor = (step: NonBookStageDefinition): HomeStageCardProps => {
    const rawState = stageState(step.slug)
    const state = completionOverrides[step.slug] ? "done" : rawState
    const isRunning =
      isPipelineStage(step) && (rawState === "running" || rawState === "queued")
    const isCompleted = state === "done"
    const hasError = rawState === "error"
    const showRunButton = isPipelineStage(step) && step.slug !== "preview"
    return {
      stage: step,
      bookLabel,
      isRunning,
      isCompleted,
      hasError,
      showRunButton,
      onRun: () => handleRun(step),
      runDisabled: !hasApiKey || isRunning,
      // "Ready" badge only makes sense for stages that have a Run button
      // here. Non-pipeline stages (validation/preview/export/sign-language)
      // are configured from their own page.
      canRun: showRunButton && hasApiKey,
      recommended: RECOMMENDED_STAGES.has(step.slug),
      stepState,
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6">
      <SourcePdfCard bookLabel={bookLabel} />

      {/* Core Pipeline phases */}
      {grouped.convert.map((step, index) => (
        <Fragment key={step.slug}>
          <PhaseBlock phaseNumber={phaseNumberByStage.get(step.slug)!}>
            <HomeStageCard {...cardPropsFor(step)} />
          </PhaseBlock>
          {index < grouped.convert.length - 1 && (
            <PhaseConnector label={t`Continue`} />
          )}
        </Fragment>
      ))}

      {/* Post-core callouts */}
      {grouped.convert.length > 0 && (
        <div className="flex flex-col gap-3">
          <InstructionCallout
            variant="info"
            icon={ArrowRight}
            title={<Trans>You can export at this stage</Trans>}
            body={
              <Trans>
                Export is not blocked by the stages below. As soon as
                Storyboard is done, you can ship a bundle. Enhancements,
                Localization, and Validation are optional ways to enrich the
                book — you can export again anytime later.
              </Trans>
            }
            actionLabel={<Trans>Go to Export</Trans>}
            bookLabel={bookLabel}
            toStep="export"
          />
          <InstructionCallout
            variant="warning"
            icon={AlertTriangle}
            title={
              <Trans>
                Warning: Image Captions are required for accessibility
              </Trans>
            }
            body={
              <Trans>
                If you don't run Image Captions, your output will not be
                accessible to readers who use screen readers or can't see the
                images.
              </Trans>
            }
            actionLabel={<Trans>Go to Image Captions</Trans>}
            bookLabel={bookLabel}
            toStep="captions"
          />
        </div>
      )}

      {/* Parallel Enrichment */}
      {enrichmentPhase !== null && (
        <>
          <PhaseConnector label={t`Branch out`} />
          <EnrichmentSection
            phaseNumber={enrichmentPhase}
            steps={grouped.enhancements}
            cardPropsFor={cardPropsFor}
          />
        </>
      )}

      {/* Localization phases */}
      {grouped.localization.length > 0 && (
        <PhaseConnector label={t`Continue`} />
      )}
      {grouped.localization.map((step, index) => (
        <Fragment key={step.slug}>
          <PhaseBlock phaseNumber={phaseNumberByStage.get(step.slug)!}>
            <HomeStageCard {...cardPropsFor(step)} />
          </PhaseBlock>
          {index < grouped.localization.length - 1 && (
            <PhaseConnector label={t`Continue`} />
          )}
        </Fragment>
      ))}

      {/* Packaging phases */}
      {grouped.packaging.length > 0 && (
        <PhaseConnector label={t`Ship`} />
      )}
      {grouped.packaging.map((step, index) => (
        <Fragment key={step.slug}>
          <PhaseBlock phaseNumber={phaseNumberByStage.get(step.slug)!}>
            <HomeStageCard {...cardPropsFor(step)} />
          </PhaseBlock>
          {index < grouped.packaging.length - 1 && (
            <PhaseConnector label={t`Continue`} />
          )}
        </Fragment>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// HomeStageCard — modern, larger stage card used on the home overview only.
// ---------------------------------------------------------------------------

interface HomeStageCardProps {
  stage: NonBookStageDefinition
  bookLabel: string
  isRunning: boolean
  isCompleted: boolean
  hasError: boolean
  showRunButton: boolean
  onRun: () => void
  runDisabled: boolean
  canRun: boolean
  recommended: boolean
  stepState: (key: string) => string
}

function HomeStageCard({
  stage,
  bookLabel,
  isRunning,
  isCompleted,
  hasError,
  showRunButton,
  onRun,
  runDisabled,
  canRun,
  recommended,
  stepState,
}: HomeStageCardProps) {
  const navigate = useNavigate()
  const Icon = stage.icon
  const subSteps: StageSubStep[] = STAGE_SUB_STEPS[stage.slug as StageName] ?? []
  const description = getStageDescriptionI18n(stage.slug)
  const stageLabel = getStageLabelI18n(stage.slug)
  const runningLabel = getStageRunningLabelI18n(stage.slug)

  const handleCardClick = () => {
    navigate({
      to: "/books/$label/$step",
      params: { label: bookLabel, step: stage.slug },
    })
  }

  const handleRunClick = (e: MouseEvent) => {
    e.stopPropagation()
    onRun()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          handleCardClick()
        }
      }}
      className={cn(
        "group relative flex cursor-pointer items-start gap-5 overflow-hidden rounded-2xl border bg-card p-5 text-left transition-all",
        "hover:border-foreground/15 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isCompleted ? "border-border" : "border-border/70",
      )}
    >
      {/* Accent bar */}
      <div
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-1", stage.color)}
      />

      {/* Icon squircle */}
      <div
        className={cn(
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm",
          stage.color,
        )}
      >
        <Icon className="h-6 w-6 text-white" strokeWidth={2} />
      </div>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold leading-tight tracking-tight text-foreground">
            {isRunning ? runningLabel : stageLabel}
          </h3>
          <StageStatusBadge
            isCompleted={isCompleted}
            isRunning={isRunning}
            hasError={hasError}
            canRun={canRun}
          />
          {recommended && (
            <Badge className="border-transparent bg-amber-100 text-[10px] uppercase tracking-wider text-amber-900 hover:bg-amber-100">
              <Trans>Recommended</Trans>
            </Badge>
          )}
        </div>

        {description && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}

        {subSteps.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {subSteps.map((subStep) => (
              <SubStepPill
                key={subStep.key}
                stepKey={subStep.key}
                state={stepState(subStep.key)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right controls */}
      <div className="flex shrink-0 items-center gap-2 self-center">
        {showRunButton && (
          <RunButton
            isRunning={isRunning}
            isCompleted={isCompleted}
            hasError={hasError}
            color={stage.color}
            disabled={runDisabled}
            stageLabel={stageLabel}
            onClick={handleRunClick}
          />
        )}
        <ChevronRight
          aria-hidden
          className="h-5 w-5 text-muted-foreground/40 transition-colors group-hover:text-foreground/70"
        />
      </div>

    </div>
  )
}

function StageStatusBadge({
  isCompleted,
  isRunning,
  hasError,
  canRun,
}: {
  isCompleted: boolean
  isRunning: boolean
  hasError: boolean
  canRun: boolean
}) {
  if (hasError) {
    return (
      <Badge
        variant="destructive"
        className="border-transparent text-[10px] uppercase tracking-wider"
      >
        <Trans>Error</Trans>
      </Badge>
    )
  }
  if (isCompleted) {
    return (
      <Badge className="border-transparent bg-emerald-100 text-[10px] uppercase tracking-wider text-emerald-900 hover:bg-emerald-100">
        <Trans>Done</Trans>
      </Badge>
    )
  }
  if (isRunning) {
    return (
      <Badge className="border-transparent bg-blue-100 text-[10px] uppercase tracking-wider text-blue-900 hover:bg-blue-100">
        <Trans>Running</Trans>
      </Badge>
    )
  }
  if (canRun) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] uppercase tracking-wider text-muted-foreground"
      >
        <Trans>Ready</Trans>
      </Badge>
    )
  }
  return null
}

function SubStepPill({ stepKey, state }: { stepKey: string; state: string }) {
  const isDone = state === "done"
  const isSkipped = state === "skipped"
  const isError = state === "error"
  const isRunning = state === "running"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        isDone
          ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/70"
          : isError
            ? "bg-red-50 text-red-800 ring-1 ring-red-200/70"
            : isRunning
              ? "bg-blue-50 text-blue-800 ring-1 ring-blue-200/70"
              : isSkipped
                ? "bg-muted/40 text-muted-foreground/50 line-through ring-1 ring-border/50"
                : "bg-muted/60 text-muted-foreground ring-1 ring-border/60",
      )}
    >
      {isDone && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
      {isRunning && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
      {getStepLabelI18n(stepKey)}
    </span>
  )
}

function RunButton({
  isRunning,
  isCompleted,
  hasError,
  color,
  disabled,
  stageLabel,
  onClick,
}: {
  isRunning: boolean
  isCompleted: boolean
  hasError: boolean
  color: string
  disabled: boolean
  stageLabel: string
  onClick: (e: MouseEvent) => void
}) {
  const { t } = useLingui()
  const title = hasError
    ? t`Retry`
    : isCompleted
      ? t`Re-run ${stageLabel}`
      : t`Run ${stageLabel}`

  if (isRunning) {
    return (
      <div
        aria-label={t`Running`}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full text-white opacity-70",
          color,
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    )
  }

  const toneClass = hasError
    ? "bg-red-600 text-white hover:bg-red-700"
    : isCompleted
      ? cn(color, "text-white hover:opacity-90")
      : "bg-muted text-foreground hover:bg-muted/80"

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-full transition-all",
        "hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100",
        toneClass,
      )}
    >
      {hasError || isCompleted ? (
        <RotateCcw className="h-4 w-4" />
      ) : (
        <Play className="ml-0.5 h-4 w-4" />
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// PhaseBlock / PhaseConnector — wrap each phase and the arrow between them.
// ---------------------------------------------------------------------------

function PhaseBlock({
  phaseNumber,
  children,
}: {
  phaseNumber: number
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <p className="px-1 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/60">
        <Trans>Phase {phaseNumber}</Trans>
      </p>
      {children}
    </section>
  )
}

function PhaseConnector({ label }: { label: string }) {
  return (
    <div
      aria-hidden
      className="flex flex-col items-center gap-1 self-center text-muted-foreground/40"
    >
      <div className="h-3 w-px bg-current" />
      <ArrowDown className="h-3.5 w-3.5" />
      <span className="text-[9px] font-semibold uppercase tracking-[0.2em]">
        {label}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// EnrichmentSection — single bordered block containing optional stages.
// ---------------------------------------------------------------------------

function EnrichmentSection({
  phaseNumber,
  steps,
  cardPropsFor,
}: {
  phaseNumber: number
  steps: NonBookStageDefinition[]
  cardPropsFor: (step: NonBookStageDefinition) => HomeStageCardProps
}) {
  return (
    <section className="flex flex-col gap-3">
      <p className="px-1 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/60">
        <Trans>Phase {phaseNumber}</Trans>
      </p>
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-indigo-50/40 via-violet-50/30 to-white p-6">
        <div className="mb-5 flex flex-col gap-1">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            <Trans>Enhancements</Trans>
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            <Trans>
              These stages are optional. They don't depend on each other —
              run any of them in any order once the core pipeline is complete.
            </Trans>
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {steps.map((step) => (
            <HomeStageCard key={step.slug} {...cardPropsFor(step)} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// InstructionCallout — info/warning banners (export-available, captions).
// ---------------------------------------------------------------------------

function InstructionCallout({
  variant,
  icon: Icon,
  title,
  body,
  actionLabel,
  bookLabel,
  toStep,
}: {
  variant: "info" | "warning"
  icon: LucideIcon
  title: ReactNode
  body: ReactNode
  actionLabel: ReactNode
  bookLabel: string
  toStep: string
}) {
  // Match the action button to the destination stage's accent color so the
  // visual link between the callout and the target card is obvious.
  const destStage = STAGES.find((s) => s.slug === toStep)
  const buttonColor = destStage?.color ?? "bg-foreground"

  const styles =
    variant === "info"
      ? {
          wrap: "border-emerald-200/70 bg-emerald-50/50",
          iconWrap: "bg-emerald-100 text-emerald-700",
        }
      : {
          // Softer, more advisory than alarming.
          wrap: "border-amber-200/60 bg-amber-50/40",
          iconWrap: "bg-amber-100/70 text-amber-700",
        }

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3",
        styles.wrap,
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          styles.iconWrap,
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2.25} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="text-[13px] font-semibold leading-tight text-foreground">
          {title}
        </h3>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          {body}
        </p>
        <Link
          to="/books/$label/$step"
          params={{ label: bookLabel, step: toStep }}
          className={cn(
            "mt-1 inline-flex w-fit items-center gap-1 rounded-md px-3 py-1.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:opacity-90",
            buttonColor,
          )}
        >
          {actionLabel}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SourcePdfCard — shows the input PDF above the first phase.
// ---------------------------------------------------------------------------

function SourcePdfCard({ bookLabel }: { bookLabel: string }) {
  const { data: book } = useBook(bookLabel)
  const { data: pages } = usePages(bookLabel)
  const firstPageId = pages?.[0]?.pageId
  const { data: pageImage } = usePageImage(bookLabel, firstPageId ?? "", {
    enabled: !!firstPageId,
  })

  // File extension is the same across locales — no translation needed.
  // eslint-disable-next-line lingui/no-unlocalized-strings
  const pdfFilename = `${bookLabel}.pdf`
  const title = book?.title?.trim() || null
  const pageCount = book?.pageCount ?? 0
  const imgSrc = pageImage?.imageBase64
    ? `data:image/png;base64,${pageImage.imageBase64}`
    : null

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
      <div className="flex h-[72px] w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted ring-1 ring-border">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt=""
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <FileText
            className="h-6 w-6 text-muted-foreground/40"
            strokeWidth={1.5}
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <Trans>Source PDF</Trans>
        </p>
        <p className="truncate text-base font-semibold leading-snug text-foreground">
          {title ?? pdfFilename}
        </p>
        <p className="truncate text-xs text-muted-foreground tabular-nums">
          {title ? (
            pageCount > 0 ? (
              <Trans>
                {pdfFilename} · {pageCount} pages
              </Trans>
            ) : (
              pdfFilename
            )
          ) : pageCount > 0 ? (
            <Trans>{pageCount} pages</Trans>
          ) : null}
        </p>
      </div>
      <div className="hidden shrink-0 text-muted-foreground/40 sm:block">
        <ArrowRight className="h-5 w-5" strokeWidth={2} />
      </div>
    </div>
  )
}

