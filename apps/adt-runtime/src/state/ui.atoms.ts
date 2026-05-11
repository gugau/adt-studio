/**
 * UI mode atoms — replaces the UI-related fields of the legacy `state` object
 * (state.js). Toggles that the user expects to persist across page reloads
 * use `persistedBoolAtom`; transient view state uses `ephemeralAtom`.
 */
import {
  ephemeralAtom,
  persistedBoolAtom,
  persistedJsonAtom,
  persistedStringAtom,
} from "./persist"

// Persistent toggles — driven by sidebar switches and survive navigation.
export const easyReadModeAtom = persistedBoolAtom("easyReadMode", false)
export const eli5ModeAtom = persistedBoolAtom("eli5Mode", false)
export const signLanguageModeAtom = persistedBoolAtom("signLanguageMode", false)
export const glossaryModeAtom = persistedBoolAtom("glossaryMode", false)
export const syllablesModeAtom = persistedBoolAtom("syllablesMode", false)
export const stateModeAtom = persistedBoolAtom("stateMode", true) // "Auto-hide menus" master switch

// Dock interface preferences.
export type DockWidth = "full" | "compact"
export type DockPosition = "top" | "bottom"
export type DockAlign = "left" | "center"

export const dockWidthAtom = persistedStringAtom("dockWidth", "full")
export const dockPositionAtom = persistedStringAtom("dockPosition", "bottom")
export const dockAlignAtom = persistedStringAtom("dockAlign", "center")

// Ephemeral view state — resets per page load.
export const dockHiddenAtom = ephemeralAtom(false)
export const sidebarOpenAtom = ephemeralAtom(false)
export const navOpenAtom = ephemeralAtom(false)
export const navScrollPositionAtom = ephemeralAtom(0)
export const notepadOpenAtom = ephemeralAtom(false)
export const eli5PopupOpenAtom = ephemeralAtom(false)
export const adminPopupOpenAtom = ephemeralAtom(false)
export const glossaryListOpenAtom = ephemeralAtom(false)
export const activeSidebarTabAtom = ephemeralAtom<"assistant" | "settings">("assistant")
export const activeGlossaryTabAtom = ephemeralAtom<"page" | "book">("page")
export const activeNavTabAtom = persistedStringAtom("navActiveTab", "toc")

/**
 * Which dock NavigationMenu panel is currently open. `null` = closed.
 * External components (e.g. GlossaryTermPopover) write here to open a
 * specific panel programmatically.
 */
export type DockMenuValue =
  | "toc"
  | "glossary"
  | "audio"
  | "language"
  | "settings"
  | ""
export const dockMenuValueAtom = persistedStringAtom("dockMenuValue", "")

// Selected glossary term currently shown in the details pane (null = list view).
export const selectedGlossaryTermAtom = ephemeralAtom<string | null>(null)

/**
 * Persisted top-left position of the floating sign-language video. `null` means
 * "use the default bottom-left placement". Survives page navigation so the
 * window stays where the user dragged it.
 */
export interface SlVideoPosition {
  x: number
  y: number
}
export const slVideoPositionAtom = persistedJsonAtom<SlVideoPosition | null>(
  "slVideoPosition",
  null,
)
