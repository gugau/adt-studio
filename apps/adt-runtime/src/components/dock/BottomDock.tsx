import { useAtomValue } from "jotai";
import { useLayoutEffect, useRef } from "react";
import { appConfigAtom } from "@/state/config.atoms";
import {
  dockAlignAtom,
  dockHiddenAtom,
  dockMenuValueAtom,
  dockPositionAtom,
  dockWidthAtom,
  type DockAlign,
  type DockPosition,
  type DockWidth,
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

  useAutoHideDock();
  useKeyboardPageNav();
  useToolbarKeyboardNav(dockRef);

  const isTop = position === "top";
  const isCompact = width === "compact";
  const isLeft = align === "left";
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

  return (
    <AudioPlayerProvider>
      <div
        className={cn(
          "fixed z-[55] h-14",
          isLeft ? "left-3" : "left-1/2 -translate-x-1/2",
          isCompact ? "max-w-[100vw]" : isLeft ? "pr-2 right-3" : "px-2 w-full",
          isTop ? "top-3" : "bottom-3",
        )}
      >
        <div
          ref={dockRef}
          className={cn(
            "flex items-center gap-1 p-1 h-full",
            isLeft ? "justify-start" : "justify-center",
            "rounded-2xl bg-popover/95 text-popover-foreground backdrop-blur-md",
            "shadow-lg ring-1 ring-border",
            "transition-[transform,opacity,box-shadow] duration-300 ease-out will-change-transform",
            shouldHide &&
              (isTop ? "-translate-y-[150%]" : "translate-y-[150%]"),
            shouldHide && "opacity-0 pointer-events-none",
          )}
          role="toolbar"
          aria-label={t("dock-label") || "Reader controls"}
          aria-hidden={shouldHide || undefined}
        >
          <DockActivityActions />
          <BookMetadata />
          {features.showNavigationControls && <PageNav />}
          <DockMenu anchor={dockRef} side={isTop ? "bottom" : "top"} />
        </div>
      </div>
    </AudioPlayerProvider>
  );
}

function Divider() {
  return <div className="w-px h-2/3 bg-border" />;
}
