import { Loader2, BookOpen } from "lucide-react"
import { msg } from "@lingui/core/macro"
import { useLingui } from "@lingui/react"
import { Trans } from "@lingui/react/macro"
import { cn } from "@/lib/utils"
import {
  getPreviewPageLabel,
  usePdfPreviewPages,
} from "@/components/wizard/shared/usePdfPreviewPages"

interface PdfCoverPreviewProps {
  file?: File | null
  width: number
  height: number
}

function PdfCoverPlaceholder() {
  return (
    <div className="@container flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md bg-white shadow-[0px_17px_38px_0px_rgba(0,0,0,0.1),0px_69px_69px_0px_rgba(0,0,0,0.09),0px_155px_93px_0px_rgba(0,0,0,0.05)]">
      <div className="shrink-0 border-b border-border/80 bg-muted/25 px-3 py-2">
        <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Trans>Book preview</Trans>
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-[#fafafa]">
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
      </div>
    </div>
  )
}

const pdfPagePreviewMsg = msg`PDF page {pageLabel} preview`

function PdfCoverCanvas({ file, width, height }: { file: File; width: number; height: number }) {
  const { i18n } = useLingui()
  const { pages, pageLabels, isLoading } = usePdfPreviewPages({
    file,
    mode: "all",
    width,
    height,
  })
  const ready = !isLoading && pages.length > 0

  return (
    <div
      className="@container relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md bg-white shadow-[0px_17px_38px_0px_rgba(0,0,0,0.1),0px_69px_69px_0px_rgba(0,0,0,0.09),0px_155px_93px_0px_rgba(0,0,0,0.05)]"
      aria-busy={!ready}
    >
      <div className="shrink-0 border-b border-border/80 bg-muted/25 px-3 py-2">
        <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Trans>Book preview</Trans>
        </p>
      </div>
      <div className="relative min-h-0 flex-1 overflow-y-auto bg-[#fafafa]">
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
      </div>
    </div>
  )
}

export function PdfCoverPreview({ file, width, height }: PdfCoverPreviewProps) {
  if (!file) {
    return <PdfCoverPlaceholder />
  }
  return <PdfCoverCanvas file={file} width={width} height={height} />
}
