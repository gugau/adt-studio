import { describe, it, expect } from "vitest";
import { extractPdf } from "../extract.js";
import { createRasterOnlyTestPdf } from "./create-test-pdf.js";

describe("extractPdf — per-image bounds", () => {
  it("populates bounds on raster images with a PDF placement", async () => {
    // Test PDF places a 30x30 native image at (100, 300) scaled to 200x200pt
    // on a 612x792pt page. mupdf's preserve-images walker returns bboxes in
    // top-left page coordinates, so the expected y is 792 - 300 - 200 = 292.
    const pdfBuffer = createRasterOnlyTestPdf();
    const result = await extractPdf({ pdfBuffer });

    expect(result.pages).toHaveLength(1);
    const page = result.pages[0];
    expect(page.images.length).toBeGreaterThanOrEqual(1);

    const raster = page.images.find((img) => img.renderMethod === "raster");
    expect(raster).toBeDefined();
    expect(raster!.bounds).toBeDefined();
    expect(raster!.bounds!.x).toBeCloseTo(100, 0);
    expect(raster!.bounds!.y).toBeCloseTo(292, 0);
    expect(raster!.bounds!.width).toBeCloseTo(200, 0);
    expect(raster!.bounds!.height).toBeCloseTo(200, 0);
  });
});
