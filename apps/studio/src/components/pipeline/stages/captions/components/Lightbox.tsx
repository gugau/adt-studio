import { useEffect } from "react"
import { createPortal } from "react-dom"
import { ChevronLeft, ChevronRight, Eye, EyeOff, X } from "lucide-react"
import { BASE_URL } from "@/api/client"
import { Trans, useLingui } from "@lingui/react/macro"
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
      if (e.key === "Escape") onClose()
      else if (e.key === "ArrowLeft" && index > 0) onNavigate(index - 1)
      else if (e.key === "ArrowRight" && index < entries.length - 1) onNavigate(index + 1)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [index, entries.length, onClose, onNavigate])

  if (!entry) return null
  const { cap, pageNumber } = entry
  const isDecorative = cap.decorative === true
  const hasPrev = index > 0
  const hasNext = index < entries.length - 1

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative flex h-full w-full max-w-7xl flex-col md:flex-row gap-6 p-6 md:p-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex flex-1 items-center justify-center min-h-0">
          <img
            src={`${BASE_URL}/books/${bookLabel}/images/${cap.imageId}`}
            alt={isDecorative ? "" : cap.caption}
            className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
          />
          {hasPrev && (
            <button
              type="button"
              onClick={() => onNavigate(index - 1)}
              aria-label={t`Previous image`}
              className="absolute left-0 top-1/2 -translate-y-1/2 -ml-2 md:-ml-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer backdrop-blur"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {hasNext && (
            <button
              type="button"
              onClick={() => onNavigate(index + 1)}
              aria-label={t`Next image`}
              className="absolute right-0 top-1/2 -translate-y-1/2 -mr-2 md:-mr-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer backdrop-blur"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>

        <aside className="flex w-full md:w-80 shrink-0 flex-col gap-3 text-white">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-semibold tracking-wide text-teal-200 bg-teal-900/40 rounded px-2 py-0.5">
              {cap.imageId}
            </span>
            <span className="text-[11px] text-white/60">
              {t`Page ${String(pageNumber)}`}
            </span>
            <span className="ml-auto text-[11px] text-white/60 tabular-nums">
              {index + 1} / {entries.length}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onToggleDecorative(entry)}
            aria-pressed={isDecorative}
            className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-[12px] font-medium transition-colors cursor-pointer ${
              isDecorative
                ? "bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
                : "bg-white/10 text-white/80 hover:bg-white/15"
            }`}
          >
            {isDecorative ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {isDecorative ? t`Marked decorative` : t`Mark as decorative`}
          </button>

          {isDecorative ? (
            <p className="rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-3 text-[12px] leading-relaxed text-amber-100">
              <Trans>
                This image is decorative. Screen readers will skip it and no caption is needed.
              </Trans>
            </p>
          ) : (
            <>
              <label className="text-[11px] font-medium uppercase tracking-wider text-white/60">
                <Trans>Caption</Trans>
              </label>
              <textarea
                value={cap.caption}
                onChange={(e) => onCaptionChange(entry, e.target.value)}
                aria-label={t`Caption for ${cap.imageId}`}
                placeholder={t`Describe this image…`}
                className="flex-1 min-h-[160px] resize-none rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm leading-relaxed text-white placeholder:text-white/40 focus:border-teal-300 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-teal-400/30 transition-colors"
              />
              <p className="text-[10px] text-white/50">
                <Trans>Changes save automatically when you save on the page card.</Trans>
              </p>
            </>
          )}
        </aside>

        <button
          type="button"
          onClick={onClose}
          aria-label={t`Close`}
          className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>,
    document.body,
  )
}
