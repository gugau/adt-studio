import { List, X } from "lucide-react"
import { useLingui } from "@lingui/react/macro"
import { Trans } from "@lingui/react/macro"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { usePrerequisiteChecks } from "@/hooks/use-prerequisite-checks"
import { useStageStatus } from "@/hooks/use-stage-status"
import { LandingPageShell } from "../../components/LandingPageShell"
import { RunProgress } from "../../components/RunProgress"
import { PrerequisiteWarnings } from "../../components/PrerequisiteWarnings"

// ─── Mock TOC preview (book page with floating TOC panel) ───────────────────

function TocPanelEntry({ title, page, bold, active }: { title: string; page?: string; bold?: boolean; active?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-[2px] ${active ? "text-amber-700" : ""}`}>
      <span className={`text-[6.5px] leading-[9px] ${bold ? "font-bold text-foreground" : "text-foreground/70"} ${active ? "text-amber-700" : ""}`}>
        {title}
      </span>
      {page && (
        <span className="text-[5.5px] text-foreground/30 tabular-nums shrink-0 ml-1.5">
          {page}
        </span>
      )}
    </div>
  )
}

function MockTocPreview() {
  /* eslint-disable lingui/no-unlocalized-strings */
  return (
    <div className="relative flex flex-1 min-h-0 overflow-hidden">
      {/* Book page background */}
      <div className="flex flex-1 min-h-0 bg-white">
        {/* Two-column book content */}
        <div className="flex flex-1 gap-4 px-6 py-6">
          {/* Left column */}
          <div className="flex-1 flex flex-col gap-2">
            <p className="text-center text-[13px] font-bold tracking-tight text-foreground">
              Lorem Ipsum
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Curabitur pretium tincidunt lacus. Nulla gravida orci a odio.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris. Integer in mauris eu nibh euismod gravida.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Duis ac tellus et risus vulputate vehicula. Donec lobortis risus a elit. Etiam tempor. Ut ullamcorper, ligula eu tempor congue, eros est euismod turpis.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Proin quam nisl, tincidunt et, mattis eget, convallis nec, purus. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Nulla posuere. Donec vitae dolor. Nullam tristique diam non turpis. Cras placerat accumsan nulla. Nullam rutrum. Nam vestibulum accumsan nisl.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Phasellus leo dolor, tempus non, auctor et, hendrerit quis, nisi. Curabitur ligula sapien, tincidunt non, euismod vitae, posuere imperdiet, leo.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Maecenas malesuada. Praesent congue erat at massa. Sed cursus turpis vitae tortor. Donec posuere vulputate arcu. Phasellus accumsan cursus velit.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae. Sed aliquam, nisi quis porttitor congue, elit erat euismod.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Proin pharetra nonummy pede. Mauris et orci.
            </p>
          </div>
          {/* Right column */}
          <div className="flex-1 flex flex-col gap-2">
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; In ac dui quis mi consectetuer lacinia. Nam pretium turpis et arcu.
            </p>
            <div className="w-full h-20 rounded bg-gradient-to-br from-orange-200 to-pink-200" />
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Duis arcu tortor, suscipit eget, imperdiet nec, imperdiet iaculis, ipsum. Sed aliquam ultrices mauris. Integer ante arcu, accumsan a, consectetuer eget.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Praesent blandit laoreet nibh. Fusce convallis metus id felis luctus adipiscing. Pellentesque egestas, neque sit amet convallis pulvinar, justo nulla.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Aenean dolor. Etiam vitae tortor. Morbi vestibulum volutpat enim. Fusce vel dui. Sed et libero. Proin quam. Etiam ultrices. Suspendisse in justo eu magna luctus suscipit.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Sed lectus. Integer euismod lacus luctus magna. Quisque cursus, metus vitae pharetra auctor, sem massa mattis sem, at interdum magna augue eget diam.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Vestibulum ullamcorper mauris at ligula. Fusce fermentum. Nullam cursus lacinia erat. Praesent nec nisl a purus blandit viverra. Praesent ac massa.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Aenean quam. In scelerisque sem at dolor. Maecenas mattis. Sed convallis tristique sem. Proin ut ligula vel nunc egestas porttitor. Morbi lectus risus.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Iaculis vitae, scelerisque nec, aliquam eget, urna. Nulla ut turpis. Curabitur a felis in nunc fringilla tristique. Morbi mattis ullamcorper velit.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Phasellus gravida semper nisi. Nullam vel sem. Pellentesque libero tortor, tincidunt et, tincidunt eget, semper nec, quam. Sed hendrerit. Morbi ac felis.
            </p>
            <p className="text-[9px] leading-[13px] text-foreground/70 text-justify">
              Nunc egestas, augue at pellentesque laoreet, felis eros vehicula leo, at malesuada velit leo quis pede. Donec interdum, metus et hendrerit aliquet.
            </p>
          </div>
        </div>
      </div>

      {/* Floating TOC panel */}
      <div className="absolute left-3 top-3 bottom-14 w-[35%] flex flex-col bg-white rounded-lg border border-[#e2e8f0] shadow-xl overflow-hidden">
        {/* Panel header */}
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#e5e5e5]">
          <span className="text-[8px] font-bold text-foreground">Table of Contents</span>
          <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center">
            <X className="w-2 h-2 text-foreground/50" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#e5e5e5]">
          <div className="flex-1 text-center py-1 text-[6.5px] font-semibold text-foreground border-b-2 border-foreground">
            Contents
          </div>
          <div className="flex-1 text-center py-1 text-[6.5px] text-foreground/40">
            Page list
          </div>
        </div>

        {/* Entries */}
        <div className="flex-1 overflow-hidden px-2.5 py-1.5 flex flex-col">
          <TocPanelEntry title="INTRODUCTION" bold active />
          <TocPanelEntry title="ABOUT THIS BOOK" bold />
          <div className="pl-2 flex flex-col">
            <TocPanelEntry title="How to use this book" page="4" />
            <TocPanelEntry title="Subjects covered" page="5" />
          </div>
          <TocPanelEntry title="CHAPTER 1" bold />
          <div className="pl-2 flex flex-col">
            <TocPanelEntry title="Cell Biology Basics" page="8" />
            <TocPanelEntry title="The Cell Membrane" page="12" />
            <TocPanelEntry title="Organelles" page="16" />
          </div>
          <TocPanelEntry title="CHAPTER 2" bold />
          <div className="pl-2 flex flex-col">
            <TocPanelEntry title="Energy Production" page="22" />
            <TocPanelEntry title="Mitochondria" page="25" />
          </div>
        </div>
      </div>

      {/* TOC button — bottom-left */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-blue-600 rounded-md px-2.5 py-1.5 shadow-md">
        <List className="w-3 h-3 text-white" />
        <span className="text-[8px] text-white font-semibold">TOC</span>
      </div>
    </div>
  )
  /* eslint-enable lingui/no-unlocalized-strings */
}

// ─── Main landing page ────────────────────────────────────────────────────────

export function TocLandingPage({
  bookLabel,
}: {
  bookLabel: string
}) {
  const { t } = useLingui()
  const { queueRun } = useBookRun()
  const { apiKey, hasApiKey } = useApiKey()
  const { storyboardReady, hasNoPages, allPagesPruned, canRun } = usePrerequisiteChecks(bookLabel)
  const { isRunning, isCompleted, hasError } = useStageStatus("toc")

  const handleRun = () => {
    if (!hasApiKey || isRunning || !canRun) return
    queueRun({ fromStage: "toc", toStage: "toc", apiKey })
  }

  return (
    <LandingPageShell
      bookLabel={bookLabel}
      stageSlug="toc"
      colorClass="bg-amber-600 hover:bg-amber-700"
      isRunning={isRunning}
      isCompleted={isCompleted}
      hasError={hasError}
      canRun={canRun}
      extraDisabled={!hasApiKey}
      runLabel={<Trans>Run TOC</Trans>}
      rerunLabel={<Trans>Re-run</Trans>}
      previewLabel={t`TOC Preview`}
      onRun={handleRun}
      preview={
        isRunning ? (
          <div className="flex flex-1 items-center justify-center">
            <RunProgress stepKey="toc-generation" spinnerColorClass="text-amber-600" />
          </div>
        ) : (
          <MockTocPreview />
        )
      }
    >
      {/* Title + description */}
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
          <Trans>Table of Contents</Trans>
        </h1>
        <p className="text-[14px] text-[#737373] leading-relaxed">
          <Trans>
            Automatically generate a structured table of contents from your
            book's content. The TOC provides navigation and helps readers
            find specific chapters and sections quickly.
          </Trans>
        </p>
      </div>

      <PrerequisiteWarnings
        storyboardReady={storyboardReady}
        hasNoPages={hasNoPages}
        allPagesPruned={allPagesPruned}
        stageName="a table of contents"
      />

      {/* Info banner */}
      <div className="rounded-xl bg-amber-50 px-5 py-4">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="shrink-0 rounded-full bg-amber-100 p-1.5">
            <List className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <span className="text-[13px] font-semibold text-amber-900">
            <Trans>Structured navigation</Trans>
          </span>
        </div>
        <p className="text-[12.5px] text-amber-800/80 leading-relaxed pl-[34px]">
          <Trans>
            A well-organized table of contents makes your book easier to navigate.
            It creates a hierarchical outline of chapters and sections that readers
            can use to jump directly to the content they need.
          </Trans>
        </p>
      </div>
    </LandingPageShell>
  )
}
