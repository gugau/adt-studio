import { AudioLines, Volume2, Pause, SkipBack, SkipForward } from "lucide-react"
import { useLingui } from "@lingui/react/macro"
import { Trans } from "@lingui/react/macro"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { usePrerequisiteChecks } from "@/hooks/use-prerequisite-checks"
import { useStageStatus } from "@/hooks/use-stage-status"
import { LandingPageShell } from "../../components/LandingPageShell"
import { RunProgress } from "../../components/RunProgress"
import { PrerequisiteWarnings } from "../../components/PrerequisiteWarnings"

// ─── Mock speech preview (book page with audio player) ──────────────────────

function MockSpeechPreview() {
  /* eslint-disable lingui/no-unlocalized-strings */
  // Simulated waveform bar heights (normalized 0..1)
  const waveform = [
    0.3, 0.55, 0.42, 0.7, 0.85, 0.6, 0.45, 0.78, 0.92, 0.66,
    0.5, 0.72, 0.88, 0.7, 0.55, 0.4, 0.62, 0.8, 0.95, 0.72,
    0.58, 0.42, 0.66, 0.88, 0.7, 0.5, 0.35, 0.55, 0.72, 0.6,
    0.45, 0.3, 0.5, 0.68, 0.82, 0.6, 0.42, 0.28, 0.48, 0.65,
    0.78, 0.58, 0.4, 0.55, 0.72, 0.9, 0.68, 0.5, 0.38, 0.55,
    0.72, 0.88, 0.62, 0.45, 0.35, 0.5, 0.68, 0.82, 0.65, 0.48,
  ]
  // Progress position (0..1)
  const progress = 0.38

  return (
    <div className="relative flex flex-1 min-h-0 overflow-hidden">
      {/* Book page background */}
      <div className="flex flex-1 min-h-0 bg-white">
        <div className="flex flex-1 gap-4 px-6 py-6 pb-20">
          {/* Left column */}
          <div className="flex-1 flex flex-col gap-2">
            <p className="text-center text-[13px] font-bold tracking-tight text-foreground">
              Chapter One
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Every living organism requires energy to survive. From the simplest bacteria to the most complex mammals, the ability to convert nutrients into usable energy is fundamental to life.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              In eukaryotic cells, this process is carried out by specialized structures known as organelles, each performing distinct roles within the cell.
            </p>

            {/* Currently-playing sentence — highlighted */}
            <div className="relative rounded-md bg-rose-50 ring-1 ring-rose-200 px-2 py-1.5 shadow-[0_0_0_3px_rgba(244,63,94,0.08)]">
              <div className="absolute -left-1 top-0 bottom-0 w-[2px] bg-rose-500 rounded-full" />
              <p className="text-[9px] leading-[13px] text-justify text-rose-900 font-medium">
                Mitochondria are often called the powerhouses of the cell. They produce adenosine triphosphate (ATP) through a process known as <span className="bg-rose-200/70 rounded-sm px-0.5">cellular respiration</span>.
              </p>
              <div className="flex items-center gap-1 mt-1 text-rose-600">
                <Volume2 className="w-2.5 h-2.5 animate-pulse" />
                <div className="flex items-end gap-[1px] h-2">
                  <span className="w-[2px] bg-rose-500 rounded-full animate-pulse" style={{ height: "40%", animationDelay: "0ms" }} />
                  <span className="w-[2px] bg-rose-500 rounded-full animate-pulse" style={{ height: "80%", animationDelay: "120ms" }} />
                  <span className="w-[2px] bg-rose-500 rounded-full animate-pulse" style={{ height: "55%", animationDelay: "240ms" }} />
                  <span className="w-[2px] bg-rose-500 rounded-full animate-pulse" style={{ height: "95%", animationDelay: "360ms" }} />
                  <span className="w-[2px] bg-rose-500 rounded-full animate-pulse" style={{ height: "65%", animationDelay: "480ms" }} />
                </div>
              </div>
            </div>

            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Each mitochondrion has a double membrane. The outer membrane is smooth, while the inner one folds into cristae that increase the available surface area.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Muscle cells, for instance, contain thousands of mitochondria to sustain prolonged physical activity over long periods of time.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Scientists believe mitochondria were once free-living bacteria that entered a symbiotic relationship with ancient host cells.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              This endosymbiotic theory is supported by the fact that mitochondria possess their own circular DNA and replicate independently of the rest of the cell.
            </p>
          </div>
          {/* Right column */}
          <div className="flex-1 flex flex-col gap-2">
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Inside each mitochondrion, the inner membrane forms a series of folds called cristae. These folds dramatically increase the surface area for chemical reactions.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Mitochondria are unique among organelles because they contain their own DNA. This mitochondrial DNA is inherited exclusively from the mother.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              The presence of their own genetic material supports the theory of endosymbiosis, which proposes mitochondria were once free-living bacteria.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Beyond energy production, mitochondria play a vital role in apoptosis — programmed cell death that removes damaged or unneeded cells.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Dysfunction in mitochondria has been linked to neurodegenerative disorders like Parkinson&rsquo;s and Alzheimer&rsquo;s, sparking active research.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Recent advances in gene therapy have opened new possibilities for treating mitochondrial diseases and restoring cellular function.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Mitochondria are also involved in calcium signaling, helping the cell respond to changes in its environment with remarkable precision.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Exercise has been shown to stimulate the growth of new mitochondria, a process known as mitochondrial biogenesis that improves endurance.
            </p>
          </div>
        </div>
      </div>

      {/* Audio player — anchored to bottom */}
      <div className="absolute left-3 right-3 bottom-3 flex items-center gap-2 rounded-xl border border-rose-100 bg-white/95 backdrop-blur-sm px-3 py-2 shadow-lg">
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            className="flex items-center justify-center w-5 h-5 rounded-full text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <SkipBack className="w-2.5 h-2.5" />
          </button>
          <button
            type="button"
            className="flex items-center justify-center w-7 h-7 rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-700 transition-colors"
          >
            <Pause className="w-3 h-3" />
          </button>
          <button
            type="button"
            className="flex items-center justify-center w-5 h-5 rounded-full text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <SkipForward className="w-2.5 h-2.5" />
          </button>
        </div>

        {/* Waveform */}
        <div className="flex flex-1 items-end gap-[2px] h-6 min-w-0 overflow-hidden">
          {waveform.map((h, i) => {
            const played = i / waveform.length < progress
            return (
              <span
                key={i}
                className={`flex-1 rounded-full transition-colors ${played ? "bg-rose-500" : "bg-rose-200"}`}
                style={{ height: `${h * 100}%` }}
              />
            )
          })}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-[8px] font-mono tabular-nums text-foreground/60">
          <span className="text-rose-600 font-semibold">0:28</span>
          <span>/</span>
          <span>1:14</span>
        </div>
      </div>
    </div>
  )
  /* eslint-enable lingui/no-unlocalized-strings */
}

