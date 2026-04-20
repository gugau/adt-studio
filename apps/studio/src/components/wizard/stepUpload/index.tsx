/* eslint-disable lingui/no-unlocalized-strings -- wizard strings are finalized later */
import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useStore } from "@tanstack/react-form"
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  Loader2,
  Trash2,
  FileText,
  BookOpen,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  FileDropOverlay,
  useFileDropZone,
} from "@/components/ui/file-drop-overlay"
import { cn, formatBytes } from "@/lib/utils"
import { useWizard } from "@/components/wizard"
import { useWizardForm } from "@/components/wizard/wizardForm"
import { useBooks } from "@/hooks/use-books"
import { StudioTopBar } from "@/components/StudioTopBar"
import {
  suggestLabel,
  suggestUniqueLabel,
} from "@/components/wizard/step1BasicInfo/PdfField"
import {
  getCachedPdfPageCount,
  getPdfPageCount,
} from "@/components/wizard/shared/pdfMetadata"
import { usePdfPreviewPages } from "@/components/wizard/shared/usePdfPreviewPages"

const CARD_HEIGHT = "h-[340px]"

function isPdfFile(f: File) {
  return f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
}

function PdfPreviewCard({
  file,
  pageCount,
  onReplace,
}: {
  file: File
  pageCount: number
  onReplace: () => void
}) {
  const { pages, isLoading } = usePdfPreviewPages({
    file,
    mode: "first",
    width: 160,
    height: 220,
  })
  const cover = pages[0]
  const displayTitle = suggestLabel(file) || file.name

  return (
    <div className={cn("w-full max-w-2xl border border-slate-200 rounded-lg overflow-hidden grid grid-cols-[2fr_1fr] bg-white", CARD_HEIGHT)}>
      <div className="flex flex-col">
        <div className="px-5 pt-5 pb-3 space-y-1">
          <p className="font-semibold text-lg leading-snug line-clamp-2 text-slate-900">
            {displayTitle}
          </p>
          <p className="text-[11px] text-slate-400 truncate">
            {file.name} &middot; {formatBytes(file.size)}
          </p>
        </div>

        <div className="px-5 pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            PDF info
          </p>
          <div className="space-y-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                {pageCount} {pageCount === 1 ? "page" : "pages"}
              </span>
            </div>
          </div>
        </div>

        <div className="px-5 pb-4 mt-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReplace}
            className="h-8 px-3 text-xs"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Replace PDF
          </Button>
        </div>
      </div>

      <div className="flex flex-col justify-center items-center border-l border-slate-200 bg-slate-50/50 p-5">
        {cover ? (
          <img
            src={cover}
            alt={displayTitle}
            className="w-full max-w-[160px] rounded-sm border border-slate-200 shadow-md object-contain"
          />
        ) : (
          <div className="w-full aspect-[3/4] max-w-[160px] rounded-sm border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center gap-3 shadow-md">
            {isLoading ? (
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            ) : (
              <BookOpen className="w-10 h-10 text-slate-300" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function StepUpload() {
  const navigate = useNavigate()
  const { setPhase, stepDirection } = useWizard()
  const form = useWizardForm()
  const { data: books } = useBooks()
  const file = useStore(form.store, (s) => s.values.file)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [pageCount, setPageCount] = useState<number>(() =>
    file ? getCachedPdfPageCount(file) ?? 0 : 0,
  )
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const setFile = useCallback(
    (f: File) => {
      const existingLabels = books?.map((b: { label: string }) => b.label) ?? []
      form.setFieldValue("file", f)
      form.setFieldValue("label", suggestUniqueLabel(f, existingLabels))
    },
    [form, books],
  )

  const clearFile = useCallback(() => {
    form.setFieldValue("file", null)
    form.setFieldValue("label", "")
    form.setFieldValue("startPage", "")
    form.setFieldValue("endPage", "")
    setPageCount(0)
    setPreviewError(null)
  }, [form])

  const handleAccept = useCallback(
    (f: File) => {
      setFile(f)
    },
    [setFile],
  )

  useEffect(() => {
    if (!file) {
      setPageCount(0)
      setPreviewLoading(false)
      setPreviewError(null)
      return
    }
    const cached = getCachedPdfPageCount(file)
    if (cached !== undefined) {
      setPageCount(cached)
      setPreviewLoading(false)
      setPreviewError(null)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    setPreviewError(null)
    ;(async () => {
      try {
        const count = await getPdfPageCount(file)
        if (cancelled) return
        setPageCount(count)
        form.setFieldValue("startPage", "1")
        form.setFieldValue("endPage", String(count))
      } catch {
        if (cancelled) return
        setPreviewError(
          "Could not read this PDF. The file may be corrupted or password-protected.",
        )
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [file])

  const { overlay } = useFileDropZone({
    accept: isPdfFile,
    onAccept: handleAccept,
  })

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = e.target.files?.[0]
      if (picked && isPdfFile(picked)) handleAccept(picked)
      e.target.value = ""
    },
    [handleAccept],
  )

  const openFilePicker = useCallback(() => fileInputRef.current?.click(), [])

  const hasPreview = !!(file && pageCount > 0 && !previewError)
  const hasError = !!previewError

  const initialHasPreview = !!(file && getCachedPdfPageCount(file))
  const skipAcceptAnimationRef = useRef(initialHasPreview)
  const [accepted, setAccepted] = useState(initialHasPreview)
  const [showPreview, setShowPreview] = useState(initialHasPreview)

  useEffect(() => {
    if (!hasPreview) {
      setAccepted(false)
      setShowPreview(false)
      skipAcceptAnimationRef.current = false
      return
    }
    if (skipAcceptAnimationRef.current) {
      skipAcceptAnimationRef.current = false
      return
    }
    setAccepted(true)
    const timer = setTimeout(() => setShowPreview(true), 1200)
    return () => clearTimeout(timer)
  }, [hasPreview])

  function handleContinue() {
    if (!hasPreview) return
    setPhase("wizard")
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col h-full bg-white">
      <StudioTopBar brandLinksHome trailingTitle="Add Book" />
      <FileDropOverlay
        overlay={overlay}
        dropLabel="Drop PDF here"
        errorLabel="Only PDF files are supported"
        accent="blue"
      />

      <div
        className={cn(
          "flex flex-1 min-h-0 w-full flex-col items-center justify-center gap-6 sm:gap-8 px-4 py-10 overflow-y-auto overflow-x-hidden",
          stepDirection === "forward"
            ? "animate-step-enter-forward"
            : "animate-step-enter-back",
        )}
      >
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-2xl sm:text-[30px] font-semibold leading-tight sm:leading-9 tracking-[-0.75px] text-[#030303] text-center">
            Convert a PDF
          </h1>
          <div className="max-w-xl grid [&>*]:col-start-1 [&>*]:row-start-1">
            <p
              className={cn(
                "text-center text-sm text-[#525252] transition-opacity duration-300 ease-out",
                showPreview ? "opacity-0 pointer-events-none" : "opacity-100",
              )}
            >
              Upload the source PDF of your book and we&apos;ll turn it into an Accessible
              Digital Textbook with interactive activities and adaptive layouts.
            </p>
            <p
              className={cn(
                "text-center text-sm text-[#525252] transition-opacity duration-300 ease-out",
                showPreview ? "opacity-100" : "opacity-0 pointer-events-none",
              )}
            >
              Review the source PDF details below and continue to configure how your book
              will be converted into an Accessible Digital Textbook.
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="w-full flex flex-col items-center px-4">
          <div
            className={cn(
              "w-full max-w-md transition-all duration-300 ease-out",
              hasError
                ? "opacity-100 max-h-40 mb-4 scale-100"
                : "opacity-0 max-h-0 mb-0 scale-95 overflow-hidden pointer-events-none",
            )}
          >
            {previewError && (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50/60 px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-700">
                    Couldn&apos;t read this PDF
                  </p>
                  <p className="text-xs text-red-600/80 mt-0.5 leading-relaxed">
                    {previewError}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="w-full grid place-items-center [&>*]:col-start-1 [&>*]:row-start-1">
            <div
              className={cn(
                "w-full flex justify-center transition-all ease-out",
                showPreview
                  ? "opacity-0 scale-95 pointer-events-none duration-300"
                  : `opacity-100 scale-100 ${CARD_HEIGHT} duration-300`,
              )}
            >
              <div
                role="button"
                tabIndex={showPreview ? -1 : 0}
                onClick={openFilePicker}
                onKeyDown={(e) => e.key === "Enter" && openFilePicker()}
                aria-label="Upload PDF or drag and drop"
                className={cn(
                  "flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg w-full max-w-md h-full cursor-pointer transition-colors duration-300",
                  accepted
                    ? "border-emerald-400 bg-emerald-50/40"
                    : previewLoading
                      ? "border-blue-400/60 bg-blue-500/[0.02]"
                      : hasError
                        ? "border-red-300 hover:border-red-400 bg-red-50/30 hover:bg-red-50/50"
                        : "border-[#d4d4d4] hover:border-[#2b7fff]/60 hover:bg-[#2b7fff]/[0.02]",
                )}
              >
                <div className="grid place-items-center [&>*]:col-start-1 [&>*]:row-start-1">
                  <div
                    className={cn(
                      "flex items-center gap-2 transition-all duration-300 ease-out",
                      accepted
                        ? "opacity-100 scale-100"
                        : "opacity-0 scale-90 pointer-events-none",
                    )}
                  >
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                      <svg
                        className="w-3 h-3 text-emerald-600"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <path
                          d="M2.5 6L5 8.5L9.5 3.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-emerald-600">
                      PDF accepted
                    </span>
                  </div>
                  <div
                    className={cn(
                      "flex flex-col items-center gap-2 transition-all duration-300 ease-out",
                      previewLoading && !accepted
                        ? "opacity-100 scale-100"
                        : "opacity-0 scale-90 pointer-events-none",
                    )}
                  >
                    <Loader2 className="h-5 w-5 text-[#2b7fff] animate-spin" />
                    <span className="text-sm text-[#737373]">
                      Reading PDF...
                    </span>
                  </div>
                  <div
                    className={cn(
                      "flex flex-col items-center gap-2 transition-all duration-300 ease-out",
                      !previewLoading && !accepted
                        ? "opacity-100 scale-100"
                        : "opacity-0 scale-90 pointer-events-none",
                    )}
                  >
                    <Upload
                      className={cn(
                        "h-5 w-5",
                        hasError ? "text-red-400" : "text-[#737373]",
                      )}
                    />
                    <span
                      className={cn(
                        "text-sm",
                        hasError ? "text-red-500" : "text-[#737373]",
                      )}
                    >
                      {hasError ? "Try another file" : "Upload PDF or drag and drop"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div
              className={cn(
                "w-full flex justify-center transition-all duration-500 ease-out",
                showPreview
                  ? "opacity-100 scale-100"
                  : "opacity-0 scale-95 pointer-events-none",
              )}
            >
              {hasPreview && (
                <div className="relative">
                  <PdfPreviewCard
                    file={file}
                    pageCount={pageCount}
                    onReplace={openFilePicker}
                  />
                  <button
                    type="button"
                    onClick={clearFile}
                    className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-[#e5e5e5] text-[#737373] hover:text-[#ef4444] hover:border-[#ef4444]/50 transition-colors shadow-sm"
                    aria-label="Remove PDF"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => navigate({ to: "/" })}
            className="h-9 px-3 py-2 bg-[#f5f5f5] text-[#262626] hover:bg-[#e5e5e5] border-0"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back
          </Button>
          <Button
            disabled={!hasPreview || previewLoading}
            onClick={handleContinue}
            className="h-9 px-3 py-2 text-white bg-[#2b7fff] hover:bg-[#2b7fff]/90 disabled:opacity-50 border-0"
          >
            Continue
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
