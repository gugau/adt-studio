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

const SECTION_VISIBILITY: Record<ElementType, ReadonlySet<SectionKey>> = {
  text: new Set<SectionKey>([
    "typography",
    "appearance",
    "spacing",
    "sizing",
  ]),
  image: new Set<SectionKey>([
    "appearance",
    "spacing",
    "sizing",
    "borders",
    "imageFit",
  ]),
  container: new Set<SectionKey>([
    "typography",
    "appearance",
    "spacing",
    "sizing",
    "layout",
    "borders",
  ]),
  interactive: new Set<SectionKey>([
    "typography",
    "appearance",
    "spacing",
    "sizing",
    "layout",
    "borders",
  ]),
  list: new Set<SectionKey>([
    "typography",
    "appearance",
    "spacing",
    "sizing",
    "layout",
  ]),
  media: new Set<SectionKey>([
    "appearance",
    "spacing",
    "sizing",
    "borders",
    "imageFit",
  ]),
}

export function isSectionVisible(
  type: ElementType,
  section: SectionKey
): boolean {
  return SECTION_VISIBILITY[type].has(section)
}

export function getVisibleSections(type: ElementType): SectionKey[] {
  return ALL_SECTION_KEYS.filter((s) => isSectionVisible(type, s))
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
