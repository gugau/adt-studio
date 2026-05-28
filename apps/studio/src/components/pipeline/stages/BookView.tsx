import { Fragment, useCallback, type ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  FileText,
  type LucideIcon,
} from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import {
  getBookOverviewStages,
  isPipelineStage,
  type NonBookStageDefinition,
  type StageGroup,
} from "../stage-config"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { useAccessibilityAssessment } from "@/hooks/use-debug"
import { useBook, usePackageAdtStatus } from "@/hooks/use-books"
import { useBookTasks } from "@/hooks/use-book-tasks"
import { usePages, usePageImage } from "@/hooks/use-pages"
import { useSignLanguageVideos } from "@/hooks/use-sign-language-videos"
import { StageRunCard } from "../components/StageRunCard"
import { cn } from "@/lib/utils"

interface ViewProps {
  bookLabel: string
  selectedPageId?: string
  onSelectPage?: (pageId: string | null) => void
}

const GROUP_ORDER: StageGroup[] = ["convert", "enhancements", "localization", "packaging"]

const RECOMMENDED_STAGES = new Set<string>(["captions"])

export function BookView({ bookLabel }: ViewProps) {
  const { t } = useLingui()
  const overviewSteps = getBookOverviewStages()
  const { stageState, queueRun } = useBookRun()
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

      queueRun({
        fromStage: stage.slug,
        toStage: stage.slug,
        apiKey,
      })
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
    const group = "group" in step ? (step.group as StageGroup | undefined) : undefined
    if (group) grouped[group].push(step)
  }

  const renderCard = (step: NonBookStageDefinition) => {
    const rawState = stageState(step.slug)
    const state = completionOverrides[step.slug] ? "done" : rawState
    // Validation/preview/export/sign-language aren't driven by the pipeline
    // runner, so their "running" state from useBookRun is meaningless. Only
    // pipeline stages should show the spinner.
    const isRunning =
      isPipelineStage(step) && (rawState === "running" || rawState === "queued")
    const stageCompleted = state === "done"
    const showRunButton = isPipelineStage(step) && step.slug !== "preview"
    const recommended = RECOMMENDED_STAGES.has(step.slug)

    return (
      <div className="relative">
        {recommended && (
          <span
            className="absolute right-3 -top-2 z-10 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-950 shadow-sm"
            title={t`Recommended for accessibility`}
          >
            <Trans>Recommended</Trans>
          </span>
        )}
        <StageRunCard
          stageSlug={step.slug}
          bookLabel={bookLabel}
          isRunning={isRunning}
          completed={stageCompleted}
          showRunButton={showRunButton}
          onRun={() => handleRun(step)}
          disabled={!hasApiKey || isRunning}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-2 py-2">
      <SourcePdfCard bookLabel={bookLabel} />
      {GROUP_ORDER.map((group) => {
        const steps = grouped[group]
        if (steps.length === 0) return null
        return (
          <Fragment key={group}>
            <GroupSection group={group}>
              {group === "enhancements" ? (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {steps.map((step) => (
                    <div key={step.slug}>{renderCard(step)}</div>
                  ))}
                </div>
              ) : (
                <SequentialFlow steps={steps} renderCard={renderCard} />
              )}
            </GroupSection>
            {group === "convert" && (
              <div className="flex flex-col gap-3">
                <InstructionCallout
                  variant="info"
                  icon={ArrowRight}
                  title={<Trans>You can export at this stage</Trans>}
                  body={
                    <Trans>
                      Export is not blocked by the stages below. As soon as
                      Storyboard is done, you can ship a bundle. Enhancements,
                      Localization, and Validation are optional ways to enrich
                      the book — you can export again anytime later.
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
                      accessible to readers who use screen readers or can't
                      see the images.
                    </Trans>
                  }
                  actionLabel={<Trans>Go to Image Captions</Trans>}
                  bookLabel={bookLabel}
                  toStep="captions"
                />
              </div>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

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
  const styles =
    variant === "info"
      ? {
          wrap: "border-emerald-200 bg-emerald-50/60",
          iconWrap: "bg-emerald-100 text-emerald-700",
          button: "bg-emerald-600 hover:bg-emerald-700 text-white",
        }
      : {
          wrap: "border-amber-200 bg-amber-50/60",
          iconWrap: "bg-amber-100 text-amber-700",
          button: "bg-amber-600 hover:bg-amber-700 text-white",
        }

  return (
    <div
      className={cn(
        "flex items-start gap-4 rounded-xl border px-5 py-4",
        styles.wrap,
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          styles.iconWrap,
        )}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h3 className="text-sm font-semibold leading-tight text-foreground">
          {title}
        </h3>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {body}
        </p>
        <Link
          to="/books/$label/$step"
          params={{ label: bookLabel, step: toStep }}
          className={cn(
            "mt-1 inline-flex w-fit items-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
            styles.button,
          )}
        >
          {actionLabel}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

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
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
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

function GroupSection({
  group,
  children,
}: {
  group: StageGroup
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1 border-b border-border/60 pb-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
            {GROUP_TITLE[group]}
          </h2>
          {group === "enhancements" && (
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              <Trans>Optional</Trans>
            </span>
          )}
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {GROUP_DESCRIPTION[group]}
        </p>
      </header>
      {children}
    </section>
  )
}

function SequentialFlow({
  steps,
  renderCard,
}: {
  steps: NonBookStageDefinition[]
  renderCard: (step: NonBookStageDefinition) => React.ReactNode
}) {
  return (
    <div className="flex max-w-xl flex-col items-start">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1
        return (
          <div key={step.slug} className="w-full">
            {renderCard(step)}
            {!isLast && (
              <div
                className={cn(
                  "mb-1 ml-3 flex w-8 flex-col items-center opacity-40",
                  step.textColor,
                )}
              >
                <div className="h-2 w-1.5 bg-current" />
                <svg
                  viewBox="0 0 12 8"
                  className="h-2 w-3"
                  fill="currentColor"
                >
                  <path d="M6 8L0 0h12z" />
                </svg>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const GROUP_TITLE: Record<StageGroup, React.ReactNode> = {
  convert: <Trans>Core Pipeline</Trans>,
  enhancements: <Trans>Enhancements</Trans>,
  localization: <Trans>Localization</Trans>,
  packaging: <Trans>Packaging</Trans>,
}

const GROUP_DESCRIPTION: Record<StageGroup, React.ReactNode> = {
  convert: (
    <Trans>
      Sequential stages that turn the source PDF into structured, rendered
      content. Run these in order.
    </Trans>
  ),
  enhancements: (
    <Trans>
      Optional features to enrich the book — accessibility, comprehension,
      and navigation. Run any of these in any order once the core pipeline is
      complete.
    </Trans>
  ),
  localization: (
    <Trans>
      Translate the book into other languages and generate narration. Run
      these after the enhancements you want included are in place.
    </Trans>
  ),
  packaging: (
    <Trans>
      Validate, preview, and export the final ADT bundle for delivery.
    </Trans>
  ),
}
