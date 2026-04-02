import { useEffect, useState } from "react"
import { getPdfJs } from "@/components/wizard/shared/pdfjsLoader"

const JPEG_QUALITY = 0.92
const MAX_CACHE_ENTRIES = 12

const previewCache = new Map<string, string[]>()

function rememberInCache(key: string, pages: string[]) {
  if (previewCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = previewCache.keys().next().value
    if (oldest !== undefined) previewCache.delete(oldest)
  }
  previewCache.set(key, pages)
}

type PdfPreviewMode = "first" | "all"

interface UsePdfPreviewPagesParams {
  file?: File | null
  src?: string
  mode: PdfPreviewMode
  width?: number
  height?: number
}

function buildCacheKey({ file, src, mode, width, height }: UsePdfPreviewPagesParams): string {
  if (file) {
    return `file:${file.name}:${file.lastModified}:${file.size}:${mode}:${width ?? "-"}:${height ?? "-"}`
  }
  return `src:${src ?? ""}:${mode}:${width ?? "-"}:${height ?? "-"}`
}

export function usePdfPreviewPages(params: UsePdfPreviewPagesParams) {
  const { file, src, mode, width, height } = params
  const [pages, setPages] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const hasFile = Boolean(file)
    const hasSrc = Boolean(src)
    if (!hasFile && !hasSrc) {
      setPages([])
      setIsLoading(false)
      setError(null)
      return
    }

    const cacheKey = buildCacheKey(params)
    const cached = previewCache.get(cacheKey)
    if (cached) {
      setPages(cached)
      setIsLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setPages([])
    setIsLoading(true)
    setError(null)

    ;(async () => {
      try {
        const bytes = file
          ? await file.arrayBuffer()
          : await fetch(src as string).then(async (response) => {
              if (!response.ok) throw new Error(`HTTP ${response.status}`)
              return response.arrayBuffer()
            })
        if (cancelled) return

        const pdfjs = await getPdfJs()
        if (cancelled) return

        const pdf = await pdfjs.getDocument({ data: bytes }).promise
        if (cancelled) {
          await pdf.destroy().catch(() => {})
          return
        }

        try {
          const result: string[] = []
          const lastPage = mode === "first" ? 1 : pdf.numPages
          for (let pageNumber = 1; pageNumber <= lastPage; pageNumber += 1) {
            const page = await pdf.getPage(pageNumber)
            if (cancelled) return

            const base = page.getViewport({ scale: 1 })
            const scale =
              mode === "first" && width && height
                ? Math.min(width / base.width, height / base.height)
                : 1200 / base.width
            const viewport = page.getViewport({ scale })
            const canvas = document.createElement("canvas")
            const ctx = canvas.getContext("2d")
            if (!ctx) throw new Error("Canvas context unavailable")

            canvas.width = Math.floor(viewport.width)
            canvas.height = Math.floor(viewport.height)
            await page.render({ canvas, canvasContext: ctx, viewport }).promise
            if (cancelled) return
            result.push(canvas.toDataURL("image/jpeg", JPEG_QUALITY))
          }

          if (cancelled) return
          rememberInCache(cacheKey, result)
          setPages(result)
          setIsLoading(false)
        } finally {
          await pdf.destroy().catch(() => {})
        }
      } catch {
        if (cancelled) return
        setError("preview-error")
        setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [file, src, mode, width, height])

  return { pages, isLoading, error }
}
