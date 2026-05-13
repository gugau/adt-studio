import { BottomDock } from "./dock/BottomDock"
import { TooltipProvider } from "./ui/tooltip"

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
 */
export function NavRoot() {
  return (
    <TooltipProvider delay={300} closeDelay={120}>
      <BottomDock />
    </TooltipProvider>
  )
}
