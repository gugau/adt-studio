import { useAtomValue } from "jotai";
import { useLayoutEffect, useRef } from "react";
import { appConfigAtom } from "@/state/config.atoms";
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
} from "@/state/ui.atoms";
import { AudioPlayerProvider } from "@/hooks/AudioPlayerContext";
import { useAutoHideDock } from "@/hooks/useAutoHideDock";
import { useKeyboardPageNav } from "@/hooks/useKeyboardPageNav";
import { useToolbarKeyboardNav } from "@/hooks/useToolbarKeyboardNav";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { BookMetadata } from "./BookMetadata";
import { DockActivityActions } from "./DockActivityActions";
import { PageNav } from "./PageNav";
import { DockMenu } from "./DockMenu";

export function BottomDock() {
  const features = useAtomValue(appConfigAtom).features;
  const { t } = useTranslation();
  const dockRef = useRef<HTMLDivElement>(null);

  const position = useAtomValue(dockPositionAtom) as DockPosition;
  const width = useAtomValue(dockWidthAtom) as DockWidth;
  const align = useAtomValue(dockAlignAtom) as DockAlign;
  const hidden = useAtomValue(dockHiddenAtom);
  const menuValue = useAtomValue(dockMenuValueAtom);
  const iconSize = useAtomValue(iconSizeAtom) as IconSize;
  const reduceMotion = useAtomValue(reduceMotionAtom);

  useAutoHideDock(dockRef);
  useKeyboardPageNav();
  useToolbarKeyboardNav(dockRef);

  const isTop = position === "top";
  const isCompact = width === "compact";
  const isSpread = align === "spread";
  const shouldHide = hidden && menuValue === "";

  useLayoutEffect(() => {
    const el = dockRef.current;
    if (!el) return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      document.documentElement.style.setProperty("--dock-width", `${w}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--dock-width");
    };
  }, []);

  useLayoutEffect(() => {
    document.body.setAttribute("nav-position", isTop ? "top" : "bottom");
    if (!isCompact) {
      document.body.setAttribute("nav-size", "full");
    } else {
      document.body.removeAttribute("nav-size");
    }
    return () => {
      document.body.removeAttribute("nav-position");
      document.body.removeAttribute("nav-size");
    };
  }, [isCompact, isTop]);

  useLayoutEffect(() => {
    document.body.setAttribute("icon-size", iconSize);
    if (reduceMotion) document.body.setAttribute("reduce-motion", "true");
    else document.body.removeAttribute("reduce-motion");
    return () => {
      document.body.removeAttribute("icon-size");
      document.body.removeAttribute("reduce-motion");
    };
  }, [iconSize, reduceMotion]);

  return (
    <AudioPlayerProvider>
      <div
        ref={dockRef}
        data-hidden={shouldHide}
        className={cn(
          isSpread ? "justify-between" : "justify-center",
          isTop
            ? "data-[hidden=true]:-translate-y-24"
            : "data-[hidden=true]:translate-y-24",
          "flex items-center gap-1 p-1 h-full duration-200 ease-out",
          "data-[hidden=true]:opacity-0 data-[hidden=true]:pointer-events-none data-[hidden=false]:translate-y-0",
          "data-[hidden=true]:duration-300 data-[hidden=true]:ease-in",
          "bg-popover/95 text-popover-foreground backdrop-blur-md",
          "shadow-lg ring-1 ring-border",
          isCompact && "rounded-2xl",
          // Only animate transform + opacity (the show/hide motion). Width,
          // position, and border-radius switch instantly when the user
          // toggles compact ↔ full — otherwise interpolating those at once
          // produces a visible flicker.
          "transition-[transform,opacity] will-change-transform",
          cn(
            "fixed z-[55] h-14",
            // Compact uses margin-auto for centering (instead of a transform)
            // so toggling to full doesn't yank a translate off the element
            // mid-transition. Full goes edge-to-edge.
            isCompact
              ? cn(
                  "left-0 right-0 mx-auto w-fit",
                  "max-w-[100vw]",
                  isTop ? "top-3" : "bottom-3",
                )
              : cn("left-0 right-0 w-full", isTop ? "top-0" : "bottom-0"),
          ),
        )}
        role="toolbar"
        aria-label={t("dock-label") || "Reader controls"}
        aria-hidden={shouldHide || undefined}
      >
        <BookMetadata />
        {/*<DockActivityActions />*/}
        {features.showNavigationControls && <PageNav />}
        <DockMenu anchor={dockRef} side={isTop ? "bottom" : "top"} />
      </div>
    </AudioPlayerProvider>
  );
}