// ─── Main landing page ────────────────────────────────────────────────────────

export function SpeechLandingPage({
  bookLabel,
}: {
  bookLabel: string
}) {
  const { t } = useLingui()
  const { queueRun } = useBookRun()
  const { apiKey, hasApiKey } = useApiKey()
  const { storyboardReady, hasNoPages, allPagesPruned, canRun, isLoading: prereqLoading } = usePrerequisiteChecks(bookLabel)
  const { isRunning, isCompleted, hasError } = useStageStatus("speech")

  const handleRun = () => {
    if (!hasApiKey || isRunning || !canRun) return
    queueRun({ fromStage: "speech", toStage: "speech", apiKey })
  }

  return (
    <LandingPageShell
      bookLabel={bookLabel}
      stageSlug="speech"
      colorClass="bg-rose-600 hover:bg-rose-700"
      isRunning={isRunning}
      isCompleted={isCompleted}
      hasError={hasError}
      canRun={canRun}
      extraDisabled={!hasApiKey}
      runLabel={<Trans>Run Speech</Trans>}
      rerunLabel={<Trans>Re-run</Trans>}
      previewLabel={t`Speech Preview`}
      onRun={handleRun}
      preview={
        isRunning ? (
          <div className="flex flex-1 items-center justify-center">
            <RunProgress stepKey="tts" spinnerColorClass="text-rose-500" />
          </div>
        ) : (
          <MockSpeechPreview />
        )
      }
    >
      {/* Title + description */}
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
          <Trans>Speech</Trans>
        </h1>
        <p className="text-[14px] text-[#737373] leading-relaxed">
          <Trans>
            Generate audio narration for every page of your book. The speech
            pipeline synthesizes text-to-speech audio that can be played alongside
            the written content for a complete reading experience.
          </Trans>
        </p>
      </div>

      <PrerequisiteWarnings
        storyboardReady={storyboardReady}
        hasNoPages={hasNoPages}
        allPagesPruned={allPagesPruned}
        stageName="speech"
        isLoading={prereqLoading}
      />

      {/* Info banner */}
      <div className="rounded-xl bg-rose-50 px-5 py-4">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="shrink-0 rounded-full bg-rose-100 p-1.5">
            <AudioLines className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <span className="text-[13px] font-semibold text-rose-900">
            <Trans>Audio accessibility</Trans>
          </span>
        </div>
        <p className="text-[12.5px] text-rose-800/80 leading-relaxed pl-[34px]">
          <Trans>
            Spoken narration makes your book accessible to readers who are blind,
            have low vision, or simply prefer listening. Each page becomes a
            synchronized audio track so readers can follow along at their own pace.
          </Trans>
        </p>
      </div>
    </LandingPageShell>
  )
}
