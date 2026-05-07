import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { disableNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/disable-native-drag-preview"
import { useAtomValue } from "jotai"
import { GripHorizontal } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { appConfigAtom } from "@/state/config.atoms"
import { signLanguageModeAtom } from "@/state/ui.atoms"
import {
  currentLanguageAtom,
  videoFilesAtom,
} from "@/state/language.atoms"
import {
  currentPageNumberAtom,
  currentSectionIdAtom,
  pagesAtom,
} from "@/state/nav.atoms"
import { useTranslation } from "@/hooks/useTranslation"
import { cn } from "@/lib/utils"

interface Position {
  x: number
  y: number
}

export function SLVideo() {
  const features = useAtomValue(appConfigAtom).features
  const slMode = useAtomValue(signLanguageModeAtom)
  const videoFiles = useAtomValue(videoFilesAtom)
  const sectionId = useAtomValue(currentSectionIdAtom)
  const pageNumber = useAtomValue(currentPageNumberAtom)
  const pages = useAtomValue(pagesAtom)
  const lang = useAtomValue(currentLanguageAtom)
  const { t } = useTranslation()

  const containerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<Position | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const src = useMemo(() => {
    if (!features.signLanguage || !slMode) return null
    const idx =
      pageNumber ??
      (sectionId ? pages.findIndex((p) => p.section_id === sectionId) + 1 : 0)
    const filename = videoFiles[`video-${idx}`]
    if (!filename) return null
    return `./content/i18n/${lang}/video/${filename}`
  }, [features.signLanguage, slMode, videoFiles, sectionId, pageNumber, pages, lang])

  useEffect(() => {
    const el = containerRef.current
    const handle = handleRef.current
    if (!el || !handle || !src) return

    let cursorOffset: Position = { x: 0, y: 0 }

    const clamp = (next: Position): Position => {
      const maxX = window.innerWidth - el.offsetWidth
      const maxY = window.innerHeight - el.offsetHeight
      return {
        x: Math.max(0, Math.min(next.x, maxX)),
        y: Math.max(0, Math.min(next.y, maxY)),
      }
    }

    return draggable({
      element: el,
      dragHandle: handle,
      onGenerateDragPreview: ({ nativeSetDragImage }) => {
        disableNativeDragPreview({ nativeSetDragImage })
      },
      onDragStart: ({ location }) => {
        const rect = el.getBoundingClientRect()
        cursorOffset = {
          x: location.initial.input.clientX - rect.left,
          y: location.initial.input.clientY - rect.top,
        }
        setIsDragging(true)
      },
      onDrag: ({ location }) => {
        const next = clamp({
          x: location.current.input.clientX - cursorOffset.x,
          y: location.current.input.clientY - cursorOffset.y,
        })
        el.style.left = `${next.x}px`
        el.style.top = `${next.y}px`
        el.style.right = "auto"
        el.style.bottom = "auto"
      },
      onDrop: ({ location }) => {
        const next = clamp({
          x: location.current.input.clientX - cursorOffset.x,
          y: location.current.input.clientY - cursorOffset.y,
        })
        setPosition(next)
        setIsDragging(false)
      },
    })
  }, [src])

  if (!src) return null

  const positioned = position !== null
  const style = positioned
    ? { left: position.x, top: position.y, right: "auto", bottom: "auto" }
    : undefined

  return (
    <div
      ref={containerRef}
      style={style}
      className={cn(
        "fixed w-80 h-48 max-w-[calc(100vw-2rem)]",
        "bg-black rounded-lg shadow-lg overflow-hidden z-[55]",
        "transition-shadow",
        isDragging && "shadow-2xl ring-2 ring-primary",
        !positioned && "bottom-20 left-4",
      )}
    >
      <div
        ref={handleRef}
        role="button"
        aria-label={t("sign-language-drag-handle") || "Drag sign language video"}
        tabIndex={0}
        className={cn(
          "h-6 w-full flex items-center justify-center",
          "bg-black/80 text-white/70 hover:text-white",
          "cursor-grab active:cursor-grabbing select-none",
        )}
      >
        <GripHorizontal className="w-4 h-4" aria-hidden />
      </div>
      <video
        key={src}
        src={src}
        autoPlay
        loop
        playsInline
        controls
        className="w-full h-[calc(100%-1.5rem)] object-cover"
      />
    </div>
  )
}
