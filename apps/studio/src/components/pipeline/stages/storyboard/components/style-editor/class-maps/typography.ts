import type { ClassMap } from "./types"
import { makeColorClassMap } from "./_color"

const FONT_FAMILY_VALUES = ["sans", "serif", "mono"]

export const fontFamilyClassMap: ClassMap<string> = {
  matches: (cls) => /^font-(sans|serif|mono)$/.test(cls),
  fromClasses(classes) {
    let last: string | null = null
    for (const cls of classes) {
      const m = cls.match(/^font-(.+)$/)
      if (m && FONT_FAMILY_VALUES.includes(m[1])) last = m[1]
    }
    return last
  },
  toClasses(value) {
    if (!FONT_FAMILY_VALUES.includes(value)) return []
    return [`font-${value}`]
  },
}

const FONT_WEIGHT_VALUES = [
  "thin",
  "extralight",
  "light",
  "normal",
  "medium",
  "semibold",
  "bold",
  "extrabold",
  "black",
]

export const fontWeightClassMap: ClassMap<string> = {
  matches: (cls) =>
    /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.test(
      cls
    ),
  fromClasses(classes) {
    let last: string | null = null
    for (const cls of classes) {
      const m = cls.match(/^font-(.+)$/)
      if (m && FONT_WEIGHT_VALUES.includes(m[1])) last = m[1]
    }
    return last
  },
  toClasses(value) {
    if (!FONT_WEIGHT_VALUES.includes(value)) return []
    return [`font-${value}`]
  },
}

const FONT_SIZE_VALUES = [
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "7xl",
  "8xl",
  "9xl",
]

export const fontSizeClassMap: ClassMap<string> = {
  // `text-` with a known size token, or an arbitrary px/rem/em value. Stays
  // disjoint from text-color (`text-[#hex]`) and text-align (`text-left`).
  matches: (cls) =>
    /^text-(xs|sm|base|lg|xl|[2-9]xl|\[[\d.]+(?:px|rem|em)\])$/.test(cls),
  fromClasses(classes) {
    let last: string | null = null
    for (const cls of classes) {
      const m = cls.match(/^text-(.+)$/)
      if (!m) continue
      if (FONT_SIZE_VALUES.includes(m[1])) last = m[1]
    }
    return last
  },
  toClasses(value) {
    if (!FONT_SIZE_VALUES.includes(value)) return []
    return [`text-${value}`]
  },
}

const TEXT_ALIGN_VALUES = ["left", "center", "right", "justify", "start", "end"]

export const textAlignClassMap: ClassMap<string> = {
  matches: (cls) =>
    /^text-(left|center|right|justify|start|end)$/.test(cls),
  fromClasses(classes) {
    let last: string | null = null
    for (const cls of classes) {
      const m = cls.match(/^text-(.+)$/)
      if (m && TEXT_ALIGN_VALUES.includes(m[1])) last = m[1]
    }
    return last
  },
  toClasses(value) {
    if (!TEXT_ALIGN_VALUES.includes(value)) return []
    return [`text-${value}`]
  },
}

const LEADING_VALUES = ["none", "tight", "snug", "normal", "relaxed", "loose"]

export const lineHeightClassMap: ClassMap<string> = {
  matches: (cls) =>
    /^leading-(none|tight|snug|normal|relaxed|loose|\[[\d.]+\])$/.test(cls),
  fromClasses(classes) {
    let last: string | null = null
    for (const cls of classes) {
      const m = cls.match(/^leading-(.+)$/)
      if (!m) continue
      if (LEADING_VALUES.includes(m[1])) last = m[1]
    }
    return last
  },
  toClasses(value) {
    if (!LEADING_VALUES.includes(value)) return []
    return [`leading-${value}`]
  },
}

const DECOR_TOKENS = new Set([
  "italic",
  "not-italic",
  "underline",
  "line-through",
  "no-underline",
])

// Multi-select: any subset of {"italic","underline","strike"}.
export const textDecorationClassMap: ClassMap<string[]> = {
  matches: (cls) => DECOR_TOKENS.has(cls),
  fromClasses(classes) {
    const out: string[] = []
    for (const cls of classes) {
      if (cls === "italic") out.push("italic")
      else if (cls === "underline") out.push("underline")
      else if (cls === "line-through") out.push("strike")
    }
    return out.length > 0 ? out : null
  },
  toClasses(value) {
    const out: string[] = []
    if (value.includes("italic")) out.push("italic")
    if (value.includes("underline")) out.push("underline")
    if (value.includes("strike")) out.push("line-through")
    return out
  },
}

export const textColorClassMap = makeColorClassMap("text")
