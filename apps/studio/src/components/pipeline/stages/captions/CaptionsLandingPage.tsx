import { TriangleAlert, Sparkles, Info } from "lucide-react"
import { useLingui } from "@lingui/react/macro"
import { Trans } from "@lingui/react/macro"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { usePrerequisiteChecks } from "@/hooks/use-prerequisite-checks"
import { useStageStatus } from "@/hooks/use-stage-status"
import { LandingPageShell } from "../../components/LandingPageShell"
import { RunProgress } from "../../components/RunProgress"
import { PrerequisiteWarnings } from "../../components/PrerequisiteWarnings"

// ─── Mock book page preview (right pane illustration) ────────────────────────

function MockBookPreview() {
  /* eslint-disable lingui/no-unlocalized-strings */
  return (
    <div className="flex flex-1 min-h-0 gap-4 bg-white px-6 py-6">
      {/* Left column — chapter text */}
      <div className="flex flex-1 flex-col gap-2 overflow-hidden">
        <p className="text-center text-base font-semibold leading-snug tracking-tight text-foreground">
          Chapter One
        </p>
        <p className="text-[11px] leading-[15px] text-justify text-foreground/70">
          Mitochondria are known as the powerhouses of the cell. They are specialized organelles that act like a digestive system which takes in nutrients, breaks them down, and creates energy-rich molecules for the cell. This process is known as cellular respiration.
        </p>
        <p className="text-[11px] leading-[15px] text-justify text-foreground/70">
          Most of the chemical reactions involved in cellular respiration happen in the mitochondria. The energy produced is stored in adenosine triphosphate, or ATP &mdash; the &ldquo;currency&rdquo; of the cell.
        </p>
        <div className="text-[11px] leading-[15px] text-justify text-foreground/70">
          <p>Mitochondria also play a vital role in other cellular processes:</p>
          <ul className="list-disc ml-3 mt-1 space-y-0.5">
            <li><span>Cell Cycle Control: They help regulate when a cell grows and divides.</span></li>
            <li><span>Calcium Storage: They act as a reservoir for calcium ions.</span></li>
            <li><span>Apoptosis: They play a key role in programmed cell death.</span></li>
          </ul>
        </div>
        <p className="text-[11px] leading-[15px] text-justify text-foreground/70">
          Because of their critical role, any dysfunction in the mitochondria can lead to significant health issues. These organelles are unique because they contain their own DNA, inherited entirely from the mother.
        </p>
        <p className="text-[11px] leading-[15px] text-justify text-foreground/70">
          The number of mitochondria in a cell varies depending on the cell&rsquo;s energy demands. Muscle cells and nerve cells, which require large amounts of ATP, contain thousands of mitochondria, while red blood cells have none at all.
        </p>
        <p className="text-[11px] leading-[15px] text-justify text-foreground/70">
          Scientists believe mitochondria were once free-living bacteria that were engulfed by ancient cells over a billion years ago. This theory, known as the endosymbiotic theory, is supported by the fact that mitochondria have their own circular DNA and double membranes, much like bacteria.
        </p>
      </div>

      {/* Right column — text + image + alt-text card + text */}
      <div className="flex flex-1 flex-col gap-2 overflow-hidden">
        <p className="text-[11px] leading-[15px] text-justify text-foreground/70">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation.
        </p>

        {/* Mitochondria image */}
        <img
          src="/previews/mitochondria.png"
          alt=""
          className="w-full shrink-0 rounded-sm border border-blue-500 object-contain bg-white"
        />

        {/* Alt-text card — near the image */}
        <div className="flex flex-col gap-1 rounded-md border border-[#e5e5e5] bg-white p-2.5 shadow-[0px_4px_10px_0px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-1.5">
            <div className="shrink-0 rounded-full bg-blue-100 p-1">
              <Sparkles className="h-3 w-3 text-blue-600" />
            </div>
            <span className="text-[11px] font-semibold tracking-tight text-black">
              Image Alt-Text
            </span>
          </div>
          <p className="text-[10px] font-medium leading-[13px] text-black text-justify">
            &ldquo;A 3D cross-section diagram of a mitochondrion showing its internal structures, including the inner and outer membranes, cristae, and matrix, with labels for various components like DNA and ATP synthase.&rdquo;
          </p>
          <p className="text-[9px] font-medium text-[#99a1af]">
            This text is only perceptible to assistive technologies.
          </p>
        </div>

        <p className="text-[11px] leading-[15px] text-justify text-foreground/70">
          Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
        </p>
        <p className="text-[11px] leading-[15px] text-justify text-foreground/70">
          Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.
        </p>
        <p className="text-[11px] leading-[15px] text-justify text-foreground/70">
          Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.
        </p>
      </div>
    </div>
  )
  /* eslint-enable lingui/no-unlocalized-strings */
}

