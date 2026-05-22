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
  "layout",
  "sizing",
  "spacing",
  "typography",
  "appearance",
  "borders",
  "imageFit",
]

const VISIBLE_SECTIONS: Record<ElementType, ReadonlySet<SectionKey>> = {
  text: new Set(["typography", "appearance", "spacing", "sizing"]),
  image: new Set(["imageFit", "sizing", "spacing", "borders", "appearance"]),
  container: new Set([
    "layout",
    "spacing",
    "sizing",
    "appearance",
    "borders",
    "typography",
  ]),
  interactive: new Set([
    "typography",
    "appearance",
    "spacing",
    "sizing",
    "layout",
    "borders",
  ]),
  list: new Set(["typography", "spacing", "layout", "sizing", "appearance"]),
  media: new Set(["imageFit", "sizing", "spacing", "borders", "appearance"]),
}

export function isSectionVisible(
  type: ElementType,
  section: SectionKey
): boolean {
  return VISIBLE_SECTIONS[type].has(section)
}

export function getVisibleSections(type: ElementType): SectionKey[] {
  return ALL_SECTION_KEYS.filter((k) => VISIBLE_SECTIONS[type].has(k))
}
