import { useState, useEffect } from "react"
import { Trans, useLingui } from "@lingui/react/macro"
import { Input } from "@/components/ui/input"
import { LandingPageShell } from "@/components/pipeline/components/LandingPageShell"
import { PrereqGuard } from "@/components/pipeline/components/PrereqGuard"
import {
  SettingsCard,
  SettingsField,
} from "@/components/pipeline/components/SettingsCard"
import { useActiveConfig } from "@/hooks/use-debug"
import { useBookConfig } from "@/hooks/use-book-config"
import { useStageStatus } from "@/hooks/use-stage-status"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { usePersistConfig } from "@/hooks/use-persist-config"
import { QuizzesPreview } from "./components/QuizzesPreview"

const DEFAULT_PAGES_PER_QUIZ = 3

export function QuizzesLandingPage({ bookLabel }: { bookLabel: string }) {
  const { t } = useLingui()
  const { data: activeConfigData } = useActiveConfig(bookLabel)
  const { data: bookConfigData } = useBookConfig(bookLabel)
  const persist = usePersistConfig(bookLabel)
  const { apiKey, hasApiKey } = useApiKey()
  const { queueRun } = useBookRun()
  const status = useStageStatus("quizzes")
  const storyboardStatus = useStageStatus("storyboard")
  const storyboardReady = storyboardStatus.isCompleted

  const [pagesPerQuiz, setPagesPerQuiz] = useState(String(DEFAULT_PAGES_PER_QUIZ))

  useEffect(() => {
    if (!activeConfigData) return
    const m = activeConfigData.merged as Record<string, unknown>
    const qg = m.quiz_generation as Record<string, unknown> | undefined
    if (qg?.pages_per_quiz != null) {
      setPagesPerQuiz(String(qg.pages_per_quiz))
    }
  }, [activeConfigData])

  const handleFrequencyChange = (value: string) => {
    setPagesPerQuiz(value)
    const n = Number(value)
    if (!Number.isInteger(n) || n < 1) return
    const existing =
      (bookConfigData?.config?.quiz_generation as Record<string, unknown>) ?? {}
    persist({ quiz_generation: { ...existing, pages_per_quiz: n } })
  }

  const handleRun = () => {
    if (!hasApiKey || !storyboardReady || status.isRunning) return
    queueRun({ fromStage: "quizzes", toStage: "quizzes", apiKey })
  }

  const disabledReason = !hasApiKey ? (
    <Trans>Add an API key in Book settings to generate quizzes.</Trans>
  ) : !storyboardReady ? (
    <Trans>
      Run Storyboard first — quizzes are written from the content placed into
      pages by Storyboard.
    </Trans>
  ) : undefined

  return (
    <LandingPageShell
      bookLabel={bookLabel}
      stageSlug="quizzes"
      settingsTab="general"
      colorClass="bg-orange-600 hover:bg-orange-700"
      accentColor="#ea580c"
      accentColorSoft="#ffedd5"
      isRunning={status.isRunning}
      isCompleted={status.isCompleted}
      hasError={status.hasError}
      canRun={true}
      extraDisabled={!hasApiKey || !storyboardReady}
      disabledReason={disabledReason}
      runLabel={<Trans>Run Quizzes</Trans>}
      rerunLabel={<Trans>Re-run</Trans>}
      previewLabel={t`Quiz Preview`}
      onRun={handleRun}
      preview={<QuizzesPreview pagesPerQuiz={Number(pagesPerQuiz)} />}
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
          <Trans>Quizzes</Trans>
        </h1>
        <p className="text-[14px] text-[#737373] leading-relaxed">
          <Trans>
            Generate multiple-choice comprehension quizzes from the book's
            content. Set how often a quiz appears, then run the stage to create
            them across the whole book.
          </Trans>
        </p>
      </div>

      <PrereqGuard
        upstreamSlug="storyboard"
        stageSlug="quizzes"
        description={
          <Trans>
            Quizzes are written from the content that Storyboard places into
            pages. Finish Storyboard before running this stage.
          </Trans>
        }
      />

      <SettingsCard>
        <SettingsField
          label={<Trans>Quiz frequency</Trans>}
          hint={
            <Trans>
              How many pages of content go into each quiz. A lower number means
              more quizzes across the book.
            </Trans>
          }
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              value={pagesPerQuiz}
              onChange={(e) => handleFrequencyChange(e.target.value)}
              className="w-24 h-9"
            />
            <span className="text-[13px] text-[#737373]">
              <Trans>pages per quiz</Trans>
            </span>
          </div>
        </SettingsField>
      </SettingsCard>
    </LandingPageShell>
  )
}
