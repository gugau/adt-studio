import { LayoutGrid, Image as ImageIcon, TriangleAlert } from "lucide-react"
import { useLingui } from "@lingui/react/macro"
import { Trans } from "@lingui/react/macro"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { useStageStatus } from "@/hooks/use-stage-status"
import { LandingPageShell } from "../../components/LandingPageShell"
import { RunProgress } from "../../components/RunProgress"

// ─── Mock storyboard preview (page grid with sections) ─────────────────────

type SectionKind = "heading" | "text" | "image" | "short"

function StoryboardSection({ kind }: { kind: SectionKind }) {
  if (kind === "heading") {
    return <div className="h-[6px] w-2/3 rounded-sm bg-violet-600" />
  }
  if (kind === "image") {
    return (
      <div className="flex items-center justify-center h-8 rounded-sm bg-gradient-to-br from-violet-100 via-purple-100 to-fuchsia-100 border border-violet-200/60">
        <ImageIcon className="w-3 h-3 text-violet-500/60" />
      </div>
    )
  }
  if (kind === "short") {
    return (
      <div className="flex flex-col gap-[2px]">
        <div className="h-[3px] w-full rounded-sm bg-violet-200" />
        <div className="h-[3px] w-4/5 rounded-sm bg-violet-200" />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-[2px]">
      <div className="h-[3px] w-full rounded-sm bg-violet-200" />
      <div className="h-[3px] w-full rounded-sm bg-violet-200" />
      <div className="h-[3px] w-[90%] rounded-sm bg-violet-200" />
      <div className="h-[3px] w-3/4 rounded-sm bg-violet-200" />
    </div>
  )
}

function StoryboardPage({
  page,
  sections,
  active,
}: {
  page: number
  sections: SectionKind[]
  active?: boolean
}) {
  /* eslint-disable lingui/no-unlocalized-strings */
  return (
    <div
      className={`relative flex flex-col gap-1.5 rounded-md bg-white p-2 transition-all ${
        active
          ? "border-2 border-violet-500 shadow-[0_0_0_3px_rgba(139,92,246,0.15)]"
          : "border border-violet-200/70 shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[6px] font-semibold text-violet-700 uppercase tracking-wider">
          Page {page}
        </span>
        <span className="text-[6px] text-violet-400 tabular-nums">
          {sections.length} {sections.length === 1 ? "section" : "sections"}
        </span>
      </div>
      <div className="flex flex-col gap-1 flex-1">
        {sections.map((kind, idx) => (
          <StoryboardSection key={idx} kind={kind} />
        ))}
      </div>
    </div>
  )
  /* eslint-enable lingui/no-unlocalized-strings */
}

function MockStoryboardPreview() {
  /* eslint-disable lingui/no-unlocalized-strings */
  const pages: { page: number; sections: SectionKind[]; active?: boolean }[] = [
    { page: 1, sections: ["heading", "text", "image"] },
    { page: 2, sections: ["text", "image", "short"] },
    { page: 3, sections: ["heading", "text", "text"], active: true },
    { page: 4, sections: ["image", "text", "short"] },
    { page: 5, sections: ["text", "short", "image"] },
    { page: 6, sections: ["heading", "text"] },
    { page: 7, sections: ["image", "text", "text"] },
    { page: 8, sections: ["text", "image"] },
    { page: 9, sections: ["heading", "text", "image", "short"] },
  ]
  const totalSections = pages.reduce((sum, p) => sum + p.sections.length, 0)

  return (
    <div className="relative flex flex-1 min-h-0 overflow-hidden bg-gradient-to-br from-violet-50/60 via-white to-violet-50/30">
      <div className="flex flex-1 flex-col gap-2 px-4 py-4 overflow-hidden">
        <div className="flex items-center gap-1.5 shrink-0">
          <LayoutGrid className="w-3 h-3 text-violet-600" />
          <span className="text-[8px] font-semibold text-violet-800 uppercase tracking-wider">
            Storyboard Overview
          </span>
          <span className="ml-auto text-[7px] text-violet-500 tabular-nums">
            {pages.length} pages · {totalSections} sections
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 flex-1 min-h-0">
          {pages.map((p) => (
            <StoryboardPage key={p.page} page={p.page} sections={p.sections} active={p.active} />
          ))}
        </div>
      </div>
    </div>
  )
  /* eslint-enable lingui/no-unlocalized-strings */
}

// ─── Main landing page ────────────────────────────────────────────────────────

export function StoryboardLandingPage({
  bookLabel,
}: {
  bookLabel: string
}) {
  const { t } = useLingui()
  const { queueRun, stageState } = useBookRun()
  const { apiKey, hasApiKey } = useApiKey()
  const { isRunning, isCompleted, hasError } = useStageStatus("storyboard")
  const extractDone = stageState("extract") === "done"

  const handleRun = () => {
    if (!hasApiKey || isRunning || !extractDone) return
    queueRun({ fromStage: "storyboard", toStage: "storyboard", apiKey })
  }

  return (
    <LandingPageShell
      bookLabel={bookLabel}
      stageSlug="storyboard"
      colorClass="bg-violet-600 hover:bg-violet-700"
      isRunning={isRunning}
      isCompleted={isCompleted}
      hasError={hasError}
      canRun={extractDone}
      extraDisabled={!hasApiKey}
      runLabel={<Trans>Run Storyboard</Trans>}
      rerunLabel={<Trans>Re-run</Trans>}
      previewLabel={t`Storyboard Preview`}
      onRun={handleRun}
      preview={
        isRunning ? (
          <div className="flex flex-1 items-center justify-center">
            <RunProgress stepKey="page-sectioning" spinnerColorClass="text-violet-500" />
          </div>
        ) : (
          <MockStoryboardPreview />
        )
      }
    >
      {/* Title + description */}
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
          <Trans>Storyboard</Trans>
        </h1>
        <p className="text-[14px] text-[#737373] leading-relaxed">
          <Trans>
            Arrange extracted content into structured pages. The storyboard
            groups text and images into sections and decides how each page of
            the final book will be laid out.
          </Trans>
        </p>
      </div>

      {!extractDone && (
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <TriangleAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium text-amber-800">
              <Trans>Extract not ready</Trans>
            </span>
            <span className="text-[12px] text-amber-700 leading-relaxed">
              <Trans>
                The Extract stage must finish before the storyboard can be
                built. Run Extract first.
              </Trans>
            </span>
          </div>
        </div>
      )}

      {/* Info banner */}
      <div className="rounded-xl bg-violet-50 px-5 py-4">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="shrink-0 rounded-full bg-violet-100 p-1.5">
            <LayoutGrid className="w-3.5 h-3.5 text-violet-600" />
          </div>
          <span className="text-[13px] font-semibold text-violet-900">
            <Trans>Re-running rebuilds downstream work</Trans>
          </span>
        </div>
        <p className="text-[12.5px] text-violet-800/80 leading-relaxed pl-[34px]">
          <Trans>
            Quizzes, glossary, translation, and speech all operate on the
            sections defined here.
          </Trans>
        </p>
      </div>
    </LandingPageShell>
  )
}
