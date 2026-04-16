import { useCallback, useEffect, useRef, useState } from "react"
import { Trans, useLingui } from "@lingui/react/macro"
import { msg } from "@lingui/core/macro"
import { Upload, Trash2 } from "lucide-react"
import { useStore } from "@tanstack/react-form"
import { Button } from "@/components/ui/button"
import { FileDropOverlay, useFileDropZone } from "@/components/ui/file-drop-overlay"
import { useWizardForm } from "@/components/wizard/wizardForm"
import { useBooks } from "@/hooks/use-books"
import { getPdfJs } from "@/components/wizard/shared/pdfjsLoader"
import { cn, formatBytes } from "@/lib/utils"

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
  const { i18n } = useLingui()
  const { data: books } = useBooks()
  const file = useStore(form.store, (s) => s.values.file)
  const [totalPages, setTotalPages] = useState(pdfCache.file === file ? pdfCache.totalPages : 0)
  const [pdfError, setPdfError] = useState<string | null>(null)

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

    setPdfError(null)
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
        pdfCache.file = null
        pdfCache.totalPages = 0
        setTotalPages(0)
        setPdfError(i18n._(msg`Could not read this PDF. The file may be corrupted or password-protected.`))
        form.setFieldValue("file", null)
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

  return { file, totalPages, pdfError, setFile, clearFile }
}

export function PdfUpload() {
  const { t } = useLingui()
  const { file, pdfError, setFile, clearFile } = usePdfUpload()
  const pdfRef = useRef<HTMLInputElement>(null)

  const { overlay, handleDrop } = useFileDropZone({
    accept: (f) => f.type === "application/pdf",
    onAccept: setFile,
  })

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    if (picked) setFile(picked)
    e.target.value = ""
  }, [setFile])

  return (
    <>
      <FileDropOverlay
        overlay={overlay}
        dropLabel={<Trans>Drop PDF here</Trans>}
        errorLabel={<Trans>Only PDF files are supported</Trans>}
        accent="blue"
      />

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
              id="wizard-pdf-upload"
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

        {pdfError && (
          <p className="text-xs text-[#ef4444] mt-1">{pdfError}</p>
        )}
      </div>
    </>
  )
}
