/* eslint-disable lingui/no-unlocalized-strings -- Tailwind class identifiers, not user copy */

import type { ClassMap } from "./types"
import { makeColorClassMap } from "./_color"

export const backgroundColorClassMap = makeColorClassMap("bg")

// `opacity-{N}` token where N is on the v3 scale (0/5/10/.../100) or an
// arbitrary `opacity-[0.5]` fraction. Internal value is the percentage.
export const opacityClassMap: ClassMap<number> = {
  matches: (cls) => /^opacity-(\d+|\[[\d.]+\])$/.test(cls),
  fromClasses(classes) {
    let last: number | null = null
    for (const cls of classes) {
      const m = cls.match(/^opacity-(.+)$/)
      if (!m) continue
      const suffix = m[1]
      const arbitrary = suffix.match(/^\[([\d.]+)\]$/)
      if (arbitrary) {
        const n = Number(arbitrary[1])
        if (Number.isFinite(n)) last = n <= 1 ? n * 100 : n
      } else {
        const n = Number(suffix)
        if (Number.isFinite(n)) last = n
      }
    }
    return last
  },
  toClasses(value) {
    if (value === 100) return []
    if (Number.isInteger(value) && value % 5 === 0) return [`opacity-${value}`]
    return [`opacity-[${value / 100}]`]
  },
}

const SHADOW_VALUES = new Set(["none", "sm", "md", "lg", "xl", "2xl", "inner"])

// `shadow` (bare = DEFAULT), `shadow-{size}`, or `shadow-none`. Skips
// `shadow-{color}-{shade}` (separate property, left untouched).
export const shadowClassMap: ClassMap<string> = {
  matches: (cls) => /^shadow(?:-(none|sm|md|lg|xl|2xl|inner))?$/.test(cls),
  fromClasses(classes) {
    let last: string | null = null
    for (const cls of classes) {
      if (cls === "shadow") last = "DEFAULT"
      else {
        const m = cls.match(/^shadow-(.+)$/)
        if (m && SHADOW_VALUES.has(m[1])) last = m[1]
      }
    }
    return last
  },
  toClasses(value) {
    if (!value || value === "none") return []
    if (value === "DEFAULT") return ["shadow"]
    if (SHADOW_VALUES.has(value)) return [`shadow-${value}`]
    return []
  },
}
