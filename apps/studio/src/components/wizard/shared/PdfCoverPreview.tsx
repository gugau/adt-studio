import { Loader2, BookOpen } from "lucide-react"
import { msg } from "@lingui/core/macro"
import { useLingui } from "@lingui/react"
import { Trans } from "@lingui/react/macro"
import { cn } from "@/lib/utils"
import {
  getPreviewPageLabel,
  usePdfPreviewPages,
} from "@/components/wizard/shared/usePdfPreviewPages"
import { PreviewShell } from "@/components/wizard/shared/PreviewShell"

interface PdfCoverPreviewProps {
  file?: File | null
  width: number
  height: number
}

const BOOK_PREVIEW_LABEL = msg`Book preview`
const pdfPagePreviewMsg = msg`PDF page {pageLabel} preview`

function PdfCoverPlaceholder({ label }: { label: string }) {
  return (
    <PreviewShell label={label}>
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-6 px-6 py-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-border bg-white text-muted-foreground">
          <BookOpen className="h-7 w-7" />
        </div>
        <div className="max-w-[280px] text-center">
          <p className="text-base font-semibold text-foreground">
            <Trans>Book preview</Trans>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            <Trans>Upload a PDF to preview its pages here.</Trans>
          </p>
        </div>
      </div>
    </PreviewShell>
  )
}

function PdfCoverCanvas({ file, width, height, label }: { file: File; width: number; height: number; label: string }) {
  const { i18n } = useLingui()
  const { pages, pageLabels, isLoading } = usePdfPreviewPages({
    file,
    mode: "all",
    width,
    height,
  })
  const ready = !isLoading && pages.length > 0

  return (
    <PreviewShell label={label} bodyClassName="relative overflow-y-auto">
      {!ready && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#f0f0f0]"
          aria-hidden
        >
          <Loader2 className="h-8 w-8 animate-spin text-[#737373]" aria-hidden />
          <span className="sr-only">
            <Trans>Loading preview</Trans>
          </span>
        </div>
      )}
      <div
        className={cn(
          "flex flex-col gap-3 p-3 transition-opacity duration-500",
          ready ? "opacity-100" : "opacity-0",
        )}
      >
        {pages.map((dataUrl, index) => {
          const pageLabel = getPreviewPageLabel(pageLabels, index)
          return (
            <div key={index} className="relative scroll-mt-3">
              <img
                src={dataUrl}
                alt={i18n._(
                  pdfPagePreviewMsg.id,
                  { pageLabel },
                  { message: pdfPagePreviewMsg.message },
                )}
                className="h-auto w-full rounded-md border border-[#e5e5e5] bg-white shadow-sm"
              />
              <div className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-md border border-border/70 bg-background/90 px-2 py-1 text-[11px] font-semibold tabular-nums text-foreground shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-background/75">
                {pageLabel}
              </div>
            </div>
          )
        })}
      </div>
    </PreviewShell>
  )
}

export function PdfCoverPreview({ file, width, height }: PdfCoverPreviewProps) {
  const { i18n } = useLingui()
  const label = i18n._(BOOK_PREVIEW_LABEL)
  if (!file) return <PdfCoverPlaceholder label={label} />
  return <PdfCoverCanvas file={file} width={width} height={height} label={label} />
}
