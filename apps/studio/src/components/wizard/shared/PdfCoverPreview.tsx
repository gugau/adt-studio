import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { Trans } from "@lingui/react/macro"
import * as pdfjsLib from "pdfjs-dist"
import { cn } from "@/lib/utils"

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url,
).href

interface PdfCoverPreviewProps {
  file?: File | null
  width: number
  height: number
}

function PdfCoverPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-lg border border-[#e5e5e5] bg-white shadow-sm">
      <span className="text-sm text-[#a3a3a3]">
        <Trans>Book preview</Trans>
      </span>
    </div>
  )
}

function PdfCoverCanvas({ file, width, height }: { file: File; width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(false)
    let cancelled = false

    async function render() {
      const buffer = await file.arrayBuffer()
      if (cancelled) return

      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
      if (cancelled) return

      const page = await pdf.getPage(1)
      if (cancelled) return

      const unscaled = page.getViewport({ scale: 1 })
      const scale = Math.min(width / unscaled.width, height / unscaled.height)
      const viewport = page.getViewport({ scale })

      const canvas = canvasRef.current
      if (!canvas || cancelled) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({ canvas, viewport, canvasContext: ctx }).promise
      if (!cancelled) setReady(true)
    }

    render()
    return () => {
      cancelled = true
    }
  }, [file, width, height])

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
      <canvas
        ref={canvasRef}
        className={cn(
          "max-h-full max-w-full rounded-lg shadow-sm transition-opacity duration-500",
          ready ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  )
}

export function PdfCoverPreview({ file, width, height }: PdfCoverPreviewProps) {
  if (!file) {
    return <PdfCoverPlaceholder />
  }
  return <PdfCoverCanvas file={file} width={width} height={height} />
}
