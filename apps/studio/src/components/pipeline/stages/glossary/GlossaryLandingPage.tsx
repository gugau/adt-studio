import { BookOpen } from "lucide-react"
import { useLingui } from "@lingui/react/macro"
import { Trans } from "@lingui/react/macro"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { usePrerequisiteChecks } from "@/hooks/use-prerequisite-checks"
import { useStageStatus } from "@/hooks/use-stage-status"
import { LandingPageShell } from "../../components/LandingPageShell"
import { RunProgress } from "../../components/RunProgress"
import { PrerequisiteWarnings } from "../../components/PrerequisiteWarnings"

// ─── Mock glossary preview ───────────────────────────────────────────────────

function Hl({ children }: { children: React.ReactNode }) {
  return <span className="bg-lime-200/70 rounded-[2px] px-[1px]">{children}</span>
}

function MockGlossaryPreview() {
  /* eslint-disable lingui/no-unlocalized-strings */
  return (
    <div className="flex flex-1 min-h-0 flex-col bg-white px-5 py-5 gap-3 overflow-hidden">
      {/* Chapter title */}
      <div>
        <p className="text-[13px] font-bold tracking-tight text-foreground">Chapter One</p>
        <p className="text-[8px] text-foreground/40 mt-0.5">Understanding cellular energy production</p>
      </div>

      {/* Two-column body */}
      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Left column */}
        <div className="flex-1 flex flex-col gap-2.5 min-w-0">
          <p className="text-[7.5px] leading-[11px] text-foreground/70">
            Every living organism requires energy to survive. From the simplest
            bacteria to the most complex mammals, the ability to convert nutrients
            into usable energy is fundamental to life. In <Hl>eukaryotic cells</Hl>,
            this process is carried out by specialized structures known
            as <Hl>organelles</Hl>, each performing distinct roles within the cell.
          </p>

          {/* Mitochondria heading with icon */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]">🔋</span>
            <p className="text-[9px] font-bold text-foreground">Mitochondria</p>
          </div>

          <p className="text-[7.5px] leading-[11px] text-foreground/70">
            The <Hl>mitochondria</Hl> are often called the powerhouses of the cell.
            They are responsible for producing <Hl>adenosine triphosphate</Hl> (ATP)
            through a process known as <Hl>cellular respiration</Hl>. This multi-step
            pathway breaks down glucose and other nutrients to release the energy
            that cells need to carry out their functions.
          </p>

          {/* Glossary popover mock */}
          <div className="relative">
            {/* Arrow */}
            <div className="absolute -top-[4px] left-4 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[4px] border-b-[#e2e8f0]" />
            <div className="absolute -top-[3px] left-4 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[4px] border-b-white" />
            {/* Card */}
            <div className="rounded-lg bg-white border border-[#e2e8f0] px-2.5 py-2 shadow-md">
              <p className="text-[7px] font-bold text-foreground mb-0.5">Mitochondria</p>
              <p className="text-[6.5px] leading-[9px] text-foreground/60">
                Membrane-bound organelles found in the cytoplasm of eukaryotic cells
                that generate most of the cell&apos;s supply of ATP, used as a source
                of chemical energy.
              </p>
            </div>
          </div>

          <p className="text-[7.5px] leading-[11px] text-foreground/70">
            Each mitochondrion has a double membrane structure. The outer membrane
            is smooth, while the inner membrane is folded into <Hl>cristae</Hl> that
            increase the surface area for <Hl>oxidative phosphorylation</Hl>.
          </p>
        </div>

        {/* Right column */}
        <div className="flex-1 flex flex-col gap-2.5 min-w-0">
          <p className="text-[7.5px] leading-[11px] text-foreground/70">
            Inside each mitochondrion, the inner membrane forms a series of
            folds called <Hl>cristae</Hl>. These folds dramatically increase the
            surface area available for the <Hl>electron transport chain</Hl>, a
            critical sequence of reactions that drives the majority of ATP synthesis.
            Without these folds, cells would produce far less energy.
          </p>
          <p className="text-[7.5px] leading-[11px] text-foreground/70">
            Mitochondria are unique among organelles because they contain their
            own <Hl>DNA</Hl>. This mitochondrial DNA is inherited exclusively from
            the mother and encodes a small but essential set of proteins. The
            presence of their own genetic material supports the theory
            of <Hl>endosymbiosis</Hl>, which proposes that mitochondria were once
            free-living bacteria that were engulfed by ancient host cells over
            a billion years ago.
          </p>
          <p className="text-[7.5px] leading-[11px] text-foreground/70">
            Beyond energy production, mitochondria play a vital role
            in <Hl>apoptosis</Hl> — programmed cell death. When a cell is damaged
            or no longer needed, mitochondria release signaling molecules that
            trigger the cell&apos;s self-destruction. This process is essential for
            healthy development and preventing diseases such as cancer.
          </p>
          <p className="text-[7.5px] leading-[11px] text-foreground/70">
            The number of mitochondria in a cell varies depending on the
            cell&apos;s energy demands. Muscle cells and <Hl>neurons</Hl>, which
            require large amounts of energy, can contain thousands of
            mitochondria. In contrast, red blood cells in mammals have none
            at all, relying instead on <Hl>glycolysis</Hl> for their modest
            energy needs.
          </p>
          <p className="text-[7.5px] leading-[11px] text-foreground/70">
            Dysfunction in mitochondria has been linked to a wide range of
            diseases, including <Hl>neurodegenerative disorders</Hl> like
            Parkinson&apos;s and Alzheimer&apos;s. Researchers continue to study
            how mitochondrial health impacts aging and overall cellular function.
          </p>
        </div>
      </div>
    </div>
  )
  /* eslint-enable lingui/no-unlocalized-strings */
}

