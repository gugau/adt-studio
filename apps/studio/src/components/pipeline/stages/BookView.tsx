import { useCallback } from "react"
import { Link } from "@tanstack/react-router"
import { getBookOverviewStages, isPipelineStage, type NonBookStageDefinition } from "../stage-config"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { useAccessibilityAssessment } from "@/hooks/use-debug"
import { StageRunCard } from "../components/StageRunCard"

interface ViewProps {
  bookLabel: string
  selectedPageId?: string
  onSelectPage?: (pageId: string | null) => void
}

export function BookView({ bookLabel }: ViewProps) {
  // Filter out "speech" — it's combined with "translation" into one "Text & Speech" card
  const overviewSteps = getBookOverviewStages().filter((s) => s.slug !== "speech")
  const { stageState, queueRun } = useBookRun()
  const { apiKey, hasApiKey, azureKey, azureRegion, geminiKey } = useApiKey()
  const { data: accessibilityAssessment } = useAccessibilityAssessment(bookLabel)
  const validationCompleted = Boolean(accessibilityAssessment?.assessment)

  const handleRun = useCallback((stage: NonBookStageDefinition) => {
    if (!hasApiKey || !isPipelineStage(stage)) return

    const state = stageState(stage.slug)
    if (state === "running" || state === "queued") return

    // "Text & Speech" card runs translation → speech
    const toStage = stage.slug === "translation" ? "speech" : stage.slug

    queueRun({
      fromStage: stage.slug,
      toStage,
      apiKey,
      providerCredentials: {
        azure: { key: azureKey, region: azureRegion },
        geminiApiKey: geminiKey,
      },
    })
  }, [hasApiKey, stageState, queueRun, apiKey, azureKey, azureRegion, geminiKey])

  return (
    <div className="flex max-w-xl flex-col items-start">
      {overviewSteps.map((step, index) => {
        const isLast = index === overviewSteps.length - 1

        // For "translation", combine with speech stage state
        const isTextAndSpeech = step.slug === "translation"
        const translationState = stageState("translation")
        const speechState = stageState("speech")

        const state = step.slug === "validation" && validationCompleted
          ? "done"
          : isTextAndSpeech
            ? (translationState === "running" || translationState === "queued" || speechState === "running" || speechState === "queued")
              ? "running"
              : (translationState === "done" && speechState === "done")
                ? "done"
                : (translationState === "error" || speechState === "error")
                  ? "error"
                  : translationState
            : stageState(step.slug)
        const isRunning = step.slug !== "validation" && (state === "running" || state === "queued")
        const stageCompleted = state === "done"
        const showRunButton = isPipelineStage(step) && step.slug !== "preview"
        const hasError = isTextAndSpeech
          ? translationState === "error" || speechState === "error"
          : undefined

        return (
          <div key={step.slug} className="w-full">
            <Link
              to="/books/$label/$step"
              params={{ label: bookLabel, step: step.slug }}
              className="block"
            >
              <StageRunCard
                stageSlug={step.slug}
                additionalStageSlugs={isTextAndSpeech ? ["speech"] : undefined}
                overrideHasError={hasError}
                isRunning={isRunning}
                completed={stageCompleted}
                showRunButton={showRunButton}
                onRun={() => handleRun(step)}
                disabled={!hasApiKey || isRunning}
              />
            </Link>
            {!isLast && (
              <div className={`mb-1 ml-3 flex w-8 flex-col items-center ${step.textColor} opacity-40`}>
                <div className="h-2 w-1.5 bg-current" />
                <svg viewBox="0 0 12 8" className="h-2 w-3" fill="currentColor">
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
