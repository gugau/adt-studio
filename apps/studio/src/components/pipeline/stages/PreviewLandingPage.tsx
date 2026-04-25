import { Eye, RotateCcw } from "lucide-react"
import { useNavigate } from "@tanstack/react-router"
import { useLingui } from "@lingui/react/macro"
import { Trans } from "@lingui/react/macro"
import { usePrerequisiteChecks } from "@/hooks/use-prerequisite-checks"
import { LandingPageShell } from "../components/LandingPageShell"
import { PrerequisiteWarnings } from "../components/PrerequisiteWarnings"

// ─── Mock preview (packaged ADT in a browser frame) ────────────────────────

function MockPreview() {
  /* eslint-disable lingui/no-unlocalized-strings */
  return (
    <div className="relative flex flex-1 min-h-0 overflow-hidden bg-gradient-to-br from-gray-100 to-gray-50 p-4">
      {/* Browser chrome */}
      <div className="flex flex-1 flex-col rounded-lg border border-gray-300 bg-white shadow-xl overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-gray-200 bg-gray-50 shrink-0">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="rounded px-2 py-0.5 bg-white border border-gray-200 text-[7px] text-gray-500 tabular-nums">
              preview.adt-studio.local/book
            </div>
          </div>
          <RotateCcw className="w-2.5 h-2.5 text-gray-400" />
        </div>

        {/* Book header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-violet-500 to-blue-500" />
            <span className="text-[9px] font-bold tracking-tight text-foreground">
              The Cell and Its Wonders
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[7px] text-gray-500">Chapter 2 of 6</span>
            <div className="w-12 h-1 rounded-full bg-gray-200 overflow-hidden">
              <div className="w-1/3 h-full bg-gray-700" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left sidebar (TOC) */}
          <aside className="flex flex-col gap-1 w-[28%] border-r border-gray-200 bg-gray-50 px-2 py-2 shrink-0 overflow-hidden">
            <span className="text-[7px] font-semibold text-gray-500 uppercase tracking-wider pb-1">Contents</span>
            <div className="text-[7px] text-gray-400">Introduction</div>
            <div className="text-[7px] font-semibold text-gray-900 bg-white rounded px-1 py-0.5">Cell Biology</div>
            <div className="pl-2 flex flex-col gap-0.5">
              <div className="text-[6.5px] text-gray-500">What is a cell?</div>
              <div className="text-[6.5px] text-gray-800 font-semibold">· Organelles</div>
              <div className="text-[6.5px] text-gray-500">Cell membrane</div>
            </div>
            <div className="text-[7px] text-gray-400">Photosynthesis</div>
            <div className="text-[7px] text-gray-400">Respiration</div>
            <div className="text-[7px] text-gray-400">DNA and Genes</div>
          </aside>

          {/* Main book page */}
          <main className="flex-1 flex flex-col gap-1.5 px-4 py-3 overflow-hidden">
            <p className="text-[12px] font-bold tracking-tight text-foreground">
              Organelles
            </p>
            <p className="text-[7.5px] leading-[11px] text-foreground/70 text-justify">
              Organelles are specialized structures within cells that perform specific functions. Each organelle is bounded by a membrane and works in concert with others to sustain the cell.
            </p>
            <div className="w-full h-14 rounded bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 border border-blue-200/50 flex items-center justify-center">
              <span className="text-[6.5px] text-blue-700/50 italic">[ cell diagram ]</span>
            </div>
            <p className="text-[7.5px] leading-[11px] text-foreground/70 text-justify">
              The nucleus houses DNA and coordinates gene expression. Mitochondria produce energy. Ribosomes assemble proteins from amino acids.
            </p>
            <p className="text-[7.5px] leading-[11px] text-foreground/70 text-justify">
              The endoplasmic reticulum and Golgi apparatus fold and sort proteins before sending them to their cellular destinations.
            </p>
            <div className="flex items-center gap-1 pt-1 mt-auto">
              <div className="flex items-center gap-1 text-[6.5px] text-gray-500">
                <Eye className="w-2 h-2" />
                Accessibility: 86
              </div>
              <div className="ml-auto flex gap-1">
                <div className="rounded px-1.5 py-0.5 bg-gray-100 text-[6px] text-gray-600">← Previous</div>
                <div className="rounded px-1.5 py-0.5 bg-gray-800 text-[6px] text-white">Next →</div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
  /* eslint-enable lingui/no-unlocalized-strings */
}

// ─── Main landing page ────────────────────────────────────────────────────────

export function PreviewLandingPage({
  bookLabel,
}: {
  bookLabel: string
}) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const { storyboardReady, hasNoPages, allPagesPruned, isLoading: prereqLoading } = usePrerequisiteChecks(bookLabel)

  const handleGoToStoryboard = () => {
    void navigate({
      to: "/books/$label/$step",
      params: { label: bookLabel, step: "storyboard" },
    })
  }

  return (
    <LandingPageShell
      bookLabel={bookLabel}
      stageSlug="preview"
      colorClass="bg-gray-700 hover:bg-gray-800"
      isRunning={false}
      isCompleted={false}
      hasError={false}
      canRun={true}
      runLabel={<Trans>Go to Storyboard</Trans>}
      rerunLabel={<Trans>Go to Storyboard</Trans>}
      previewLabel={t`ADT Preview`}
      onRun={handleGoToStoryboard}
      preview={<MockPreview />}
    >
      {/* Title + description */}
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
          <Trans>Preview</Trans>
        </h1>
        <p className="text-[14px] text-[#737373] leading-relaxed">
          <Trans>
            See the final packaged ADT exactly as a reader will — a live,
            navigable book in a web shell. Preview surfaces accessibility
            findings and reviewer notes inline so you can inspect any issue
            in context.
          </Trans>
        </p>
      </div>

      <PrerequisiteWarnings
        storyboardReady={storyboardReady}
        hasNoPages={hasNoPages}
        allPagesPruned={allPagesPruned}
        stageName="a preview"
        isLoading={prereqLoading}
      />
    </LandingPageShell>
  )
}
