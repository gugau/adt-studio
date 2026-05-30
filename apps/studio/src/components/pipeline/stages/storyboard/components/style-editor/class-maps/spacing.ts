/* eslint-disable lingui/no-unlocalized-strings -- Tailwind class identifiers, not user copy */

import type { BoxValue } from "../controls/BoxInput"
import type { ClassMap } from "./types"

// Tailwind v3.4 / v4 default spacing scale, px ↔ token. Off-scale values
// fall back to arbitrary classes (`p-[13px]`).
const SPACING_TOKENS: ReadonlyArray<readonly [number, string]> = [
  [0, "0"],
  [2, "0.5"],
  [4, "1"],
  [6, "1.5"],
  [8, "2"],
  [10, "2.5"],
  [12, "3"],
  [14, "3.5"],
  [16, "4"],
  [20, "5"],
  [24, "6"],
  [28, "7"],
  [32, "8"],
  [36, "9"],
  [40, "10"],
  [44, "11"],
  [48, "12"],
  [56, "14"],
  [64, "16"],
  [80, "20"],
  [96, "24"],
  [112, "28"],
  [128, "32"],
  [144, "36"],
  [160, "40"],
  [176, "44"],
  [192, "48"],
  [208, "52"],
  [224, "56"],
  [240, "60"],
  [256, "64"],
  [288, "72"],
  [320, "80"],
  [384, "96"],
]

const PX_TO_TOKEN = new Map<number, string>(SPACING_TOKENS)
const TOKEN_TO_PX = new Map<string, number>(
  SPACING_TOKENS.map(([px, token]) => [token, px])
)

function pxToToken(px: number): string {
  const exact = PX_TO_TOKEN.get(px)
  if (exact !== undefined) return exact
  return `[${px}px]`
}

function tokenToPx(token: string): number | null {
  const fromTable = TOKEN_TO_PX.get(token)
  if (fromTable !== undefined) return fromTable
  // Arbitrary [Npx] / [Nrem]; BoxInput only deals in px so other units bail.
  const arbitrary = token.match(/^\[([\d.]+)(px|rem)\]$/)
  if (!arbitrary) return null
  const n = Number(arbitrary[1])
  if (!Number.isFinite(n)) return null
  return arbitrary[2] === "rem" ? n * 16 : n
}

// Builds a ClassMap that handles the full shorthand cascade:
//   `p-4 pt-2` reads as `{ t: 2, r: 4, b: 4, l: 4 }`
// and writes the most efficient form (single shorthand → axis pair → 4 sides).
function makeBoxClassMap(prefix: "p" | "m"): ClassMap<BoxValue> {
  const matchRegex = new RegExp(`^${prefix}([xytrbl]?)-(.+)$`)

  return {
    matches(cls) {
      return matchRegex.test(cls)
    },

    fromClasses(classes) {
      let result: BoxValue | null = null
      for (const cls of classes) {
        const m = cls.match(matchRegex)
        if (!m) continue
        const [, side, token] = m
        const px = tokenToPx(token)
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
        return [`${prefix}-${pxToToken(t)}`]
      }
      if (t === b && l === r) {
        return [`${prefix}x-${pxToToken(l)}`, `${prefix}y-${pxToToken(t)}`]
      }
      return [
        `${prefix}t-${pxToToken(t)}`,
        `${prefix}r-${pxToToken(r)}`,
        `${prefix}b-${pxToToken(b)}`,
        `${prefix}l-${pxToToken(l)}`,
      ]
    },
  }
}

export const paddingClassMap: ClassMap<BoxValue> = makeBoxClassMap("p")
export const marginClassMap: ClassMap<BoxValue> = makeBoxClassMap("m")

/** Pixel values of the Tailwind spacing scale, in ascending order.
 *  Consumed by BoxInput's `scale` prop to constrain padding/margin inputs. */
export const SPACING_SCALE_PX: ReadonlyArray<number> = SPACING_TOKENS.map(
  ([px]) => px
)
