/* eslint-disable lingui/no-unlocalized-strings -- Tailwind class identifiers, not user copy */

import type { ClassMap } from "./types"

const COLOR_KEYWORDS = "white|black|transparent|current|inherit"

/**
 * Build a color class map for a given prefix (`text`, `bg`, `border`).
 * Reads tokens (`{prefix}-violet-500`), keywords (`{prefix}-white`), and
 * arbitrary hex (`{prefix}-[#abc123]`); writes token form when the value is
 * a Tailwind name and arbitrary `[hex]` when the value is a `#` literal.
 */
export function makeColorClassMap(prefix: string): ClassMap<string> {
  const regex = new RegExp(
    `^${prefix}-(${COLOR_KEYWORDS}|[a-z]+-\\d+|\\[#[0-9a-fA-F]{3,8}\\])$`
  )

  return {
    matches: (cls) => regex.test(cls),
    fromClasses(classes) {
      let last: string | null = null
      for (const cls of classes) {
        const m = cls.match(regex)
        if (!m) continue
        const captured = m[1]
        const hex = captured.match(/^\[(#[0-9a-fA-F]{3,8})\]$/)
        last = hex ? hex[1] : captured
      }
      return last
    },
    toClasses(value) {
      if (!value) return []
      if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return [`${prefix}-[${value}]`]
      return [`${prefix}-${value}`]
    },
  }
}
