import { describe, it, expect } from "vitest";
import { _testing } from "../extract.js";

const { stampFigureSeqnosFromOps } = _testing;

// Minimal shapes of the real types; stampFigureSeqnosFromOps only reads
// `shapeGeomBoxes` / `streamSeqno` on figures and `kind`/`seqno`/`geomBbox`
// on ops.
type Fig = Parameters<typeof stampFigureSeqnosFromOps>[0][number];
type Op = Parameters<typeof stampFigureSeqnosFromOps>[1][number];

const bb = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });
const fillOp = (seqno: number, g: ReturnType<typeof bb>): Op =>
  ({ seqno, kind: "fillPath", bbox: g, geomBbox: g }) as unknown as Op;
const strokeOp = (
  seqno: number,
  geom: ReturnType<typeof bb>,
  rendered: ReturnType<typeof bb>,
): Op => ({ seqno, kind: "strokePath", bbox: rendered, geomBbox: geom }) as unknown as Op;
const fig = (boxes: [number, number, number, number][] | undefined, fallback: number): Fig =>
  ({ shapeGeomBoxes: boxes, streamSeqno: fallback }) as unknown as Fig;

describe("stampFigureSeqnosFromOps — geometry identity", () => {
  it("ties a stroked op to its figure by geometry bbox (rendered bbox spills outside)", () => {
    // The bug case: a strokePath's rendered bbox is larger than the figure's
    // geometry box (stroke inflation), so aggregate containment failed and the
    // figure kept its unreliable SVG-order fallback (0). geomBbox matches.
    const f = fig([[318, 452, 461, 509]], /* SVG-order fallback */ 0);
    const ops: Op[] = [
      fillOp(1, bb(-1, 43, 794, 1225)), // full-page background
      strokeOp(5, bb(318, 452, 461, 509), bb(310, 444, 468, 516)), // "white" outline
    ];
    stampFigureSeqnosFromOps([f], ops);
    expect(f.streamSeqno).toBe(5); // not 0 — drawn after the bg (seqno 1)
  });

  it("uses the minimum matching op seqno across a multi-shape figure", () => {
    const f = fig([[10, 10, 20, 20], [30, 30, 50, 50]], 99);
    const ops: Op[] = [
      strokeOp(8, bb(30, 30, 50, 50), bb(28, 28, 52, 52)),
      fillOp(3, bb(10, 10, 20, 20)),
      fillOp(40, bb(999, 999, 1000, 1000)), // unrelated
    ];
    stampFigureSeqnosFromOps([f], ops);
    expect(f.streamSeqno).toBe(3);
  });

  it("tolerates sub-pixel rounding (SVG export rounds to 2 decimals)", () => {
    const f = fig([[100, 200, 140, 260]], 0);
    stampFigureSeqnosFromOps([f], [fillOp(7, bb(100.4, 199.7, 140.3, 260.5))]);
    expect(f.streamSeqno).toBe(7);
  });

  it("does not match a different path that merely overlaps the figure region", () => {
    const f = fig([[100, 100, 200, 200]], 42);
    // An op whose geometry is a big page rect overlapping the figure but with
    // a clearly different extent must NOT be attributed to it.
    stampFigureSeqnosFromOps([f], [fillOp(2, bb(0, 0, 800, 1200))]);
    expect(f.streamSeqno).toBe(42); // unchanged fallback
  });

  it("keeps the SVG-order fallback when the figure has no shape boxes", () => {
    const f = fig(undefined, 13);
    stampFigureSeqnosFromOps([f], [fillOp(1, bb(0, 0, 10, 10))]);
    expect(f.streamSeqno).toBe(13);
  });
});
