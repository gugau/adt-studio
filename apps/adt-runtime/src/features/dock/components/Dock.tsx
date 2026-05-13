import { useAtomValue } from "jotai"
import { useLayoutEffect, useRef, type ReactNode } from "react"
import { DockContext, type DockSide } from "@/features/dock/context/dock-context"
import {
  dockAlignAtom,
  dockHiddenAtom,
  dockMenuValueAtom,
  dockPositionAtom,
  dockWidthAtom,
  iconSizeAtom,
  reduceMotionAtom,
  type DockAlign,
  type DockPosition,
  type DockWidth,
  type IconSize,
} from "@/shared/state/ui.atoms"
import { AudioPlayerProvider } from "@/features/audio/hooks/AudioPlayerContext"
import { useAutoHideDock } from "@/features/dock/hooks/useAutoHideDock"
import { useKeyboardPageNav } from "@/features/navigation/hooks/useKeyboardPageNav"
import { useToolbarKeyboardNav } from "@/features/dock/hooks/useToolbarKeyboardNav"
import { useTranslation } from "@/features/language/hooks/useTranslation"
import { cn } from "@/shared/lib/utils"

interface DockProps {
  children: ReactNode
}

export function Dock({ children }: DockProps) {
  const { t } = useTranslation()
  const dockRef = useRef<HTMLDivElement>(null)

  const position = useAtomValue(dockPositionAtom) as DockPosition
  const width = useAtomValue(dockWidthAtom) as DockWidth
  const align = useAtomValue(dockAlignAtom) as DockAlign
  const hidden = useAtomValue(dockHiddenAtom)
  const menuValue = useAtomValue(dockMenuValueAtom)
  const iconSize = useAtomValue(iconSizeAtom) as IconSize
  const reduceMotion = useAtomValue(reduceMotionAtom)

  useAutoHideDock(dockRef)
  useKeyboardPageNav()
  useToolbarKeyboardNav(dockRef)

  const isTop = position === "top"
  const isCompact = width === "compact"
  const isSpread = align === "spread"
  const shouldHide = hidden && menuValue === ""
  const popoverSide: DockSide = isTop ? "bottom" : "top"

  useLayoutEffect(() => {
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

  useLayoutEffect(() => {
    document.body.setAttribute("nav-position", isTop ? "top" : "bottom")
    if (!isCompact) {
      document.body.setAttribute("nav-size", "full")
    } else {
      document.body.removeAttribute("nav-size")
    }
    return () => {
      document.body.removeAttribute("nav-position")
      document.body.removeAttribute("nav-size")
    }
  }, [isCompact, isTop])

  useLayoutEffect(() => {
    document.body.setAttribute("icon-size", iconSize)
    if (reduceMotion) document.body.setAttribute("reduce-motion", "true")
    else document.body.removeAttribute("reduce-motion")
    return () => {
      document.body.removeAttribute("icon-size")
      document.body.removeAttribute("reduce-motion")
    }
  }, [iconSize, reduceMotion])

  return (
    <AudioPlayerProvider>
      <DockContext.Provider value={{ ref: dockRef, popoverSide }}>
        <div
          ref={dockRef}
          className={cn(
            isSpread ? "justify-between" : "justify-center",
            "flex items-center gap-1 p-1 h-full w-full",
            "bg-popover/95 text-popover-foreground backdrop-blur-md",
            "shadow-lg ring-1 ring-border",
            "transition-all duration-200 ease-out will-change-transform",
            isCompact ? "rounded-2xl max-w-3xl" : "rounded-none",
            shouldHide && "opacity-0 pointer-events-none",
            shouldHide &&
              (isTop ? "-translate-y-[150%]" : "translate-y-[150%]"),
            cn(
              "fixed z-[55] h-14 left-0 right-0 mx-auto",
              isCompact
                ? (isTop ? "top-3" : "bottom-3")
                : (isTop ? "top-0" : "bottom-0"),
            ),
          )}
          role="toolbar"
          aria-label={t("dock-label") || "Reader controls"}
          aria-hidden={shouldHide || undefined}
        >
          {children}
        </div>
      </DockContext.Provider>
    </AudioPlayerProvider>
  )
}
