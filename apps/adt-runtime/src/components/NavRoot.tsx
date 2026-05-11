import { BottomDock } from "./dock/BottomDock"

/**
 * The React tree mounted into `<div id="nav-container">`. Holds the unified
 * bottom dock: book metadata + page nav + NavigationMenu surfaces, and the
 * inline activity submit/reset pair when the page hosts an activity. Each
 * surface (TOC, glossary, audio, language, settings) lives inside the dock's
 * NavigationMenu.
 */
export function NavRoot() {
  return <BottomDock />
}
