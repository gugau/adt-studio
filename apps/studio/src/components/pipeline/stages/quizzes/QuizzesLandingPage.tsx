import { useState, useEffect, useRef, useCallback } from "react"
import { HelpCircle, Check, TriangleAlert } from "lucide-react"
import { useLingui } from "@lingui/react/macro"
import { Trans } from "@lingui/react/macro"
import { cn } from "@/lib/utils"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { useActiveConfig } from "@/hooks/use-debug"
import { usePrerequisiteChecks } from "@/hooks/use-prerequisite-checks"
import { useStageStatus } from "@/hooks/use-stage-status"
import { PreviewShell } from "@/components/wizard/shared/PreviewShell"
import { SingleValueSlider } from "@/components/wizard/shared/RangeSlider"
import { SECTION_TYPES } from "@/lib/section-constants"
import { LandingPageShell } from "../../components/LandingPageShell"
import { RunProgress } from "../../components/RunProgress"
import { PrerequisiteWarnings } from "../../components/PrerequisiteWarnings"

// ─── Tween counter ───────────────────────────────────────────────────────────

function useTweenNumber(target: number, duration = 400): number {
  const [displayed, setDisplayed] = useState(target)
  const rafRef = useRef<number>(0)
  const startRef = useRef({ value: target, time: 0 })

  const animate = useCallback((from: number, to: number) => {
    cancelAnimationFrame(rafRef.current)
    startRef.current = { value: from, time: performance.now() }

    const step = (now: number) => {
      const elapsed = now - startRef.current.time
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(from + (to - from) * eased)
      setDisplayed(current)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      }
    }
    rafRef.current = requestAnimationFrame(step)
  }, [duration])

  useEffect(() => {
    animate(displayed, target)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target])

  return displayed
}

function TweenNumber({ value, className }: { value: number; className?: string }) {
  const displayed = useTweenNumber(value)
  return <span className={cn("tabular-nums", className)}>{displayed}</span>
}

// ─── Frequency options ────────────────────────────────────────────────────────

/* eslint-disable lingui/no-unlocalized-strings */
const FREQ_OPTIONS = [
  { value: "1", label: "Every page", hint: "High density" },
  { value: "3", label: "Every 3 pages", hint: "Recommended" },
  { value: "5", label: "Every 5 pages", hint: "Low density" },
  { value: "custom", label: "Custom", hint: null },
] as const
/* eslint-enable lingui/no-unlocalized-strings */

type FreqValue = "1" | "3" | "5" | "custom"

function freqFromPages(pages: string | undefined): FreqValue {
  if (!pages) return "3"
  if (pages === "1" || pages === "3" || pages === "5") return pages as FreqValue
  return "custom"
}

// ─── Mock quiz preview (right pane illustration) ──────────────────────────────

