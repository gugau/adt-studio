import { Toaster } from "sonner"
import { AccessibilitySidebar } from "./sidebar/AccessibilitySidebar"
import { PlayBar } from "./playbar/PlayBar"
import { Notepad } from "./notepad/Notepad"
import { Eli5Popup } from "./eli5/Eli5Popup"
import { SLVideo } from "./signlanguage/SLVideo"
import { AdminPopup } from "./admin/AdminPopup"
import { GlossaryHighlighter } from "./glossary/GlossaryHighlighter"
import { GlossaryTermPopover } from "./glossary/GlossaryTermPopover"
import { TutorialOverlay } from "./tutorial/TutorialOverlay"

/**
 * The React tree mounted into `<div id="interface-container">` on every
 * page. Contains all "right-side" / floating chrome surfaces.
 *
 * Note: the page-nav controls (BackForwardBar, NavMenu, SubmitResetBar) live
 * in `NavRoot` so they can be portaled into `<div id="nav-container">`,
 * matching the original interface.html / nav.html split.
 */
export function ChromeRoot() {
  return (
    <>
      <AccessibilitySidebar />
      <PlayBar />
      <Notepad />
      <Eli5Popup />
      <SLVideo />
      <AdminPopup />
      {/* The glossary's sidebar view is rendered inside AccessibilitySidebar.
          These two components handle the side-effects: DOM highlighting in
          `#content` and the floating popover when a highlighted term is clicked. */}
      <GlossaryHighlighter />
      <GlossaryTermPopover />
      <TutorialOverlay />
      <Toaster position="top-center" richColors closeButton />
    </>
  )
}
