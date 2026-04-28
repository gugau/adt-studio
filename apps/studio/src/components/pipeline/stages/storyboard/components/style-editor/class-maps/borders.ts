/* eslint-disable lingui/no-unlocalized-strings -- Tailwind class identifiers, not user copy */

import type { BoxValue } from "../controls/BoxInput"
import type { ClassMap } from "./types"

// border-width: bare `border` is 1px, plus `border-{0,2,4,8}` and arbitrary.
// Side variants are `border-{t,r,b,l}` and axis pairs are `border-{x,y}`.
const BORDER_WIDTH_REGEX =
  /^border(?:-([xytrbl]))?(?:-(\d+|\[[\d.]+(?:px|rem)\]))?$/

function parseBorderSuffix(s: string): number | null {
  const n = Number(s)
  if (Number.isFinite(n)) return n
  const arbitrary = s.match(/^\[([\d.]+)(px|rem)\]$/)
  if (!arbitrary) return null
  const v = Number(arbitrary[1])
  if (!Number.isFinite(v)) return null
  return arbitrary[2] === "rem" ? v * 16 : v
}

function borderSizeToClass(prefix: string, px: number): string {
  // Tailwind's named border widths land on 0/1/2/4/8 px exactly.
  if (px === 1 && prefix === "border") return "border"
  if (px === 1) return `${prefix}` // border-t / border-r / etc.
  if (px === 0 || px === 2 || px === 4 || px === 8) return `${prefix}-${px}`
  return `${prefix}-[${px}px]`
}

export const borderWidthClassMap: ClassMap<BoxValue> = {
  matches: (cls) => BORDER_WIDTH_REGEX.test(cls),
  fromClasses(classes) {
    let result: BoxValue | null = null
    for (const cls of classes) {
      const m = cls.match(BORDER_WIDTH_REGEX)
      if (!m) continue
      const side = m[1] ?? ""
      const size = m[2]
      const px = size === undefined ? 1 : parseBorderSuffix(size)
      if (px === null) continue
      if (!result) result = { t: 0, r: 0, b: 0, l: 0 }
      switch (side) {
        case "":
          result.t = px
          result.r = px
          result.b = px
          result.l = px
          break
        case "x":
          result.l = px
          result.r = px
          break
        case "y":
          result.t = px
          result.b = px
          break
        case "t":
          result.t = px
          break
        case "r":
          result.r = px
          break
        case "b":
          result.b = px
          break
        case "l":
          result.l = px
          break
      }
    }
    return result
  },
  toClasses(value) {
    const { t, r, b, l } = value
    if (t === r && r === b && b === l) {
      if (t === 0) return [] // no border at all
      return [borderSizeToClass("border", t)]
    }
    if (t === b && l === r) {
      const out: string[] = []
      if (l !== 0) out.push(borderSizeToClass("border-x", l))
      if (t !== 0) out.push(borderSizeToClass("border-y", t))
      return out
    }
    const out: string[] = []
    if (t !== 0) out.push(borderSizeToClass("border-t", t))
    if (r !== 0) out.push(borderSizeToClass("border-r", r))
    if (b !== 0) out.push(borderSizeToClass("border-b", b))
    if (l !== 0) out.push(borderSizeToClass("border-l", l))
    return out
  },
}

// border-radius: `rounded` (4px), `rounded-{none|sm|md|lg|xl|2xl|3xl|full}`,
// per-corner `rounded-{tl|tr|br|bl}-...`, arbitrary `rounded-[Npx]`.
const RADIUS_REGEX =
  /^rounded(?:-(tl|tr|br|bl|t|r|b|l))?(?:-(none|sm|md|lg|xl|2xl|3xl|full|\[[\d.]+(?:px|rem)\]))?$/

