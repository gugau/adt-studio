import { describe, it, expect } from "vitest";
import { _testing } from "../extract.js";

const { parseStrokeInkExtent, computeGroupInkBbox } = _testing;

// computeGroupInkBbox only reads `.bbox` and `.svgElement`; the other
// ShapeInfo fields are irrelevant to the ink-extent math.
const shape = (bbox: [number, number, number, number], svgElement: string) =>
  ({ bbox, svgElement }) as unknown as Parameters<typeof computeGroupInkBbox>[0][number];

describe("parseStrokeInkExtent", () => {
  it("returns 0 for a fill-only path (no stroke)", () => {
    expect(parseStrokeInkExtent('<path d="M0 0H10V10Z" fill="#fff"/>')).toBe(0);
  });

  it('returns 0 for stroke="none" / "transparent"', () => {
    expect(parseStrokeInkExtent('<path stroke="none" stroke-width="4"/>')).toBe(0);
    expect(parseStrokeInkExtent('<path stroke="transparent" stroke-width="4"/>')).toBe(0);
  });

  it("returns half the stroke width when stroked, untransformed", () => {
    expect(parseStrokeInkExtent('<path stroke="#000" stroke-width="3"/>')).toBe(1.5);
  });

  it("defaults stroke-width to 1 (SVG default) when stroke is set but width omitted", () => {
    expect(parseStrokeInkExtent('<path stroke="#000"/>')).toBe(0.5);
  });

  it("scales stroke-width by the larger axis scale of the transform matrix", () => {
    // matrix(2 0 0 3 0 0): sx=2, sy=3 → larger scale 3; half = 4*3/2 = 6
    const e = '<path stroke="#000" stroke-width="4" transform="matrix(2 0 0 3 0 0)"/>';
    expect(parseStrokeInkExtent(e)).toBe(6);
  });

  it("uses the rotation-inclusive column norm for skewed matrices", () => {
    // matrix(3 4 0 1 ...): hypot(3,4)=5, hypot(0,1)=1 → scale 5; half = 2*5/2 = 5
    const e = '<path stroke="#000" stroke-width="2" transform="matrix(3 4 0 1 10 10)"/>';
    expect(parseStrokeInkExtent(e)).toBe(5);
  });

  it("applies the miter limit only when stroke-linejoin is explicitly miter", () => {
    const round = '<path stroke="#000" stroke-width="2" stroke-linejoin="round"/>';
    expect(parseStrokeInkExtent(round)).toBe(1); // half only

    const miter =
      '<path stroke="#000" stroke-width="2" stroke-linejoin="miter" stroke-miterlimit="4"/>';
    expect(parseStrokeInkExtent(miter)).toBe(4); // half(1) * miterlimit(4)

    // Omitted linejoin must NOT assume the SVG default (miter) — that would
    // balloon every round-joined bubble. Half only.
    const omitted = '<path stroke="#000" stroke-width="2"/>';
    expect(parseStrokeInkExtent(omitted)).toBe(1);
  });

  it("defaults miterlimit to 4 when linejoin is miter but limit omitted", () => {
    const e = '<path stroke="#000" stroke-width="2" stroke-linejoin="miter"/>';
    expect(parseStrokeInkExtent(e)).toBe(4);
  });
});

describe("computeGroupInkBbox", () => {
  it("expands each shape's geometry bbox by its stroke half-width + AA guard", () => {
    // Geometry [10,10,50,50], stroke-width 4 (half 2) + AA guard 1 on each
    // side → [10-3, 10-3, 50+3, 50+3].
    const g = [shape([10, 10, 50, 50], '<path stroke="#000" stroke-width="4"/>')];
    expect(computeGroupInkBbox(g, 1, 1)).toEqual([7, 7, 53, 53]);
  });

  it("does not stroke-expand fill-only shapes (AA guard still applied)", () => {
    const g = [shape([0, 0, 20, 20], '<path d="M0 0H20V20Z" fill="#abc"/>')];
    expect(computeGroupInkBbox(g, 0.5, 0.5)).toEqual([-0.5, -0.5, 20.5, 20.5]);
  });

  it("unions per-shape ink boxes (a thin stroked shape can dominate one edge)", () => {
    const g = [
      shape([10, 10, 30, 30], '<path d="..." fill="#fff"/>'), // fill only
      shape([28, 10, 30, 30], '<path stroke="#000" stroke-width="10"/>'), // half 5
    ];
    // fill box [10,10,30,30]; stroked box [28-5,10-5,30+5,30+5]=[23,5,35,35].
    // union → [10, 5, 35, 35].
    expect(computeGroupInkBbox(g, 0, 0)).toEqual([10, 5, 35, 35]);
  });

  it("uses per-axis AA guards (non-uniform page scale)", () => {
    const g = [shape([0, 0, 10, 10], '<path d="..." fill="#000"/>')];
    expect(computeGroupInkBbox(g, 2, 0.25)).toEqual([-2, -0.25, 12, 10.25]);
  });
});
