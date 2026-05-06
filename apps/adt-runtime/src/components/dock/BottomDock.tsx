import { useAtomValue } from "jotai"
import { useEffect, useRef } from "react"
import { appConfigAtom } from "@/state/config.atoms"
import { AudioPlayerProvider } from "@/hooks/AudioPlayerContext"
import { useTranslation } from "@/hooks/useTranslation"
import { cn } from "@/lib/utils"
import { BookMetadata } from "./BookMetadata"
import { PageNav } from "./PageNav"
import { DockMenu } from "./DockMenu"

/**
 * Unified bottom dock — replaces the legacy `BackForwardBar`, `PlayBar`
 * quick-toggle, `NavMenu` floating trigger, and `AccessibilitySidebar`
 * floating trigger. Composes book metadata, page navigation, and the icon
 * row (5 popovers, one per surface) into one capsule pinned to the bottom.
 *
 * Publishes its measured width to `:root` as `--dock-width` so the popover
 * content panels (rendered through a Portal, outside the dock subtree) can
 * size themselves to match the dock.
 */
export function BottomDock() {
  const features = useAtomValue(appConfigAtom).features
  const { t } = useTranslation()
  const dockRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = dockRef.current
    if (!el) return
    const update = () => {
      const w = el.getBoundingClientRect().width
      document.documentElement.style.setProperty("--dock-width", `${w}px`)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      ro.disconnect()
      document.documentElement.style.removeProperty("--dock-width")
    }
  }, [])

  return (
    <AudioPlayerProvider>
      <div
        ref={dockRef}
        className={cn(
          "fixed bottom-3 left-1/2 -translate-x-1/2",
          "flex items-center gap-1 p-1",
          "rounded-2xl bg-popover/95 text-popover-foreground backdrop-blur-md",
          "shadow-lg ring-1 ring-border",
          "max-w-[calc(100vw-1.5rem)] z-[55]",
        )}
        role="toolbar"
        aria-label={t("dock-label") || "Reader controls"}
      >
        <BookMetadata />
        {features.showNavigationControls ? <PageNav /> : null}
        <DockMenu anchor={dockRef} />
      </div>
    </AudioPlayerProvider>
  )
}
