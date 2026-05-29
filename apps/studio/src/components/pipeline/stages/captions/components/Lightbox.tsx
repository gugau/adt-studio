import { useEffect } from "react"
import { ChevronLeft, ChevronRight, Eye, EyeOff, Image as ImageIcon } from "lucide-react"
import { BASE_URL } from "@/api/client"
import { Trans, useLingui } from "@lingui/react/macro"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { LightboxEntry } from "../lib/types"

export function Lightbox({
  bookLabel,
  entries,
  index,
  onClose,
  onNavigate,
  onCaptionChange,
  onToggleDecorative,
}: {
  bookLabel: string
  entries: LightboxEntry[]
  index: number
  onClose: () => void
  onNavigate: (next: number) => void
  onCaptionChange: (entry: LightboxEntry, newCaption: string) => void
  onToggleDecorative: (entry: LightboxEntry) => void
}) {
  const { t } = useLingui()
  const entry = entries[index]

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT")) return
      if (e.key === "ArrowLeft" && index > 0) onNavigate(index - 1)
      else if (e.key === "ArrowRight" && index < entries.length - 1) onNavigate(index + 1)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [index, entries.length, onNavigate])

  if (!entry) return null
  const { cap, pageNumber } = entry
  const isDecorative = cap.decorative === true
  const hasPrev = index > 0
  const hasNext = index < entries.length - 1

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1 border-b px-5 py-3 pr-12 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="h-4 w-4 text-teal-600" />
            <Trans>Edit caption</Trans>
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-[11px]">
            <span className="font-mono font-medium text-foreground bg-muted rounded px-1.5 py-0.5">
              {cap.imageId}
            </span>
            <span>{t`Page ${String(pageNumber)}`}</span>
            <span className="ml-auto tabular-nums">
              {index + 1} / {entries.length}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5 sm:flex-row">
          <div className="relative flex h-[58vh] flex-1 items-center justify-center rounded-lg border bg-muted/30 p-2">
            <img
              src={`${BASE_URL}/books/${bookLabel}/images/${cap.imageId}`}
              alt={isDecorative ? "" : cap.caption}
              draggable={false}
              className="max-h-full max-w-full rounded object-contain"
            />
            {hasPrev && (
              <button
                type="button"
                onClick={() => onNavigate(index - 1)}
                aria-label={t`Previous image`}
                className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border bg-background/90 text-foreground shadow-sm backdrop-blur hover:bg-muted transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {hasNext && (
              <button
                type="button"
                onClick={() => onNavigate(index + 1)}
                aria-label={t`Next image`}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border bg-background/90 text-foreground shadow-sm backdrop-blur hover:bg-muted transition-colors cursor-pointer"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>

          <aside className="flex w-full shrink-0 flex-col gap-3 sm:w-64">
            <button
              type="button"
              onClick={() => onToggleDecorative(entry)}
              aria-pressed={isDecorative}
              className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-[13px] font-semibold shadow-sm transition-colors cursor-pointer ${
                isDecorative
                  ? "border-amber-400 bg-amber-100 text-amber-800 hover:bg-amber-200"
                  : "border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-400 hover:bg-amber-100"
              }`}
            >
              {isDecorative ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {isDecorative ? t`Marked decorative` : t`Mark as decorative`}
            </button>

            {isDecorative ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-[12px] leading-relaxed text-amber-700">
                <Trans>
                  This image is decorative. Screen readers will skip it and no caption is needed.
                </Trans>
              </p>
            ) : (
              <>
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <Trans>Caption</Trans>
                </label>
                <textarea
                  value={cap.caption}
                  onChange={(e) => onCaptionChange(entry, e.target.value)}
                  aria-label={t`Caption for ${cap.imageId}`}
                  placeholder={t`Describe this image…`}
                  className="min-h-[160px] flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200 transition-colors"
                />
                <p className="text-[10px] text-muted-foreground">
                  <Trans>Changes save automatically when you save on the page card.</Trans>
                </p>
              </>
            )}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  )
}
