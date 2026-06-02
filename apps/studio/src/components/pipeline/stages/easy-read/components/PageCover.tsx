import { useEffect, useRef, useState } from "react"
import { FileText } from "lucide-react"
import { usePageImage } from "@/hooks/use-pages"

/** Small lazily-loaded page rendering used to distinguish pages at a glance. */
export function PageCover({ bookLabel, pageId }: { bookLabel: string; pageId: string }) {
  const [requested, setRequested] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (requested) return
    if (typeof IntersectionObserver === "undefined") {
      setRequested(true)
      return
    }
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRequested(true)
          observer.disconnect()
        }
      },
      { rootMargin: "300px" },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [requested])

  const { data } = usePageImage(bookLabel, pageId, { enabled: requested })
  const src = data?.imageBase64 ? `data:image/png;base64,${data.imageBase64}` : null

  return (
    <div
      ref={ref}
      className="h-14 w-10 shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted/40 shadow-sm"
    >
      {src ? (
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
          <FileText className="h-4 w-4" />
        </div>
      )}
    </div>
  )
}
