import { useEffect, useRef, useState } from "react"
import { ImageOff, Loader2 } from "lucide-react"
import { useLingui } from "@lingui/react/macro"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { usePageImage } from "@/hooks/use-pages"
import { getRequestedPageId, getQuizImageRenderState } from "../lib/quizzes-image-state"

interface PageThumbProps {
  bookLabel: string
  pageId: string
  onClick?: () => void
  selected?: boolean
  height?: "sm" | "md"
}

export function PageThumb({
  bookLabel,
  pageId,
  onClick,
  selected,
  height = "md",
}: PageThumbProps) {
  const { t } = useLingui()
  const [requestImage, setRequestImage] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (requestImage) return
    if (typeof IntersectionObserver === "undefined") {
      setRequestImage(true)
      return
    }
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRequestImage(true)
          observer.disconnect()
        }
      },
      { rootMargin: "200px" },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [requestImage])

  const { data: imageData, isLoading, isError } = usePageImage(
    bookLabel,
    getRequestedPageId(pageId, requestImage),
  )
  const imageState = getQuizImageRenderState({
    isRequested: requestImage,
    isLoading,
    isError,
    hasImage: !!imageData,
  })

  const heightClass = height === "sm" ? "h-24" : "h-44"
  const placeholderWidth = height === "sm" ? "w-16" : "w-32"

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onMouseEnter={() => setRequestImage(true)}
      onFocus={() => setRequestImage(true)}
      aria-label={t`Open page preview for ${pageId}`}
      className={`shrink-0 rounded border overflow-hidden transition-shadow cursor-pointer ${
        selected
          ? "border-orange-500 ring-2 ring-orange-500/30 bg-orange-50/40"
          : "border-border bg-muted/40 hover:ring-2 hover:ring-ring"
      }`}
    >
      {imageState === "ready" ? (
        <img
          src={`data:image/png;base64,${imageData!.imageBase64}`}
          alt={t`Page ${pageId}`}
          loading="lazy"
          className={`${heightClass} w-auto block`}
        />
      ) : imageState === "error" ? (
        <div
          className={`${heightClass} ${placeholderWidth} flex flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground`}
        >
          <ImageOff className="h-4 w-4" />
          <span>{t`No image`}</span>
        </div>
      ) : (
        <div
          className={`${heightClass} ${placeholderWidth} flex items-center justify-center px-2 text-[10px] text-muted-foreground`}
        >
          {t`Page ${pageId}`}
        </div>
      )}
    </button>
  )
}

interface PageLightboxProps {
  bookLabel: string
  pageId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PageLightbox({ bookLabel, pageId, open, onOpenChange }: PageLightboxProps) {
  const { t } = useLingui()
  const isRequested = open && !!pageId
  const queryPageId = getRequestedPageId(pageId ?? "", isRequested)
  const { data: imageData, isLoading, isError, refetch } = usePageImage(bookLabel, queryPageId)
  const imageState = getQuizImageRenderState({
    isRequested,
    isLoading,
    isError,
    hasImage: !!imageData,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {pageId && (
        <DialogContent className="w-auto max-w-[95vw] overflow-hidden gap-2 p-2 sm:max-w-[90vw] bg-white">
          <DialogTitle className="sr-only">{t`Page preview ${pageId}`}</DialogTitle>
          <DialogDescription className="sr-only">
            {t`Full-size source page preview.`}
          </DialogDescription>
          <div className="flex max-h-[90vh] max-w-[90vw] items-center justify-center overflow-hidden rounded-md bg-muted/20">
            {imageState === "ready" ? (
              <img
                src={`data:image/png;base64,${imageData!.imageBase64}`}
                alt={t`Page ${pageId}`}
                className="max-h-[90vh] max-w-[90vw] object-contain"
              />
            ) : imageState === "error" ? (
              <div className="flex h-64 w-52 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <ImageOff className="h-5 w-5" />
                <span>{t`Image unavailable`}</span>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="rounded border px-2 py-0.5 text-xs hover:bg-muted transition-colors cursor-pointer"
                >
                  {t`Retry`}
                </button>
              </div>
            ) : (
              <div className="flex h-64 w-52 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t`Loading image...`}</span>
              </div>
            )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}