function MockQuizCard() {
  const { t } = useLingui()

  const card = (
    <div className="w-full rounded-xl border border-[#e5e5e5] bg-white shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 border-b border-orange-100">
        <HelpCircle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
        <span className="text-xs font-semibold text-orange-700">{t`Pages 4 – 6`}</span>
      </div>

      {/* Question */}
      <div className="px-4 pt-3 pb-2">
        <p className="text-sm font-medium text-[#0a0a0a] leading-snug">
          {t`What best describes the main theme of this section?`}
        </p>
      </div>

      {/* Options */}
      <div className="px-4 pb-4 flex flex-col gap-1.5">
        {[
          { text: t`Cooperation and trust`, correct: true },
          { text: t`Individual achievement`, correct: false },
          { text: t`Environmental change`, correct: false },
          { text: t`Historical context`, correct: false },
        ].map((opt, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm",
              opt.correct
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-[#f5f5f5] text-[#737373]"
            )}
          >
            {opt.correct ? (
              <Check className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <div className="w-3.5 h-3.5 rounded-full border border-current opacity-40 shrink-0" />
            )}
            <span className="leading-snug">{opt.text}</span>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="relative w-full max-w-sm">
      {/* Stacked cards behind */}
      <div className="absolute inset-0 translate-y-2.5 scale-[0.96] rounded-xl border border-[#e5e5e5] bg-[#fafafa] opacity-60" />
      <div className="absolute inset-0 translate-y-5 scale-[0.92] rounded-xl border border-[#e5e5e5] bg-[#f5f5f5] opacity-30" />
      {/* Front card */}
      <div className="relative">{card}</div>
    </div>
  )
}

// ─── Main landing page ────────────────────────────────────────────────────────

export function QuizzesLandingPage({
  bookLabel,
}: {
  bookLabel: string
}) {
  const { t } = useLingui()
  const { queueRun } = useBookRun()
  const { apiKey, hasApiKey } = useApiKey()
  const { storyboardReady, hasNoPages, allPagesPruned, canRun, pages } = usePrerequisiteChecks(bookLabel)
  const { isRunning, isCompleted, hasError } = useStageStatus("quizzes")
  const { data: activeConfigData } = useActiveConfig(bookLabel, { refetchOnMount: "always" })

  // ── Activity detection (from config) ────────────────────────────
  const activityTypeNames = SECTION_TYPES.filter((t) => t.value.startsWith("activity_")).map((t) => t.value)
  const disabledSectionTypes = new Set(
    Array.isArray((activeConfigData?.merged as Record<string, unknown>)?.disabled_section_types)
      ? (activeConfigData!.merged as Record<string, unknown>).disabled_section_types as string[]
      : []
  )
  const hasActivities = activityTypeNames.some((t) => !disabledSectionTypes.has(t))
  const showActivityWarning = hasActivities && canRun

  // ── Config state ────────────────────────────────────────────────
  const [freqChoice, setFreqChoice] = useState<FreqValue>("3")
  const [customFreq, setCustomFreq] = useState("4")

  // Seed from merged config when available
  useEffect(() => {
    if (!activeConfigData) return
    const m = activeConfigData.merged as Record<string, unknown>
    if (m.quiz_generation && typeof m.quiz_generation === "object") {
      const qg = m.quiz_generation as Record<string, unknown>
      if (qg.pages_per_quiz != null) {
        const raw = String(qg.pages_per_quiz)
        const choice = freqFromPages(raw)
        setFreqChoice(choice)
        if (choice === "custom") setCustomFreq(raw)
      }
    }
  }, [activeConfigData])

  // ── Estimated quiz count ────────────────────────────────────────
  const pageCount = pages?.length ?? null
  const effectiveFreq = freqChoice === "custom" ? Number(customFreq) || 3 : Number(freqChoice)
  const estimatedCount = pageCount !== null ? Math.max(1, Math.floor(pageCount / effectiveFreq)) : null

  // ── Run ─────────────────────────────────────────────────────────
  const handleRun = () => {
    if (!hasApiKey || isRunning || !canRun) return
    queueRun({ fromStage: "quizzes", toStage: "quizzes", apiKey })
  }

  return (
    <LandingPageShell
      bookLabel={bookLabel}
      stageSlug="quizzes"
      colorClass="bg-orange-500 hover:bg-orange-600"
      isRunning={isRunning}
      isCompleted={isCompleted}
      hasError={hasError}
      canRun={canRun}
      extraDisabled={!hasApiKey}
      runLabel={<Trans>Run Quizzes</Trans>}
      rerunLabel={<Trans>Re-run</Trans>}
      previewLabel={t`Quiz Preview`}
      previewBodyClassName="items-center justify-center"
      onRun={handleRun}
      preview={
        isRunning ? (
          <RunProgress stepKey="quiz-generation" spinnerColorClass="text-orange-500" />
        ) : (
          <>
            {estimatedCount !== null && (
              <p className="shrink-0 text-xs text-[#a3a3a3] pb-2">
                <Trans>
                  Approximately <TweenNumber value={estimatedCount} className="font-semibold text-[#737373]" /> questions will be generated
                </Trans>
              </p>
            )}
            <MockQuizCard />
          </>
        )
      }
    >
      {/* Title + reactive description */}
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
          <Trans>Quiz Generation</Trans>
        </h1>
        <p className="text-[14px] text-[#737373] leading-relaxed">
          <Trans>
            Automatically create multiple-choice comprehension questions from
            your book's content. Each question targets a specific page range
            and includes four options with explanations.
          </Trans>
        </p>
      </div>

      <PrerequisiteWarnings
        storyboardReady={storyboardReady}
        hasNoPages={hasNoPages}
        allPagesPruned={allPagesPruned}
        stageName="quizzes"
      />

      {showActivityWarning && (
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <TriangleAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium text-amber-800">
              <Trans>This book already has activities</Trans>
            </span>
            <span className="text-[12px] text-amber-700 leading-relaxed">
              <Trans>
                Adding quizzes to a book that already contains activities may
                result in redundant content. Consider skipping this step.
              </Trans>
            </span>
          </div>
        </div>
      )}

      {/* Frequency picker — vertical radio list */}
      <div className="flex flex-col gap-2">
        <label className="text-[12px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
          <Trans>How often?</Trans>
        </label>
        <div className="flex flex-col gap-1.5">
          {FREQ_OPTIONS.map((opt) => {
            const selected = freqChoice === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFreqChoice(opt.value)}
                className={cn(
                  "flex items-center gap-3.5 px-4 py-3 rounded-lg border text-left transition-all cursor-pointer",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
                  selected
                    ? "border-orange-500 bg-orange-50"
                    : "border-[#e5e5e5] bg-white hover:border-[#d4d4d4] hover:bg-[#fafafa]"
                )}
                style={selected ? { boxShadow: "0 0 0 1px #f97316" } : undefined}
              >
                {/* Radio indicator */}
                <div className={cn(
                  "h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors",
                  selected ? "border-orange-500" : "border-[#d4d4d4]"
                )}>
                  {selected && <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />}
                </div>

                <span className={cn(
                  "flex-1 text-[13px] font-medium leading-none",
                  selected ? "text-[#0a0a0a]" : "text-[#404040]"
                )}>
                  {opt.label}
                </span>

                {opt.hint && (
                  <span className={cn(
                    "text-[11px] font-medium leading-none shrink-0",
                    selected ? "text-orange-500" : "text-[#c4c4c4]"
                  )}>
                    {opt.hint}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Custom frequency slider */}
        <div
          className={cn(
            "grid transition-all duration-300 cubic-bezier(0.22, 1, 0.36, 1)",
            freqChoice === "custom"
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            <div
              className={cn(
                "p-2 transition-transform duration-300",
                freqChoice === "custom"
                  ? "translate-y-0"
                  : "-translate-y-4"
              )}
            >
              <SingleValueSlider
                label={t`Pages per question`}
                min={1}
                max={pageCount ?? 20}
                value={Number(customFreq) || 4}
                onChange={(v) => setCustomFreq(String(v))}
                valueUnit={Number(customFreq) === 1 ? t`page` : t`pages`}
                color="#f97316"
              />
            </div>
          </div>
        </div>
      </div>
    </LandingPageShell>
  )
}
