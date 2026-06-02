import { describe, it, expect } from "vitest";
import { _testing } from "../extract.js";

const { restyleCoincidentVectorText } = _testing;

type Para = Parameters<typeof restyleCoincidentVectorText>[0][number];
type Op = Parameters<typeof restyleCoincidentVectorText>[1][number];

const bb = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });

// paragraph at top=100, lineHeight=20 → baseline 120
const para = (segs: { text: string; style?: Record<string, string> }[]): Para =>
  ({ top: 100, left: 50, lineHeight: 20, text: segs.map((s) => s.text).join(""), segments: segs }) as unknown as Para;

const textOp = (seqno: number, runes: string, x: number, box: ReturnType<typeof bb>): Op =>
  ({
    seqno,
    kind: "fillText",
    bbox: box,
    glyphs: [...runes].map((r, i) => ({ rune: r, x: x + i, y: 120 })),
  }) as unknown as Op;

const pathOp = (
  seqno: number,
  kind: "fillPath" | "strokePath",
  geom: ReturnType<typeof bb>,
  color: string,
  strokeWidth?: number,
): Op =>
  ({ seqno, kind, bbox: geom, geomBbox: geom, color, alpha: 1, strokeWidth }) as unknown as Op;

describe("restyleCoincidentVectorText", () => {
  it("stroke-role: keeps the run's fill colour, adds faithful text-stroke from the PDF stroke", () => {
    const segs = [
      { text: "Look at the ", style: { color: "#000000" } },
      { text: "white", style: { color: "#ffffff" } },
    ];
    const p = para(segs);
    // segBox is now derived from the run's own glyph x-extent (not the
    // whole op box). "white" glyphs sit at x=200..204; the stroke vector
    // sits within that run's box.
    const ops: Op[] = [
      textOp(4, "Look at the ", 50, bb(50, 100, 180, 120)),
      textOp(10, "white", 200, bb(200, 100, 320, 120)),
      pathOp(5, "strokePath", bb(201, 102, 215, 118), "#000000", 4),
    ];
    const { consumed } = restyleCoincidentVectorText([p], ops);
    expect(segs[1].style).toMatchObject({
      color: "#ffffff",
      "-webkit-text-stroke": "4px #000000",
      "paint-order": "stroke fill",
    });
    expect(segs[0].style).toEqual({ color: "#000000" }); // untouched
    expect([...consumed]).toEqual([5]);
  });

  it("fill-role: recolours the shim run to the vector fill colour, no stroke", () => {
    const segs = [{ text: "h", style: { color: "#ffffff" } }];
    const p = para(segs);
    const ops: Op[] = [
      textOp(10, "h", 60, bb(60, 100, 74, 120)),
      pathOp(5, "fillPath", bb(61, 103, 73, 117), "#000000"),
    ];
    restyleCoincidentVectorText([p], ops);
    expect(segs[0].style).toEqual({ color: "#000000" });
    expect(segs[0].style!["-webkit-text-stroke"]).toBeUndefined();
  });

  it("mixed fill+stroke: adopts fill colour and adds the stroke", () => {
    const segs = [{ text: "A", style: { color: "#ffffff" } }];
    const p = para(segs);
    const ops: Op[] = [
      textOp(9, "A", 60, bb(60, 100, 80, 120)),
      pathOp(5, "fillPath", bb(61, 102, 79, 118), "#112233"),
      pathOp(6, "strokePath", bb(60, 101, 80, 119), "#445566", 2),
    ];
    restyleCoincidentVectorText([p], ops);
    expect(segs[0].style).toMatchObject({
      color: "#112233",
      "-webkit-text-stroke": "2px #445566",
      "paint-order": "stroke fill",
    });
  });

  it("colour disagreement → faithful no-op, nothing consumed", () => {
    const segs = [{ text: "x", style: { color: "#ffffff" } }];
    const p = para(segs);
    const ops: Op[] = [
      textOp(9, "x", 60, bb(60, 100, 80, 120)),
      pathOp(5, "fillPath", bb(61, 102, 70, 118), "#aaaaaa"),
      pathOp(6, "fillPath", bb(70, 102, 79, 118), "#555555"),
    ];
    const { consumed } = restyleCoincidentVectorText([p], ops);
    expect(segs[0].style).toEqual({ color: "#ffffff" });
    expect(consumed.size).toBe(0);
  });

  it("path op outside the run box is not attributed to it", () => {
    const segs = [{ text: "y", style: { color: "#ffffff" } }];
    const p = para(segs);
    const ops: Op[] = [
      textOp(9, "y", 60, bb(60, 100, 80, 120)),
      pathOp(5, "fillPath", bb(400, 400, 420, 420), "#000000"),
    ];
    const { consumed } = restyleCoincidentVectorText([p], ops);
    expect(segs[0].style).toEqual({ color: "#ffffff" });
    expect(consumed.size).toBe(0);
  });

  it("matches a run split across multiple coalesced ops (glyph alignment)", () => {
    // A uniform-style heading is one coalesced op spanning many segments;
    // here the run's glyphs arrive via two ops. The two-pointer glyph
    // alignment still resolves the run's box and consumes its vector.
    const segs = [{ text: "white", style: { color: "#ffffff" } }];
    const p = para(segs);
    const ops: Op[] = [
      textOp(9, "whi", 60, bb(60, 100, 90, 120)),
      textOp(10, "te", 90, bb(90, 100, 110, 120)),
      pathOp(5, "strokePath", bb(61, 102, 100, 118), "#000000", 3),
    ];
    const { consumed } = restyleCoincidentVectorText([p], ops);
    expect(segs[0].style).toMatchObject({
      color: "#ffffff",
      "-webkit-text-stroke": "3px #000000",
    });
    expect([...consumed]).toEqual([5]);
  });
});
