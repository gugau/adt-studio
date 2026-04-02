import { useMemo } from "react"
import { Loader2, BookOpen } from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import { cn } from "@/lib/utils"
import { usePdfPreviewPages } from "@/components/wizard/shared/usePdfPreviewPages"

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
          <Trans>Book Cover</Trans>
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-[#fafafa]">
        <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-6 px-6 py-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-border bg-white text-muted-foreground">
            <BookOpen className="h-7 w-7" />
          </div>
          <div className="max-w-[280px] text-center">
            <p className="text-base font-semibold text-foreground">
              <Trans>Book Cover</Trans>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              <Trans>Upload a PDF to preview its cover page here.</Trans>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function PdfCoverCanvas({ file, width, height }: { file: File; width: number; height: number }) {
  const { t } = useLingui()
  const { pages, isLoading } = usePdfPreviewPages({
    file,
    mode: "first",
    width,
    height,
  })
  const coverDataUrl = useMemo(() => pages[0], [pages])
  const ready = !isLoading && Boolean(coverDataUrl)

  return (
    <div
      className={cn(
        " relative flex items-center justify-center rounded-lg shadow-sm border border-[#e5e5e5] overflow-hidden",
        ready ? "opacity-100" : "w-full h-full bg-white animate-pulse",
      )}
      aria-busy={!ready}
    >
      {!ready && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-[#f0f0f0]"
          aria-hidden
        >
          <Loader2 className="h-8 w-8 animate-spin text-[#737373]" aria-hidden />
          <span className="sr-only">
            <Trans>Loading preview</Trans>
          </span>
        </div>
      )}
      {coverDataUrl ? (
        <img
          src={coverDataUrl}
          alt={t`PDF cover preview`}
          className={cn(
            "max-h-full max-w-full rounded-lg shadow-sm transition-opacity duration-500",
            ready ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
    </div>
  )
}

export function PdfCoverPreview({ file, width, height }: PdfCoverPreviewProps) {
  if (!file) {
    return <PdfCoverPlaceholder />
  }
  return <PdfCoverCanvas file={file} width={width} height={height} />
}
