import type { ClassMap } from "./types"

const OBJECT_FIT_VALUES = ["cover", "contain", "fill", "none", "scale-down"]

export const objectFitClassMap: ClassMap<string> = {
  matches: (cls) => /^object-(cover|contain|fill|none|scale-down)$/.test(cls),
  fromClasses(classes) {
    let last: string | null = null
    for (const cls of classes) {
      const m = cls.match(/^object-(.+)$/)
      if (m && OBJECT_FIT_VALUES.includes(m[1])) last = m[1]
    }
    return last
  },
  toClasses(value) {
    if (!OBJECT_FIT_VALUES.includes(value)) return []
    return [`object-${value}`]
  },
}

const OBJECT_POSITION_VALUES = [
  "center",
  "top",
  "bottom",
  "left",
  "right",
  "left-top",
  "left-bottom",
  "right-top",
  "right-bottom",
]

export const objectPositionClassMap: ClassMap<string> = {
  matches: (cls) =>
    /^object-(center|top|bottom|left|right|left-top|left-bottom|right-top|right-bottom)$/.test(
      cls
    ),
  fromClasses(classes) {
    let last: string | null = null
    for (const cls of classes) {
      const m = cls.match(/^object-(.+)$/)
      if (m && OBJECT_POSITION_VALUES.includes(m[1])) last = m[1]
    }
    return last
  },
  toClasses(value) {
    if (!OBJECT_POSITION_VALUES.includes(value)) return []
    return [`object-${value}`]
  },
}
