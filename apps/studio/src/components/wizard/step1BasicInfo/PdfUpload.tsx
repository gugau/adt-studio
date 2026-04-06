import { useCallback, useEffect, useRef, useState } from "react"
import { Trans, useLingui } from "@lingui/react/macro"
import { Upload, Trash2, XCircle } from "lucide-react"
import { useStore } from "@tanstack/react-form"
import { Button } from "@/components/ui/button"
import { useWizardForm } from "@/components/wizard/wizardForm"
import { useBooks } from "@/hooks/use-books"
import { getPdfJs } from "@/components/wizard/shared/pdfjsLoader"
import { cn } from "@/lib/utils"

type OverlayState = "idle" | "dragging" | "error"

async function getPdfPageCount(file: File): Promise<number> {
  const pdfjs = await getPdfJs()
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buffer }).promise
  try {
    return pdf.numPages
  } finally {
    await pdf.destroy()
  }
}

function waitTwoAnimationFrames(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

function formatBytes(bytes: number) {
  /* eslint-disable-next-line lingui/no-unlocalized-strings */
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  /* eslint-disable-next-line lingui/no-unlocalized-strings */
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function suggestLabel(file: File) {
  return file.name
    .replace(/\.pdf$/i, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/^[^a-zA-Z0-9]+/, "")
    .slice(0, 64)
}

function suggestUniqueLabel(file: File, existingLabels: string[]): string {
  const base = suggestLabel(file)
  if (!existingLabels.includes(base)) return base
  let i = 2
  while (existingLabels.includes(`${base}-${i}`)) i++
  return `${base}-${i}`
}

const pdfCache = { file: null as File | null, totalPages: 0 }

export function usePdfUpload() {
  const form = useWizardForm()
  const { data: books } = useBooks()
  const file = useStore(form.store, (s) => s.values.file)
  const [totalPages, setTotalPages] = useState(pdfCache.file === file ? pdfCache.totalPages : 0)

  useEffect(() => {
    if (!file) {
      pdfCache.file = null
      pdfCache.totalPages = 0
      setTotalPages(0)
      form.setFieldValue("startPage", "")
      form.setFieldValue("endPage", "")
      return
    }
    if (pdfCache.file === file) {
      setTotalPages(pdfCache.totalPages)
      return
    }

    let cancelled = false
    ;(async () => {
      await waitTwoAnimationFrames()
      if (cancelled) return
      try {
        const count = await getPdfPageCount(file)
        if (cancelled) return
        pdfCache.file = file
        pdfCache.totalPages = count
        setTotalPages(count)
        form.setFieldValue("startPage", "1")
        form.setFieldValue("endPage", String(count))
      } catch {
        if (cancelled) return
        pdfCache.file = file
        pdfCache.totalPages = 0
        setTotalPages(0)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [file])

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
  }, [form])

  return { file, totalPages, setFile, clearFile }
}

export function PdfUpload() {
  const { t } = useLingui()
  const { file, setFile, clearFile } = usePdfUpload()
  const pdfRef = useRef<HTMLInputElement>(null)
  const [overlay, setOverlay] = useState<OverlayState>("idle")
  const overlayRef = useRef<OverlayState>("idle")
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function setOverlayState(s: OverlayState) {
    overlayRef.current = s
    setOverlay(s)
  }

  const acceptDrop = useCallback((f: File | undefined) => {
    if (!f) return
    if (f.type !== "application/pdf") {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
      setOverlayState("error")
      errorTimerRef.current = setTimeout(() => {
        setOverlayState("idle")
      }, 2000)
      return
    }
    setOverlayState("idle")
    setFile(f)
  }, [setFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    acceptDrop(e.dataTransfer.files[0])
  }, [acceptDrop])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    if (picked) setFile(picked)
    e.target.value = ""
  }, [setFile])

  useEffect(() => {
    function onDragEnter(e: DragEvent) {
      if (e.dataTransfer?.types.includes("Files")) setOverlayState("dragging")
    }
    function onDragLeave(e: DragEvent) {
      if (e.relatedTarget === null && overlayRef.current !== "error") setOverlayState("idle")
    }
    function onDragOver(e: DragEvent) { e.preventDefault() }
    function onDrop(e: DragEvent) {
      e.preventDefault()
      acceptDrop(e.dataTransfer?.files[0])
    }

    window.addEventListener("dragenter", onDragEnter)
    window.addEventListener("dragleave", onDragLeave)
    window.addEventListener("dragover", onDragOver)
    window.addEventListener("drop", onDrop)
    return () => {
      window.removeEventListener("dragenter", onDragEnter)
      window.removeEventListener("dragleave", onDragLeave)
      window.removeEventListener("dragover", onDragOver)
      window.removeEventListener("drop", onDrop)
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    }
  }, [acceptDrop])

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-50 m-1 flex flex-col items-center justify-center rounded-lg pointer-events-none",
          "transition-[opacity,background-color,border-color] duration-300 ease-out",
          overlay === "idle" && "border-4 border-transparent opacity-0",
          overlay === "dragging" &&
            "border-4 border-dashed border-[#2b7fff] bg-[#2b7fff]/10 opacity-100",
          overlay === "error" &&
            "border-4 border-dashed border-[#ef4444] bg-[#ef4444]/10 opacity-100",
        )}
        aria-hidden
      >
        <div className="grid min-h-[5.5rem] w-full max-w-md place-items-center px-4">
          <div
            className={cn(
              "col-start-1 row-start-1 flex flex-col items-center gap-3 transition-all duration-300 ease-out",
              overlay === "error"
                ? "pointer-events-none scale-95 opacity-0"
                : "scale-100 opacity-100",
            )}
          >
            <Upload
              className={cn(
                "h-10 w-10 text-[#2b7fff] transition-transform duration-300 ease-out",
                overlay === "dragging" ? "scale-100" : "scale-75",
              )}
            />
            <span className="text-base font-semibold text-[#2b7fff]">
              <Trans>Drop PDF here</Trans>
            </span>
          </div>
          <div
            className={cn(
              "col-start-1 row-start-1 flex flex-col items-center gap-3 transition-all duration-300 ease-out",
              overlay === "error"
                ? "scale-100 opacity-100"
                : "pointer-events-none scale-95 opacity-0",
            )}
          >
            <XCircle className="h-10 w-10 text-[#ef4444]" />
            <span className="text-center text-base font-semibold text-[#ef4444]">
              <Trans>Only PDF files are supported</Trans>
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-[#0a0a0a]">
          <Trans>PDF File</Trans> <span className="text-[#ef4444]">*</span>
        </label>
        <input ref={pdfRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />

        <div
          className={cn("overflow-hidden transition-[height] duration-300 ease-in-out", file ? "h-[60px]" : "h-[112px]")}
        >
          {file ? (
            <div className="flex items-center gap-3 border border-[#e5e5e5] rounded-lg px-4 py-3 h-full">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-black truncate">{file.name}</p>
                <p className="text-xs text-[#a3a3a3]">{formatBytes(file.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={clearFile}
                aria-label={t`Remove PDF`}
                className="h-8 w-8 text-[#737373] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => pdfRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && pdfRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              aria-label={t`Upload PDF or drag and drop`}
              className="flex flex-col items-center justify-center gap-2 border border-dashed border-[#d4d4d4] rounded-lg h-full cursor-pointer hover:border-[#2b7fff]/60 hover:bg-[#2b7fff]/[0.02] transition-colors duration-200"
            >
              <Upload className="h-4 w-4 text-[#737373]" />
              <span className="text-sm text-[#737373]">
                <Trans>Upload PDF or drag and drop</Trans>
              </span>
            </div>
          )}
        </div>

      </div>
    </>
  )
}
