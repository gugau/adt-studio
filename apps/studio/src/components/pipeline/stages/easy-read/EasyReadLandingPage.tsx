import { Trans, useLingui } from "@lingui/react/macro"
import { LandingPageShell } from "@/components/pipeline/components/LandingPageShell"
import { PrereqGuard } from "@/components/pipeline/components/PrereqGuard"
import { useStageStatus } from "@/hooks/use-stage-status"
import { useRunEasyRead } from "./use-run-easy-read"

export function EasyReadLandingPage({ bookLabel }: { bookLabel: string }) {
  const { t } = useLingui()
  const { runEasyRead, hasApiKey } = useRunEasyRead(bookLabel)
  const status = useStageStatus("easy-read")
  const storyboardReady = useStageStatus("storyboard").isCompleted

  const disabledReason = !hasApiKey ? (
    <Trans>Add an API key in Book settings to generate Easy Read content.</Trans>
  ) : !storyboardReady ? (
    <Trans>Run Storyboard first — Easy Read simplifies the text it places on each page.</Trans>
  ) : undefined

  return (
    <LandingPageShell
      bookLabel={bookLabel}
      stageSlug="easy-read"
      settingsTab="general"
      colorClass="bg-cyan-600 hover:bg-cyan-700"
      accentColor="#0891b2"
      accentColorSoft="#cffafe"
      isRunning={status.isRunning}
      isCompleted={status.isCompleted}
      hasError={status.hasError}
      canRun={true}
      extraDisabled={!hasApiKey || !storyboardReady}
      disabledReason={disabledReason}
      runLabel={<Trans>Run Easy Read</Trans>}
      rerunLabel={<Trans>Re-run</Trans>}
      previewLabel={t`Easy Read Preview`}
      onRun={() => void runEasyRead()}
      preview={<EasyReadPreview />}
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
          <Trans>Easy Read</Trans>
        </h1>
        <p className="text-[14px] text-[#737373] leading-relaxed">
          <Trans>
            Generate a simplified, easier-to-read version of every text block in
            the book. Readers turn it on with the Easy Read toggle in the ADT;
            you can review and edit each simplified block before packaging.
          </Trans>
        </p>
      </div>

      <PrereqGuard
        upstreamSlug="storyboard"
        stageSlug="easy-read"
        description={
          <Trans>
            Easy Read adapts the text placed on each page by Storyboard. Finish
            Storyboard before running this stage.
          </Trans>
        }
      />

      <p className="text-[13px] text-[#737373] leading-relaxed">
        <Trans>
          Tune how text is simplified in the Easy Read Prompt settings. After
          running, each block becomes editable here in the Easy Read step.
        </Trans>
      </p>
    </LandingPageShell>
  )
}

/** Static illustrative preview: original text on top, simplified below. */
function EasyReadPreview() {
  return (
    <div className="flex h-full flex-col gap-3 p-5 text-left">
      <div className="rounded-md border border-[#e5e5e5] bg-[#fafafa] p-3">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[#a3a3a3]">
          <Trans>Original</Trans>
        </p>
        <p className="text-[12px] leading-relaxed text-[#525252]">
          <Trans>
            Despite the inclement weather, the expedition pressed on toward the
            summit, undeterred by the mounting obstacles in their path.
          </Trans>
        </p>
      </div>
      <div className="rounded-md border border-cyan-200 bg-cyan-50 p-3">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-cyan-700">
          <Trans>Easy Read</Trans>
        </p>
        <div className="flex flex-col gap-1 text-[13px] leading-relaxed text-[#0a0a0a]">
          <span><Trans>The weather was very bad.</Trans></span>
          <span><Trans>But the team kept walking up the mountain.</Trans></span>
          <span><Trans>They did not give up.</Trans></span>
        </div>
      </div>
    </div>
  )
}
