import { BottomDock } from "@/features/dock/components/BottomDock";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { ActivityDock } from "@/features/activity/components/ActivityDock";
import { ActivityConfetti } from "@/features/activity/components/ActivityConfetti";
import { Dock } from "@/features/dock/components/Dock";

/**
 * The React tree mounted into `<div id="nav-container">`. Holds the unified
 * bottom dock: book metadata + page nav + NavigationMenu surfaces, and the
 * inline activity submit/reset pair when the page hosts an activity. Each
 * surface (TOC, glossary, audio, language, settings) lives inside the dock's
 * NavigationMenu.
 *
 * Wrapped in its own `TooltipProvider` because ChromeRoot is a separate
 * React tree — context doesn't cross root boundaries, so each root needs
 * its own provider.
 *
 * In embed mode (server sets `<body data-embed="1">` for the storyboard's
 * "Try activity" iframe), the reader chrome is hidden but the activity dock
 * stays so users can submit. Read once on render — the attribute is
 * server-rendered and won't change at runtime.
 */
export function NavRoot() {
  const isEmbed =
    typeof document !== "undefined" &&
    document.body.getAttribute("data-embed") === "1";

  return (
    <TooltipProvider delay={300} closeDelay={120}>
      <Dock>
        <ActivityDock />
        {!isEmbed && <BottomDock />}
      </Dock>
      <ActivityConfetti />
    </TooltipProvider>
  );
}