// ─── Main landing page ────────────────────────────────────────────────────────

export function CaptionsLandingPage({
  bookLabel,
}: {
  bookLabel: string
}) {
  const { t } = useLingui()
  const { queueRun } = useBookRun()
  const { apiKey, hasApiKey } = useApiKey()
  const { storyboardReady, hasNoPages, allPagesPruned, canRun, pages, isLoading: prereqLoading } = usePrerequisiteChecks(bookLabel)
  const { isRunning, isCompleted, hasError } = useStageStatus("captions")

  // ── Image count ─────────────────────────────────────────────────
  const totalImages = pages?.reduce((sum, p) => sum + p.imageCount, 0) ?? null
  const pagesWithImages = pages?.filter((p) => p.imageCount > 0).length ?? null
  const hasNoImages = totalImages === 0

  const handleRun = () => {
    if (!hasApiKey || isRunning || !canRun || hasNoImages) return
    queueRun({ fromStage: "captions", toStage: "captions", apiKey })
  }

  return (
    <LandingPageShell
      bookLabel={bookLabel}
      stageSlug="captions"
      colorClass="bg-teal-600 hover:bg-teal-700"
      isRunning={isRunning}
      isCompleted={isCompleted}
      hasError={hasError}
      canRun={canRun}
      extraDisabled={!hasApiKey || hasNoImages}
      runLabel={<Trans>Run Captions</Trans>}
      rerunLabel={<Trans>Re-run</Trans>}
      previewLabel={t`Caption Preview`}
      onRun={handleRun}
      preview={
        isRunning ? (
          <div className="flex flex-1 items-center justify-center">
            <RunProgress stepKey="image-captioning" spinnerColorClass="text-teal-500" />
          </div>
        ) : (
          <MockBookPreview />
        )
      }
    >
      {/* Title + description */}
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
          <Trans>Image Captions</Trans>
        </h1>
        <p className="text-[14px] text-[#737373] leading-relaxed">
          <Trans>
            Generate descriptive captions for all images in your book.
            Captions improve accessibility and provide context for readers
            who cannot see the images.
          </Trans>
        </p>
      </div>

      <PrerequisiteWarnings
        storyboardReady={storyboardReady}
        hasNoPages={hasNoPages}
        allPagesPruned={allPagesPruned}
        stageName="captions"
        isLoading={prereqLoading}
      />

      <div className="rounded-xl bg-teal-50 px-5 py-4">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="shrink-0 rounded-full bg-teal-100 p-1.5">
            <Info className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <span className="text-[13px] font-semibold text-teal-900">
            <Trans>Recommended for accessibility</Trans>
          </span>
        </div>
        <p className="text-[12.5px] text-teal-800/80 leading-relaxed pl-[34px]">
          <Trans>
            Image captions provide alternative text descriptions that screen readers
            use to convey visual content to users who are blind or have low vision.
            Adding captions ensures your book meets accessibility standards (WCAG)
            and can reach the widest possible audience.
          </Trans>
        </p>
      </div>

      {canRun && hasNoImages && (
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <TriangleAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium text-amber-800">
              <Trans>No images found</Trans>
            </span>
            <span className="text-[12px] text-amber-700 leading-relaxed">
              <Trans>
                This book has no images to caption. Image captions can only
                be generated for books that contain images.
              </Trans>
            </span>
          </div>
        </div>
      )}

      {/* Summary stats */}
      {canRun && !hasNoImages && totalImages !== null && (
        <div className="flex gap-4">
          <div className="flex flex-col gap-0.5 rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-4 py-3 flex-1">
            <span className="text-[11px] font-medium text-[#a3a3a3] uppercase tracking-wider">
              <Trans>Images</Trans>
            </span>
            <span className="text-xl font-semibold text-[#0a0a0a] tabular-nums">{totalImages}</span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-4 py-3 flex-1">
            <span className="text-[11px] font-medium text-[#a3a3a3] uppercase tracking-wider">
              <Trans>Pages with images</Trans>
            </span>
            <span className="text-xl font-semibold text-[#0a0a0a] tabular-nums">{pagesWithImages}</span>
          </div>
        </div>
      )}
    </LandingPageShell>
  )
}
