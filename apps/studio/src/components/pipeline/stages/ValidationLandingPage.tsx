import { ShieldCheck, CheckCircle2, AlertTriangle, XCircle } from "lucide-react"
import { useNavigate } from "@tanstack/react-router"
import { useLingui } from "@lingui/react/macro"
import { Trans } from "@lingui/react/macro"
import { usePrerequisiteChecks } from "@/hooks/use-prerequisite-checks"
import { LandingPageShell } from "../components/LandingPageShell"
import { PrerequisiteWarnings } from "../components/PrerequisiteWarnings"

// ─── Mock validation preview (accessibility report) ────────────────────────

function ValidationRow({
  kind,
  title,
  detail,
}: {
  kind: "pass" | "warn" | "fail"
  title: string
  detail: string
}) {
  const meta = {
    pass: { Icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
    warn: { Icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
    fail: { Icon: XCircle, color: "text-red-600", bg: "bg-red-50", border: "border-red-100" },
  }[kind]
  const { Icon } = meta
  return (
    <div className={`flex gap-2 rounded-md border ${meta.border} ${meta.bg} px-2 py-1.5`}>
      <Icon className={`shrink-0 mt-[1px] w-3 h-3 ${meta.color}`} />
      <div className="flex flex-col gap-[1px] min-w-0">
        <span className="text-[8px] font-semibold text-foreground leading-tight">{title}</span>
        <span className="text-[7px] text-foreground/60 leading-tight">{detail}</span>
      </div>
    </div>
  )
}

function MockValidationPreview() {
  /* eslint-disable lingui/no-unlocalized-strings */
  return (
    <div className="relative flex flex-1 min-h-0 overflow-hidden bg-gradient-to-br from-emerald-50/60 via-white to-emerald-50/30">
      <div className="flex flex-1 flex-col gap-3 px-5 py-5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 shrink-0 pb-2 border-b border-emerald-200">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-foreground">Accessibility Report</p>
            <p className="text-[7px] text-foreground/50">WCAG 2.1 AA · checked 2m ago</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
              <span className="text-[8px] font-semibold text-emerald-700">24</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
              <span className="text-[8px] font-semibold text-amber-700">3</span>
            </div>
            <div className="flex items-center gap-1">
              <XCircle className="w-2.5 h-2.5 text-red-600" />
              <span className="text-[8px] font-semibold text-red-700">1</span>
            </div>
          </div>
        </div>

        {/* Score card */}
        <div className="rounded-lg bg-emerald-600 text-white p-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/15 shadow-inner">
              <span className="text-[18px] font-bold tabular-nums">86</span>
            </div>
            <div className="flex-1">
              <p className="text-[9.5px] font-semibold opacity-95">Accessibility Score</p>
              <p className="text-[7px] opacity-80 leading-tight">
                Overall health is good. 1 blocking issue remains — fix before publishing.
              </p>
            </div>
          </div>
        </div>

        {/* Findings list */}
        <div className="flex flex-col gap-1.5 overflow-hidden">
          <ValidationRow
            kind="fail"
            title="Missing alt text on 2 images"
            detail="Page 14, 22 — every image must have a descriptive alt attribute."
          />
          <ValidationRow
            kind="warn"
            title="Low contrast on captions"
            detail="Page 8 — caption color fails AA contrast (3.8:1 vs required 4.5:1)."
          />
          <ValidationRow
            kind="warn"
            title="Heading levels skip"
            detail="Chapter 3 jumps from h2 to h4 — use sequential heading levels."
          />
          <ValidationRow
            kind="pass"
            title="Semantic landmarks present"
            detail="Nav, main, and footer landmarks detected on every page."
          />
          <ValidationRow
            kind="pass"
            title="Audio tracks synced"
            detail="Speech narration aligns with sentence boundaries across the book."
          />
        </div>
      </div>
    </div>
  )
  /* eslint-enable lingui/no-unlocalized-strings */
}

// ─── Main landing page ────────────────────────────────────────────────────────

export function ValidationLandingPage({
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
      stageSlug="validation"
      colorClass="bg-emerald-600 hover:bg-emerald-700"
      isRunning={false}
      isCompleted={false}
      hasError={false}
      canRun={true}
      runLabel={<Trans>Go to Storyboard</Trans>}
      rerunLabel={<Trans>Go to Storyboard</Trans>}
      previewLabel={t`Validation Preview`}
      onRun={handleGoToStoryboard}
      preview={<MockValidationPreview />}
    >
      {/* Title + description */}
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
          <Trans>Validation</Trans>
        </h1>
        <p className="text-[14px] text-[#737373] leading-relaxed">
          <Trans>
            Whole-book accessibility and reviewer checks on the packaged ADT.
            Validation surfaces missing alt text, contrast issues, heading
            structure problems, and other issues before the book reaches
            readers — automatically, once the storyboard is built.
          </Trans>
        </p>
      </div>

      <PrerequisiteWarnings
        storyboardReady={storyboardReady}
        hasNoPages={hasNoPages}
        allPagesPruned={allPagesPruned}
        stageName="validation"
        isLoading={prereqLoading}
      />
    </LandingPageShell>
  )
}
