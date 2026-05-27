import { describe, it, expect } from "vitest";
import mupdf from "mupdf";
import { recordPageStream } from "../page-stream-recorder.js";

/** Minimal one-page PDF: a red filled rect and a blue stroked rect with a
 *  known line width. Exercises the recorder's paint capture. */
function paintTestPdf(): Buffer {
  const doc = new mupdf.PDFDocument();
  const stream = `
q
1 0 0 rg
100 600 120 80 re f
Q
q
0 0 1 RG
7 w
300 600 120 80 re S
Q
`;
  const buf = new mupdf.Buffer();
  buf.writeLine(stream);
  const resources = doc.addObject(doc.newDictionary());
  doc.insertPage(-1, doc.addPage([0, 0, 612, 792], 0, resources, buf));
  return Buffer.from(doc.saveToBuffer("").asUint8Array());
}

describe("recorder paint capture", () => {
  const doc = mupdf.Document.openDocument(paintTestPdf(), "application/pdf");
  const ops = recordPageStream(doc.loadPage(0));
  const fill = ops.find((o) => o.kind === "fillPath");
  const stroke = ops.find((o) => o.kind === "strokePath");

  it("captures fill colour and alpha on fillPath", () => {
    expect(fill).toBeDefined();
    expect(fill!.color).toBe("#ff0000");
    expect(fill!.alpha).toBe(1);
    expect(fill!.strokeWidth).toBeUndefined();
  });

  it("captures stroke colour, alpha and CTM-scaled width on strokePath", () => {
    expect(stroke).toBeDefined();
    expect(stroke!.color).toBe("#0000ff");
    expect(stroke!.alpha).toBe(1);
    // Page CTM is unscaled, so width ≈ the PDF `7 w` line width.
    expect(stroke!.strokeWidth).toBeGreaterThan(0);
    expect(stroke!.strokeWidth).toBeCloseTo(7, 1);
  });

  it("strokePath bbox is stroke-inflated; geomBbox is geometry-only", () => {
    // The geometry rect is 120×80; the stroke (width 7) inflates the
    // rendered bbox by ~half the width on each side, geomBbox stays tight.
    const gW = stroke!.geomBbox.x1 - stroke!.geomBbox.x0;
    const bW = stroke!.bbox.x1 - stroke!.bbox.x0;
    expect(gW).toBeCloseTo(120, 0);
    expect(bW).toBeGreaterThan(gW);
  });
});