const RADIUS_TOKEN_TO_PX: Record<string, number> = {
  none: 0,
  sm: 2,
  md: 6,
  lg: 8,
  xl: 12,
  "2xl": 16,
  "3xl": 24,
  full: 9999,
}
const RADIUS_PX_TO_TOKEN: ReadonlyArray<readonly [number, string]> = [
  [0, "none"],
  [2, "sm"],
  [6, "md"],
  [8, "lg"],
  [12, "xl"],
  [16, "2xl"],
  [24, "3xl"],
  [9999, "full"],
]

function parseRadiusSize(s: string | undefined): number | null {
  if (s === undefined) return 4 // bare `rounded` = 4px
  const named = RADIUS_TOKEN_TO_PX[s]
  if (named !== undefined) return named
  const arbitrary = s.match(/^\[([\d.]+)(px|rem)\]$/)
  if (!arbitrary) return null
  const v = Number(arbitrary[1])
  if (!Number.isFinite(v)) return null
  return arbitrary[2] === "rem" ? v * 16 : v
}

function radiusToClass(prefix: string, px: number): string {
  if (px === 4) return prefix // bare `rounded` / `rounded-tl` / etc.
  for (const [matchPx, token] of RADIUS_PX_TO_TOKEN) {
    if (matchPx === px) return `${prefix}-${token}`
  }
  return `${prefix}-[${px}px]`
}

export const borderRadiusClassMap: ClassMap<BoxValue> = {
  matches: (cls) => RADIUS_REGEX.test(cls),
  fromClasses(classes) {
    let result: BoxValue | null = null
    for (const cls of classes) {
      const m = cls.match(RADIUS_REGEX)
      if (!m) continue
      const corner = m[1] ?? ""
      const px = parseRadiusSize(m[2])
      if (px === null) continue
      if (!result) result = { t: 0, r: 0, b: 0, l: 0 }
      // BoxValue corners variant: t→TL, r→TR, b→BR, l→BL.
      switch (corner) {
        case "":
          result.t = px
          result.r = px
          result.b = px
          result.l = px
          break
        case "tl":
          result.t = px
          break
        case "tr":
          result.r = px
          break
        case "br":
          result.b = px
          break
        case "bl":
          result.l = px
          break
        case "t":
          result.t = px
          result.r = px
          break
        case "r":
          result.r = px
          result.b = px
          break
        case "b":
          result.b = px
          result.l = px
          break
        case "l":
          result.l = px
          result.t = px
          break
      }
    }
    return result
  },
  toClasses(value) {
    const { t, r, b, l } = value
    if (t === r && r === b && b === l) {
      if (t === 0) return []
      return [radiusToClass("rounded", t)]
    }
    const out: string[] = []
    if (t !== 0) out.push(radiusToClass("rounded-tl", t))
    if (r !== 0) out.push(radiusToClass("rounded-tr", r))
    if (b !== 0) out.push(radiusToClass("rounded-br", b))
    if (l !== 0) out.push(radiusToClass("rounded-bl", l))
    return out
  },
}

// border-color: `border-{family}-{shade}`, `border-{keyword}` (white/black/
// transparent/current/inherit), or arbitrary `border-[#hex]`.
const BORDER_COLOR_REGEX =
  /^border-(white|black|transparent|current|inherit|[a-z]+-\d+|\[#[0-9a-fA-F]{3,8}\])$/

export const borderColorClassMap: ClassMap<string> = {
  matches: (cls) => BORDER_COLOR_REGEX.test(cls),
  fromClasses(classes) {
    let last: string | null = null
    for (const cls of classes) {
      const m = cls.match(BORDER_COLOR_REGEX)
      if (!m) continue
      const captured = m[1]
      // Arbitrary hex: strip the brackets so the value is a plain hex.
      const hex = captured.match(/^\[(#[0-9a-fA-F]{3,8})\]$/)
      last = hex ? hex[1] : captured
    }
    return last
  },
  toClasses(value) {
    if (!value) return []
    if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return [`border-[${value}]`]
    return [`border-${value}`]
  },
}
