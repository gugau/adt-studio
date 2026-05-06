import { SubmitResetBar } from "./nav/SubmitResetBar"
import { BottomDock } from "./dock/BottomDock"

/**
 * The React tree mounted into `<div id="nav-container">`. Holds the unified
 * bottom dock (book metadata + page nav + NavigationMenu surfaces) and the
 * activity submit/reset pair. Each surface (TOC, glossary, audio, language,
 * settings) lives inside the dock's NavigationMenu now.
 */
export function NavRoot() {
  return (
    <>
      <BottomDock />
      <SubmitResetBar />
    </>
  )
}
