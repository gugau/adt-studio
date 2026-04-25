import { FileDown, Package, BookOpen, GraduationCap, Globe } from "lucide-react"
import { useNavigate } from "@tanstack/react-router"
import { useLingui } from "@lingui/react/macro"
import { Trans } from "@lingui/react/macro"
import { usePrerequisiteChecks } from "@/hooks/use-prerequisite-checks"
import { LandingPageShell } from "../../components/LandingPageShell"
import { PrerequisiteWarnings } from "../../components/PrerequisiteWarnings"

// ─── Mock export preview (download cards) ──────────────────────────────────

function ExportFormatCard({
  Icon,
  name,
  ext,
  description,
  size,
  featured,
}: {
  Icon: typeof FileDown
  name: string
  ext: string
  description: string
  size: string
  featured?: boolean
}) {
  /* eslint-disable lingui/no-unlocalized-strings */
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border p-3 transition-all ${
        featured
          ? "border-indigo-300 bg-indigo-50/60 shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
          : "border-gray-200 bg-white shadow-sm"
      }`}
    >
      <div className="flex items-start gap-2">
        <div
          className={`flex items-center justify-center w-7 h-7 rounded-md shrink-0 ${
            featured ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700"
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold text-foreground">{name}</span>
            <span className="text-[6.5px] font-mono text-foreground/50 uppercase tracking-wider">{ext}</span>
          </div>
          <p className="text-[7px] text-foreground/60 leading-tight mt-0.5">{description}</p>
        </div>
      </div>
      <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
        <span className="text-[7px] text-foreground/50 tabular-nums">{size}</span>
        <div
          className={`flex items-center gap-1 rounded px-2 py-1 text-[7px] font-semibold transition-colors ${
            featured
              ? "bg-indigo-600 text-white"
              : "bg-gray-100 text-foreground"
          }`}
        >
          <FileDown className="w-2.5 h-2.5" />
          Download
        </div>
      </div>
    </div>
  )
  /* eslint-enable lingui/no-unlocalized-strings */
}

function MockExportPreview() {
  /* eslint-disable lingui/no-unlocalized-strings */
  return (
    <div className="relative flex flex-1 min-h-0 overflow-hidden bg-gradient-to-br from-indigo-50/40 via-white to-indigo-50/20">
      <div className="flex flex-1 flex-col gap-3 px-5 py-5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 shrink-0 pb-2 border-b border-indigo-200">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100">
            <Package className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-foreground">The Cell and Its Wonders</p>
            <p className="text-[7px] text-foreground/50">Ready to export · 48 pages · 6 chapters</p>
          </div>
          <div className="ml-auto flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[7px] font-semibold text-emerald-700">Validated</span>
          </div>
        </div>

        {/* Export format cards */}
        <div className="flex flex-col gap-2 overflow-hidden">
          <ExportFormatCard
            Icon={BookOpen}
            name="ADT Bundle"
            ext=".adt"
            description="Native format — full metadata, all media, round-trippable back into the studio."
            size="18.4 MB"
            featured
          />
          <ExportFormatCard
            Icon={GraduationCap}
            name="SCORM Package"
            ext=".zip"
            description="LMS-compatible bundle for Moodle, Canvas, and other SCORM 1.2/2004 platforms."
            size="19.1 MB"
          />
          <ExportFormatCard
            Icon={Globe}
            name="WebPub"
            ext=".zip"
            description="Open web-publishing manifest — host anywhere as a standalone reader."
            size="17.8 MB"
          />
        </div>
      </div>
    </div>
  )
  /* eslint-enable lingui/no-unlocalized-strings */
}

// ─── Main landing page ────────────────────────────────────────────────────────

export function ExportLandingPage({
  bookLabel,
}: {
  bookLabel: string
}) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const { storyboardReady, hasNoPages, allPagesPruned, canRun, isLoading: prereqLoading } = usePrerequisiteChecks(bookLabel)

  const handleOpen = () => {
    void navigate({
      to: "/books/$label/$step",
      params: { label: bookLabel, step: "export" },
    })
  }

  return (
    <LandingPageShell
      bookLabel={bookLabel}
      stageSlug="export"
      colorClass="bg-indigo-700 hover:bg-indigo-800"
      isRunning={false}
      isCompleted={false}
      hasError={false}
      canRun={canRun}
      runLabel={<Trans>Go to Export</Trans>}
      rerunLabel={<Trans>Go to Export</Trans>}
      previewLabel={t`Export Preview`}
      onRun={handleOpen}
      preview={<MockExportPreview />}
    >
      {/* Title + description */}
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
          <Trans>Export</Trans>
        </h1>
        <p className="text-[14px] text-[#737373] leading-relaxed">
          <Trans>
            Package the finished book into shippable artifacts. Export produces
            the native ADT bundle, a SCORM package for LMS platforms, and a
            WebPub manifest for direct web hosting.
          </Trans>
        </p>
      </div>

      <PrerequisiteWarnings
        storyboardReady={storyboardReady}
        hasNoPages={hasNoPages}
        allPagesPruned={allPagesPruned}
        stageName="exports"
        isLoading={prereqLoading}
      />

      {/* Info banner */}
      <div className="rounded-xl bg-indigo-50 px-5 py-4">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="shrink-0 rounded-full bg-indigo-100 p-1.5">
            <Package className="w-3.5 h-3.5 text-indigo-700" />
          </div>
          <span className="text-[13px] font-semibold text-indigo-900">
            <Trans>Three formats, one source</Trans>
          </span>
        </div>
        <p className="text-[12.5px] text-indigo-800/80 leading-relaxed pl-[34px]">
          <Trans>
            ADT for round-tripping back into the studio, SCORM for LMS
            platforms, WebPub for static hosting.
          </Trans>
        </p>
      </div>
    </LandingPageShell>
  )
}