// ─── Main landing page ────────────────────────────────────────────────────────

export function GlossaryLandingPage({
  bookLabel,
}: {
  bookLabel: string
}) {
  const { t } = useLingui()
  const { queueRun } = useBookRun()
  const { apiKey, hasApiKey } = useApiKey()
  const { storyboardReady, hasNoPages, allPagesPruned, canRun } = usePrerequisiteChecks(bookLabel)
  const { isRunning, isCompleted, hasError } = useStageStatus("glossary")

  const handleRun = () => {
    if (!hasApiKey || isRunning || !canRun) return
    queueRun({ fromStage: "glossary", toStage: "glossary", apiKey })
  }

  return (
    <LandingPageShell
      bookLabel={bookLabel}
      stageSlug="glossary"
      colorClass="bg-lime-600 hover:bg-lime-700"
      isRunning={isRunning}
      isCompleted={isCompleted}
      hasError={hasError}
      canRun={canRun}
      extraDisabled={!hasApiKey}
      runLabel={<Trans>Run Glossary</Trans>}
      rerunLabel={<Trans>Re-run</Trans>}
      previewLabel={t`Glossary Preview`}
      onRun={handleRun}
      preview={
        isRunning ? (
          <div className="flex flex-1 items-center justify-center">
            <RunProgress stepKey="glossary" spinnerColorClass="text-lime-600" />
          </div>
        ) : (
          <MockGlossaryPreview />
        )
      }
    >
      {/* Title + description */}
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
          <Trans>Glossary</Trans>
        </h1>
        <p className="text-[14px] text-[#737373] leading-relaxed">
          <Trans>
            Automatically build a glossary of key terms and definitions from
            your book's content. The glossary helps readers understand
            important vocabulary and concepts.
          </Trans>
        </p>
      </div>

      {/* Info banner */}
      <div className="rounded-xl bg-lime-50 px-5 py-4">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="shrink-0 rounded-full bg-lime-100 p-1.5">
            <BookOpen className="w-3.5 h-3.5 text-lime-600" />
          </div>
          <span className="text-[13px] font-semibold text-lime-900">
            <Trans>Enhances comprehension</Trans>
          </span>
        </div>
        <p className="text-[12.5px] text-lime-800/80 leading-relaxed pl-[34px]">
          <Trans>
            A glossary provides quick reference definitions for key terms,
            helping readers — especially younger audiences and language learners —
            understand unfamiliar vocabulary without leaving the page.
          </Trans>
        </p>
      </div>

      <PrerequisiteWarnings
        storyboardReady={storyboardReady}
        hasNoPages={hasNoPages}
        allPagesPruned={allPagesPruned}
        stageName="a glossary"
      />
    </LandingPageShell>
  )
}
