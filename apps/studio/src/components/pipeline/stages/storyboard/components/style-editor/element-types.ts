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
  | "color"
  | "spacing"
  | "sizing"
  | "layout"
  | "borders"
  | "imageFit"
  | "effects"

export const ALL_SECTION_KEYS: ReadonlyArray<SectionKey> = [
  "typography",
  "color",
  "spacing",
  "sizing",
  "layout",
  "borders",
  "imageFit",
  "effects",
]

const SECTION_VISIBILITY: Record<ElementType, ReadonlySet<SectionKey>> = {
  text: new Set<SectionKey>(["typography", "color", "spacing", "sizing"]),
  image: new Set<SectionKey>([
    "color",
    "spacing",
    "sizing",
    "borders",
    "imageFit",
    "effects",
  ]),
  container: new Set<SectionKey>([
    "typography",
    "color",
    "spacing",
    "sizing",
    "layout",
    "borders",
    "effects",
  ]),
  interactive: new Set<SectionKey>([
    "typography",
    "color",
    "spacing",
    "sizing",
    "layout",
    "borders",
    "effects",
  ]),
  list: new Set<SectionKey>([
    "typography",
    "color",
    "spacing",
    "sizing",
    "layout",
  ]),
  media: new Set<SectionKey>([
    "spacing",
    "sizing",
    "borders",
    "imageFit",
    "effects",
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
