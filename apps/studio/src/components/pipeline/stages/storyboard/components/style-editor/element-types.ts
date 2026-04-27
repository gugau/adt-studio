/* eslint-disable lingui/no-unlocalized-strings -- internal identifier keys, never displayed */

export type ElementType =
  | "text"
  | "image"
  | "container"
  | "interactive"
  | "list"
  | "media"

const INTERACTIVE_TAGS = new Set([
  "button",
  "input",
  "select",
  "textarea",
  "a",
  "label",
])
const LIST_TAGS = new Set(["ul", "ol", "li", "dl", "dt", "dd"])
const MEDIA_TAGS = new Set(["audio", "video"])

export interface ElementTypeInput {
  isImage: boolean
  isContainer: boolean
  tagName?: string
}

export function inferElementType({
  isImage,
  isContainer,
  tagName,
}: ElementTypeInput): ElementType {
  if (isImage) return "image"
  const tag = tagName?.toLowerCase()
  if (tag) {
    if (MEDIA_TAGS.has(tag)) return "media"
    if (INTERACTIVE_TAGS.has(tag)) return "interactive"
    if (LIST_TAGS.has(tag)) return "list"
  }
  if (isContainer) return "container"
  return "text"
}

export type SectionKey =
  | "typography"
  | "appearance"
  | "spacing"
  | "sizing"
  | "layout"
  | "borders"
  | "imageFit"

export const ALL_SECTION_KEYS: ReadonlyArray<SectionKey> = [
  "typography",
  "appearance",
  "spacing",
  "sizing",
  "layout",
  "borders",
  "imageFit",
]

/**
 * The ordered list of sections shown for each element type.
 * Order matters — sections render in this exact order in the sidebar.
 * Presence in the list means visible; absence means hidden.
 */
const SECTION_ORDER: Record<ElementType, ReadonlyArray<SectionKey>> = {
  text: ["typography", "appearance", "spacing", "sizing"],
  image: ["imageFit", "sizing", "spacing", "borders", "appearance"],
  container: [
    "layout",
    "spacing",
    "sizing",
    "appearance",
    "borders",
    "typography",
  ],
  interactive: [
    "typography",
    "appearance",
    "spacing",
    "sizing",
    "layout",
    "borders",
  ],
  list: ["typography", "spacing", "layout", "sizing", "appearance"],
  media: ["imageFit", "sizing", "spacing", "borders", "appearance"],
}

export function isSectionVisible(
  type: ElementType,
  section: SectionKey
): boolean {
  return SECTION_ORDER[type].includes(section)
}

export function getVisibleSections(type: ElementType): SectionKey[] {
  return [...SECTION_ORDER[type]]
}

const DEFAULT_OPEN_SECTIONS: Record<ElementType, ReadonlyArray<SectionKey>> = {
  text: ["typography"],
  image: ["imageFit", "sizing"],
  container: ["layout", "spacing"],
  interactive: ["typography", "layout"],
  list: ["typography", "layout"],
  media: ["sizing"],
}

export function getDefaultOpenSections(type: ElementType): SectionKey[] {
  const visible = new Set(getVisibleSections(type))
  return DEFAULT_OPEN_SECTIONS[type].filter((k) => visible.has(k))
}
