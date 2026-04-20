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
    <div className="flex flex-1 min-h-0 flex-col bg-white px-6 py-6 gap-3 overflow-hidden">
      {/* Chapter title */}
      <div>
        <p className="text-[15px] font-bold tracking-tight text-foreground">Chapter One</p>
        <p className="text-[10px] text-foreground/40 mt-0.5">Understanding cellular energy production</p>
      </div>

      {/* Two-column body */}
      <div className="flex gap-5 flex-1 min-h-0 overflow-hidden">
        {/* Left column */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <p className="text-[9.5px] leading-[14px] text-foreground/70">
            Every living organism requires energy to survive. From the simplest
            bacteria to the most complex mammals, the ability to convert nutrients
            into usable energy is fundamental to life. In <Hl>eukaryotic cells</Hl>,
            this process is carried out by specialized structures known
            as <Hl>organelles</Hl>, each performing distinct roles within the cell.
          </p>

          {/* Mitochondria heading with icon */}
          <div className="flex items-center gap-1.5">
            <span className="text-[12px]">🔋</span>
            <p className="text-[11px] font-bold text-foreground">Mitochondria</p>
          </div>

          <p className="text-[9.5px] leading-[14px] text-foreground/70">
            The <span className="relative inline"><span className="bg-lime-200/70 rounded-[2px] px-[1px] underline decoration-lime-500/50 decoration-[1.5px] underline-offset-[2px]">mitochondria</span>
              {/* Glossary popover — anchored to the highlighted word */}
              <span className="absolute left-0 top-full z-10 mt-[2px] block w-[190px]">
                <span className="block rounded-xl bg-white border border-[#e2e8f0] px-3.5 py-3 shadow-lg">
                  <span className="flex items-center gap-1.5 mb-2">
                    <span className="text-[11px]">🌿🏃⚡</span>
                    <span className="text-[11px] font-bold text-foreground">Mitochondria</span>
                  </span>
                  <span className="block text-[9px] leading-[13px] text-foreground/60">
                    An organelle in a cell that acts as a powerhouse, producing energy (ATP) through a process called cellular respiration.
                  </span>
                  <span className="block border-t border-[#e5e5e5] mt-2.5 pt-2">
                    <span className="flex items-center justify-center gap-1 text-[8.5px] font-medium text-blue-600">
                      <span className="text-[9px]">📖</span>
                      View in glossary
                    </span>
                  </span>
                </span>
              </span>
            </span> are often called the powerhouses of the cell.
            They are responsible for producing <Hl>adenosine triphosphate</Hl> (ATP)
            through a process known as <Hl>cellular respiration</Hl>. This multi-step
            pathway breaks down glucose and other nutrients to release the energy
            that cells need to carry out their functions. The number of mitochondria
            in a cell can range from a few hundred to several thousand, depending
            on the cell&apos;s energy requirements. Muscle cells, for instance,
            are packed with mitochondria to sustain prolonged physical activity.
          </p>

          <p className="text-[9.5px] leading-[14px] text-foreground/70">
            Each mitochondrion has a double membrane structure. The outer membrane
            is smooth, while the inner membrane is folded into <Hl>cristae</Hl> that
            increase the surface area for <Hl>oxidative phosphorylation</Hl>.
          </p>
          <p className="text-[9.5px] leading-[14px] text-foreground/70">
            Scientists believe mitochondria were once free-living <Hl>prokaryotes</Hl> that
            entered a symbiotic relationship with ancient host cells over a billion
            years ago. This <Hl>endosymbiotic theory</Hl> is supported by the fact
            that mitochondria possess their own circular DNA and replicate
            independently of the cell.
          </p>
          <p className="text-[9.5px] leading-[14px] text-foreground/70">
            The process of <Hl>oxidative phosphorylation</Hl> occurs along the inner
            membrane and is the primary mechanism by which cells generate ATP. It
            involves the transfer of electrons through a series of protein complexes,
            creating a proton gradient that drives the <Hl>ATP synthase</Hl> enzyme.
          </p>
        </div>

        {/* Right column */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <p className="text-[9.5px] leading-[14px] text-foreground/70">
            Inside each mitochondrion, the inner membrane forms a series of
            folds called <Hl>cristae</Hl>. These folds dramatically increase the
            surface area available for the <Hl>electron transport chain</Hl>, a
            critical sequence of reactions that drives the majority of ATP synthesis.
            Without these folds, cells would produce far less energy.
          </p>
          <p className="text-[9.5px] leading-[14px] text-foreground/70">
            Mitochondria are unique among organelles because they contain their
            own <Hl>DNA</Hl>. This mitochondrial DNA is inherited exclusively from
            the mother and encodes a small but essential set of proteins. The
            presence of their own genetic material supports the theory
            of <Hl>endosymbiosis</Hl>, which proposes that mitochondria were once
            free-living bacteria that were engulfed by ancient host cells over
            a billion years ago.
          </p>
          <p className="text-[9.5px] leading-[14px] text-foreground/70">
            Beyond energy production, mitochondria play a vital role
            in <Hl>apoptosis</Hl> — programmed cell death. When a cell is damaged
            or no longer needed, mitochondria release signaling molecules that
            trigger the cell&apos;s self-destruction. This process is essential for
            healthy development and preventing diseases such as cancer.
          </p>
          <p className="text-[9.5px] leading-[14px] text-foreground/70">
            The number of mitochondria in a cell varies depending on the
            cell&apos;s energy demands. Muscle cells and <Hl>neurons</Hl>, which
            require large amounts of energy, can contain thousands of
            mitochondria. In contrast, red blood cells in mammals have none
            at all, relying instead on <Hl>glycolysis</Hl> for their modest
            energy needs.
          </p>
          <p className="text-[9.5px] leading-[14px] text-foreground/70">
            Dysfunction in mitochondria has been linked to a wide range of
            diseases, including <Hl>neurodegenerative disorders</Hl> like
            Parkinson&apos;s and Alzheimer&apos;s. Researchers continue to study
            how mitochondrial health impacts aging and overall cellular function.
          </p>
          <p className="text-[9.5px] leading-[14px] text-foreground/70">
            Recent advances in <Hl>gene therapy</Hl> have opened new possibilities
            for treating mitochondrial diseases. Scientists are exploring ways to
            replace or repair defective mitochondrial DNA, offering hope for
            conditions that were previously considered untreatable.
          </p>
          <p className="text-[9.5px] leading-[14px] text-foreground/70">
            The relationship between mitochondria and <Hl>metabolism</Hl> extends
            beyond simple energy production. These organelles are involved in
            fatty acid oxidation, amino acid processing, and the regulation of
            <Hl>reactive oxygen species</Hl> that can cause cellular damage when
            left unchecked.
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
  const { storyboardReady, hasNoPages, allPagesPruned, canRun, isLoading: prereqLoading } = usePrerequisiteChecks(bookLabel)
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

      <PrerequisiteWarnings
        storyboardReady={storyboardReady}
        hasNoPages={hasNoPages}
        allPagesPruned={allPagesPruned}
        stageName="a glossary"
        isLoading={prereqLoading}
      />

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
    </LandingPageShell>
  )
}
