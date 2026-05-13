import { Toaster } from "sonner"
import { ActivityHeader } from "./activity/ActivityHeader"
import { Notepad } from "./notepad/Notepad"
import { Eli5Popup } from "./eli5/Eli5Popup"
import { SLVideo } from "./signlanguage/SLVideo"
import { AdminPopup } from "./admin/AdminPopup"
import { GlossaryHighlighter } from "./glossary/GlossaryHighlighter"
import { GlossaryTermPopover } from "./glossary/GlossaryTermPopover"
import { TutorialOverlay } from "./tutorial/TutorialOverlay"
import { PagePrefetcher } from "./PagePrefetcher"

/**
 * The React tree mounted into `<div id="interface-container">` on every
 * page. Hosts the secondary floating surfaces (notepad, eli5, sign-language,
 * admin) plus side-effect components (glossary highlighter / term popover,
 * tutorial overlay, page prefetcher, toaster).
 *
 * The primary chrome (book metadata + page nav + the five surface triggers
 * — TOC, glossary, audio, language, settings) lives in the `BottomDock`
 * inside `NavRoot`.
 */
export function ChromeRoot() {
  return (
    <>
      <ActivityHeader />
      <Notepad />
      <Eli5Popup />
      <SLVideo />
      <AdminPopup />
      <GlossaryHighlighter />
      <GlossaryTermPopover />
      <TutorialOverlay />
      <PagePrefetcher />
      <Toaster position="top-center" richColors closeButton />
    </>
  )
}
