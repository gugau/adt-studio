/* eslint-disable lingui/no-unlocalized-strings -- Tailwind class identifiers, not user copy */

import type { UnitValue } from "../controls/UnitInput"
import type { ClassMap } from "./types"

// Tailwind v3.4 / v4 default spacing scale. Width/height tokens reuse it
// (`w-4` is the same 16px as `p-4`).
const SPACING_TOKENS: ReadonlyArray<readonly [number, string]> = [
  [0, "0"], [2, "0.5"], [4, "1"], [6, "1.5"], [8, "2"], [10, "2.5"],
  [12, "3"], [14, "3.5"], [16, "4"], [20, "5"], [24, "6"], [28, "7"],
  [32, "8"], [36, "9"], [40, "10"], [44, "11"], [48, "12"], [56, "14"],
  [64, "16"], [80, "20"], [96, "24"], [112, "28"], [128, "32"], [144, "36"],
  [160, "40"], [176, "44"], [192, "48"], [208, "52"], [224, "56"], [240, "60"],
  [256, "64"], [288, "72"], [320, "80"], [384, "96"],
]
const PX_TO_TOKEN = new Map<number, string>(SPACING_TOKENS)
const TOKEN_TO_PX = new Map<string, number>(
  SPACING_TOKENS.map(([px, token]) => [token, px])
)

function makeDimensionClassMap(
  prefix: string,
  keywordUnits: ReadonlyArray<string>
): ClassMap<UnitValue> {
  const matchRegex = new RegExp(`^${prefix.replace(/-/g, "\\-")}-(.+)$`)

  return {
    matches(cls) {
      return matchRegex.test(cls)
    },

    fromClasses(classes) {
      let last: UnitValue | null = null
      for (const cls of classes) {
        const m = cls.match(matchRegex)
        if (!m) continue
        const parsed = parseSuffix(m[1], keywordUnits)
        if (parsed) last = parsed
      }
      return last
    },

    toClasses(value) {
      // Keyword units (`auto`, `none`) are CSS keywords, not lengths.
      if (keywordUnits.includes(value.unit)) {
        return [`${prefix}-${value.unit}`]
      }
      // Empty value commits as 0 so toggling auto → px doesn't bounce back to
      // auto when nothing has been typed yet.
      const raw = value.value.trim() === "" ? "0" : value.value
      const n = parseFloat(raw)
      if (!Number.isFinite(n)) return []
      if (value.unit === "px") {
        const token = PX_TO_TOKEN.get(n)
        if (token !== undefined) return [`${prefix}-${token}`]
        return [`${prefix}-[${n}px]`]
      }
      if (value.unit === "%") {
        return [`${prefix}-[${n}%]`]
      }
      return []
    },
  }
}

// Read path stays tolerant of every Tailwind shape the AI might generate so
// pre-existing classes round-trip; the write path emits only token-or-arbitrary
// to match what the spacing maps already do.
function parseSuffix(
  suffix: string,
  keywordUnits: ReadonlyArray<string>
): UnitValue | null {
  if (keywordUnits.includes(suffix)) {
    return { value: suffix, unit: suffix }
  }
  if (suffix === "full") {
    return { value: "100", unit: "%" }
  }
  const px = TOKEN_TO_PX.get(suffix)
  if (px !== undefined) {
    return { value: String(px), unit: "px" }
  }
  // Read fractions even though we never write them, so AI-generated `w-1/2`
  // shows correctly in the inspector.
  const fraction = suffix.match(/^([0-9]+)\/([0-9]+)$/)
  if (fraction) {
    const num = Number(fraction[1])
    const den = Number(fraction[2])
    if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
      return { value: String(round2((num / den) * 100)), unit: "%" }
    }
  }
  const arbitrary = suffix.match(/^\[([\d.]+)(px|rem|%)\]$/)
  if (arbitrary) {
    const n = Number(arbitrary[1])
    if (!Number.isFinite(n)) return null
    if (arbitrary[2] === "rem") return { value: String(n * 16), unit: "px" }
    return { value: String(n), unit: arbitrary[2] }
  }
  return null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export const widthClassMap = makeDimensionClassMap("w", ["auto"])
export const heightClassMap = makeDimensionClassMap("h", ["auto"])
export const minWidthClassMap = makeDimensionClassMap("min-w", ["auto"])
export const minHeightClassMap = makeDimensionClassMap("min-h", ["auto"])
export const maxWidthClassMap = makeDimensionClassMap("max-w", ["none"])
export const maxHeightClassMap = makeDimensionClassMap("max-h", ["none"])
