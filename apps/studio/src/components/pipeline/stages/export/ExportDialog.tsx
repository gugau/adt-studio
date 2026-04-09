import type { ReactNode } from "react"
import {
  Loader2, BookOpen, AlertCircle, Image, List, Hand, AudioLines, Check,
  type LucideIcon,
} from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useBook } from "@/hooks/use-books"
import { usePages, usePageImage } from "@/hooks/use-pages"
import { useAvailableExportFeatures, useAllProjectFeatures, type ExportFeatureToggles } from "@/hooks/use-export-features"
import { buildExportFormatConfig, type FormatConfig, type ExportFormat } from "./export-formats"

// ─── Book Cover Panel ────────────────────────────────────────────────────────

function BookCover({ bookLabel, formatConfig }: { bookLabel: string; formatConfig?: FormatConfig }) {
  const { t } = useLingui()
  const { data: book } = useBook(bookLabel)
  const { data: pages } = usePages(bookLabel)
  const coverPageNumber = book?.metadata?.cover_page_number ?? 1
  const coverPage = pages?.find((p) => p.pageNumber === coverPageNumber)
  const { data: coverImage } = usePageImage(bookLabel, coverPage?.pageId ?? "")

  const title = book?.metadata?.title ?? book?.title ?? bookLabel
  const authors = book?.metadata?.authors?.join(", ")
  const FormatIcon = formatConfig?.icon

  return (
    <div className="w-72 flex-shrink-0 flex flex-col overflow-hidden border-r border-slate-200 justify-center gap-4">
      {/* Image area — natural proportions, centered */}
      <div className="flex-1 flex items-center justify-center p-5 min-h-0">
        {coverImage ? (
          <img
            src={`data:image/png;base64,${coverImage.imageBase64}`}
            alt={t`Cover of ${title}`}
            className="max-w-full max-h-full object-contain shadow-2xl rounded-sm"
          />
        ) : (
          <div className="flex items-center justify-center opacity-20">
            {FormatIcon
              ? <FormatIcon className={`w-12 h-12 ${formatConfig?.textColor ?? "text-slate-300"}`} />
              : <BookOpen className="w-12 h-12 text-slate-300" />
            }
          </div>
        )}
      </div>

      {/* Book info at bottom — light colors from format */}
      <div className={`px-4 pb-5 pt-8 space-y-1.5 ${formatConfig ? `${formatConfig.bgLight} border-t ${formatConfig.borderColor}` : "bg-slate-50 border-t border-slate-200"}`}>
        {formatConfig && (
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${formatConfig.bgLight} ${formatConfig.textColor} ${formatConfig.borderColor}`}>
            {FormatIcon && <FormatIcon className="w-3 h-3" />}
            {formatConfig.label}
            {formatConfig.badge && <span className="opacity-60">· {formatConfig.badge}</span>}
          </span>
        )}
        <p className={`font-semibold text-sm leading-snug line-clamp-2 ${formatConfig?.textColor || "text-slate-900"}`}>{title}</p>
        {authors && <p className="text-slate-600 text-xs leading-tight line-clamp-1">{authors}</p>}
      </div>
    </div>
  )
}

// ─── Feature Toggle Row ──────────────────────────────────────────────────────

function FeatureToggleRow({ icon: Icon, label, description, textColor, bgLight, borderColor, checked, onCheckedChange, disabled, badge }: {
  icon: LucideIcon
  label: ReactNode
  description: ReactNode
  textColor: string
  bgLight: string
  borderColor: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
  badge?: ReactNode
}) {
  return (
    <label className="flex items-center gap-3 p-3 rounded-lg border border-transparent hover:border-slate-200 hover:bg-slate-50/80 transition-all duration-150 cursor-pointer">
      <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${bgLight} ${borderColor} border`}>
        <Icon className={`w-4 h-4 ${textColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900">{label}</span>
          {badge}
        </div>
        <p className="text-xs text-slate-500 mt-0.5 leading-tight">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} className="flex-shrink-0" />
    </label>
  )
}

// ─── Accessibility Row ───────────────────────────────────────────────────────

function AccessibilityRow({ icon: Icon, label, doneDescription, missingAction, textColor, bgLight, borderColor, done }: {
  icon: LucideIcon
  label: ReactNode
  doneDescription: ReactNode
  missingAction: ReactNode
  textColor: string
  bgLight: string
  borderColor: string
  done: boolean
}) {
  if (done) {
    return (
      <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${bgLight} ${borderColor}`}>
        <Icon className={`w-3.5 h-3.5 ${textColor} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-slate-700">{label}</span>
          <span className="text-xs text-slate-500"> — {doneDescription}</span>
        </div>
        <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
      <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-amber-900">{label}</span>
        <p className="text-xs text-amber-700 mt-0.5 leading-snug">{missingAction}</p>
      </div>
    </div>
  )
}

// ─── Export Dialog Component ─────────────────────────────────────────────────

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedFormat: ExportFormat | null
  bookLabel: string
  featureToggles: ExportFeatureToggles
  onFeatureToggleChange: (feature: keyof ExportFeatureToggles, value: boolean) => void
  onConfirmExport: () => void
  isPreparing: boolean
  preparingFormat: string | null
  error: { format: string; message: string } | null
}

export function ExportDialog({
  open,
  onOpenChange,
  selectedFormat,
  bookLabel,
  featureToggles,
  onFeatureToggleChange,
  onConfirmExport,
  isPreparing,
  preparingFormat,
  error,
}: ExportDialogProps) {
  const { t } = useLingui()
  const availableFeatures = useAvailableExportFeatures()
  const allFeatures = useAllProjectFeatures()
  const formatConfigByType = buildExportFormatConfig(t)

  const formatError = selectedFormat && error?.format === selectedFormat ? error.message : null
  const formatConfig = selectedFormat ? formatConfigByType[selectedFormat] : null
  const FormatIcon = formatConfig?.icon

  // Accessibility items — ordered by impact
  const accessibilityItems = [
    {
      icon: Image,
      label: <Trans>Image Captions</Trans>,
      doneDescription: <Trans>All images have text descriptions</Trans>,
      missingAction: <Trans>Run the Image Captions stage to describe all images for screen readers (WCAG 1.1.1)</Trans>,
      textColor: "text-teal-600",
      bgLight: "bg-teal-50",
      borderColor: "border-teal-200",
      done: allFeatures.present.captions,
    },
    {
      icon: List,
      label: <Trans>Table of Contents</Trans>,
      doneDescription: <Trans>Structured navigation is included</Trans>,
      missingAction: <Trans>Run the Table of Contents stage to add navigation between sections (WCAG 2.4.5)</Trans>,
      textColor: "text-amber-600",
      bgLight: "bg-amber-50",
      borderColor: "border-amber-200",
      done: allFeatures.present.toc,
    },
    {
      icon: Hand,
      label: <Trans>Sign Language</Trans>,
      doneDescription: <Trans>Sign language videos are assigned to sections</Trans>,
      missingAction: <Trans>Upload sign language videos in the Sign Language stage for deaf and hard of hearing users (WCAG 1.2.6)</Trans>,
      textColor: "text-cyan-600",
      bgLight: "bg-cyan-50",
      borderColor: "border-cyan-200",
      done: false, // hardcoded until sign language video detection is implemented
    },
  ]

  const doneCount = accessibilityItems.filter((i) => i.done).length
  const totalCount = accessibilityItems.length
  const isFullyAccessible = doneCount === totalCount

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-4xl overflow-hidden sm:rounded-xl">
        <DialogTitle className="sr-only"><Trans>Export Options</Trans></DialogTitle>
        <DialogDescription className="sr-only"><Trans>Configure features to include in the export</Trans></DialogDescription>

        <div className="flex h-[560px]">
          {/* Left — book cover */}
          {selectedFormat && (
            <BookCover bookLabel={bookLabel} formatConfig={formatConfigByType[selectedFormat]} />
          )}

          {/* Right — options */}
          <div className="flex-1 flex flex-col min-w-0 bg-white">
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                {FormatIcon && formatConfig && (
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${formatConfig.bgLight} border ${formatConfig.borderColor}`}>
                    <FormatIcon className={`w-4 h-4 ${formatConfig.textColor}`} />
                  </div>
                )}
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    {formatConfig?.label ?? <Trans>Export Options</Trans>}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {selectedFormat === "project"
                      ? <Trans>Download a full backup of this project</Trans>
                      : <Trans>Choose features to include in this export</Trans>}
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {/* Project — description + what's included */}
              {selectedFormat === "project" && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    <Trans>Creates a ZIP archive of the full project — database, source PDF, and all pipeline outputs. Use it to back up or transfer the project to another machine.</Trans>
                  </p>
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <Trans>What's included</Trans>
                    </h4>
                    <div className="space-y-1.5">
                      {[
                        { icon: BookOpen, label: <Trans>Glossary</Trans>, textColor: "text-lime-600", bgLight: "bg-lime-50", borderColor: "border-lime-200", done: allFeatures.toggleable.glossary },
                        { icon: AudioLines, label: <Trans>Speech</Trans>, textColor: "text-rose-600", bgLight: "bg-rose-50", borderColor: "border-rose-200", done: allFeatures.toggleable.readAloud },
                        { icon: AlertCircle, label: <Trans>Quizzes</Trans>, textColor: "text-orange-600", bgLight: "bg-orange-50", borderColor: "border-orange-200", done: allFeatures.toggleable.quizzes },
                        { icon: Image, label: <Trans>Image Captions</Trans>, textColor: "text-teal-600", bgLight: "bg-teal-50", borderColor: "border-teal-200", done: allFeatures.present.captions },
                        { icon: List, label: <Trans>Table of Contents</Trans>, textColor: "text-amber-600", bgLight: "bg-amber-50", borderColor: "border-amber-200", done: allFeatures.present.toc },
                      ].map((item, i) => {
                        const Icon = item.icon
                        return (
                          <div key={i} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${item.done ? `${item.bgLight} ${item.borderColor}` : "bg-slate-50 border-slate-200"}`}>
                            <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${item.done ? item.textColor : "text-slate-300"}`} />
                            <span className={`text-xs font-medium flex-1 ${item.done ? "text-slate-700" : "text-slate-400"}`}>{item.label}</span>
                            {item.done
                              ? <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                              : <span className="text-[10px] text-slate-400"><Trans>Not generated</Trans></span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Non-project — feature toggles */}
              {selectedFormat !== "project" && (availableFeatures.glossary || availableFeatures.readAloud || availableFeatures.quizzes) && (
                <div className="space-y-2">
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <Trans>Optional Features</Trans>
                  </h4>
                  <div className="space-y-1">
                    {availableFeatures.glossary && (
                      <FeatureToggleRow
                        icon={BookOpen}
                        label={<Trans>Glossary</Trans>}
                        description={<Trans>Lookup definitions for key terms</Trans>}
                        textColor="text-lime-600"
                        bgLight="bg-lime-50"
                        borderColor="border-lime-200"
                        checked={featureToggles.glossary}
                        onCheckedChange={(v) => onFeatureToggleChange("glossary", v)}
                        disabled={isPreparing}
                      />
                    )}
                    {availableFeatures.readAloud && (
                      <FeatureToggleRow
                        icon={AudioLines}
                        label={<Trans>Speech</Trans>}
                        description={<Trans>Audio narration (largest impact on file size)</Trans>}
                        textColor="text-rose-600"
                        bgLight="bg-rose-50"
                        borderColor="border-rose-200"
                        checked={featureToggles.readAloud}
                        // eslint-disable-next-line lingui/no-unlocalized-strings
                        onCheckedChange={(v) => onFeatureToggleChange("readAloud", v)}
                        disabled={isPreparing}
                        badge={
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
                            <Trans>Large</Trans>
                          </span>
                        }
                      />
                    )}
                    {availableFeatures.quizzes && (
                      <FeatureToggleRow
                        icon={AlertCircle}
                        label={<Trans>Quizzes</Trans>}
                        description={<Trans>Interactive assessment questions</Trans>}
                        textColor="text-orange-600"
                        bgLight="bg-orange-50"
                        borderColor="border-orange-200"
                        checked={featureToggles.quizzes}
                        onCheckedChange={(v) => onFeatureToggleChange("quizzes", v)}
                        disabled={isPreparing}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Non-project — accessibility checklist */}
              {selectedFormat !== "project" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <Trans>Accessibility</Trans>
                    </h4>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      isFullyAccessible
                        ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                        : "text-amber-700 bg-amber-50 border-amber-200"
                    }`}>
                      {doneCount}/{totalCount}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {accessibilityItems.map((item, i) => (
                      <AccessibilityRow key={i} {...item} />
                    ))}
                  </div>
                </div>
              )}

              {/* Export error */}
              {formatError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p className="text-xs leading-tight">{formatError}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isPreparing}>
                <Trans>Cancel</Trans>
              </Button>
              <Button
                size="sm"
                className={formatConfig?.buttonClass ?? ""}
                onClick={onConfirmExport}
                disabled={isPreparing}
              >
                {isPreparing && preparingFormat === selectedFormat
                  ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  : FormatIcon && <FormatIcon className="mr-1.5 h-3.5 w-3.5" />
                }
                {formatError ? <Trans>Retry Export</Trans> : <Trans>Export</Trans>}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
