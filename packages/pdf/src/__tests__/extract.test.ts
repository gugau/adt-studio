import { describe, it, expect } from "vitest";
import { deflateSync } from "zlib";
import mupdf from "mupdf";
import { extractPdf, extractPdfStream } from "../extract.js";
import { stitchPngsHorizontally, decodePng } from "../png-utils.js";
import { PNG } from "pngjs";

// Minimal valid PDF with one blank page (no content stream)
const MINIMAL_PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000052 00000 n
0000000101 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
178
%%EOF`;

/**
 * Create a valid PDF with a Form XObject (vector graphic) using mupdf.
 */
function createPdfWithVectorForm(): Buffer {
  const doc = new mupdf.PDFDocument();

  // Create a Form XObject with a simple rectangle
  const formDict = doc.newDictionary();
  formDict.put("Type", doc.newName("XObject"));
  formDict.put("Subtype", doc.newName("Form"));
  const bbox = doc.newArray();
  bbox.push(0);
  bbox.push(0);
  bbox.push(100);
  bbox.push(100);
  formDict.put("BBox", bbox);

  // Form content stream: draw a rectangle
  const formContent = "0 0 100 100 re S";
  const formObj = doc.addStream(formContent, formDict);

  // Create page resources with the form
  const resources = doc.newDictionary();
  const xobjects = doc.newDictionary();
  xobjects.put("MyForm", formObj);
  resources.put("XObject", xobjects);

  // Page content: invoke the form
  const pageContent = "q /MyForm Do Q";

  // Add the page - addPage creates the page object, insertPage adds it to the tree
  const pageObj = doc.addPage([0, 0, 612, 792], 0, resources, pageContent);
  doc.insertPage(-1, pageObj);

  // Save to buffer
  const output = doc.saveToBuffer("").asUint8Array();
  return Buffer.from(output);
}

// Two-page PDF
const TWO_PAGE_PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R 4 0 R]/Count 2>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj
4 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000052 00000 n
0000000102 00000 n
0000000169 00000 n
trailer<</Size 5/Root 1 0 R>>
startxref
236
%%EOF`;

describe("extractPdf", () => {
  it("extracts a single page from a minimal PDF", async () => {
    const pdfBuffer = Buffer.from(MINIMAL_PDF);
    const result = await extractPdf({ pdfBuffer });

    expect(result.totalPagesInPdf).toBe(1);
    expect(result.pages).toHaveLength(1);

    const page = result.pages[0];
    expect(page.pageNumber).toBe(1);
    expect(page.pageId).toBe("pg001");
    expect(page.text).toBe("");
    expect(page.pageImage).toBeDefined();
    expect(page.pageImage.buffer).toBeInstanceOf(Buffer);
    expect(page.pageImage.width).toBeGreaterThan(0);
    expect(page.pageImage.height).toBeGreaterThan(0);
    expect(page.pageImage.hash).toMatch(/^[a-f0-9]{16}$/);
    expect(page.images).toEqual([]);
  });

  it("extracts multiple pages", async () => {
    const pdfBuffer = Buffer.from(TWO_PAGE_PDF);
    const result = await extractPdf({ pdfBuffer });

    expect(result.totalPagesInPdf).toBe(2);
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].pageId).toBe("pg001");
    expect(result.pages[1].pageId).toBe("pg002");
  });

  it("respects startPage option", async () => {
    const pdfBuffer = Buffer.from(TWO_PAGE_PDF);
    const result = await extractPdf({ pdfBuffer, startPage: 2 });

    expect(result.totalPagesInPdf).toBe(2);
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].pageNumber).toBe(2);
    expect(result.pages[0].pageId).toBe("pg002");
  });

  it("respects endPage option", async () => {
    const pdfBuffer = Buffer.from(TWO_PAGE_PDF);
    const result = await extractPdf({ pdfBuffer, endPage: 1 });

    expect(result.totalPagesInPdf).toBe(2);
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].pageNumber).toBe(1);
  });

  it("respects both startPage and endPage options", async () => {
    const pdfBuffer = Buffer.from(TWO_PAGE_PDF);
    const result = await extractPdf({ pdfBuffer, startPage: 1, endPage: 1 });

    expect(result.totalPagesInPdf).toBe(2);
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].pageNumber).toBe(1);
  });

  it("calls progress callback for each page", async () => {
    const pdfBuffer = Buffer.from(TWO_PAGE_PDF);
    const progressCalls: { page: number; totalPages: number }[] = [];

    await extractPdf({ pdfBuffer }, (progress) => {
      progressCalls.push({ ...progress });
    });

    expect(progressCalls).toEqual([
      { page: 1, totalPages: 2 },
      { page: 2, totalPages: 2 },
    ]);
  });

  it("clamps endPage to actual page count", async () => {
    const pdfBuffer = Buffer.from(MINIMAL_PDF);
    const result = await extractPdf({ pdfBuffer, endPage: 100 });

    expect(result.totalPagesInPdf).toBe(1);
    expect(result.pages).toHaveLength(1);
  });

  it("returns empty pages array when startPage exceeds page count", async () => {
    const pdfBuffer = Buffer.from(MINIMAL_PDF);
    const result = await extractPdf({ pdfBuffer, startPage: 10 });

    expect(result.totalPagesInPdf).toBe(1);
    expect(result.pages).toHaveLength(0);
  });

  it("throws when startPage is not a finite integer", async () => {
    const pdfBuffer = Buffer.from(MINIMAL_PDF);
    await expect(extractPdf({ pdfBuffer, startPage: Number.NaN })).rejects.toThrow(
      "startPage must be an integer >= 1"
    );
    await expect(extractPdf({ pdfBuffer, startPage: 1.5 })).rejects.toThrow(
      "startPage must be an integer >= 1"
    );
  });

  it("throws when endPage is not a finite integer", async () => {
    const pdfBuffer = Buffer.from(MINIMAL_PDF);
    await expect(extractPdf({ pdfBuffer, endPage: Number.NaN })).rejects.toThrow(
      "endPage must be an integer >= 1"
    );
    await expect(extractPdf({ pdfBuffer, endPage: 0 })).rejects.toThrow(
      "endPage must be an integer >= 1"
    );
  });

  it("throws when endPage is less than startPage", async () => {
    const pdfBuffer = Buffer.from(TWO_PAGE_PDF);
    await expect(extractPdf({ pdfBuffer, startPage: 2, endPage: 1 })).rejects.toThrow(
      "endPage must be greater than or equal to startPage"
    );
  });

  it("returns PDF metadata", async () => {
    const pdfBuffer = Buffer.from(MINIMAL_PDF);
    const result = await extractPdf({ pdfBuffer });

    expect(result.pdfMetadata).toBeDefined();
    expect(typeof result.pdfMetadata).toBe("object");
  });

  it("throws on invalid PDF data", async () => {
    const pdfBuffer = Buffer.from("not a pdf");

    await expect(extractPdf({ pdfBuffer })).rejects.toThrow();
  });

  it("extracts vector images from Form XObjects", async () => {
    const pdfBuffer = createPdfWithVectorForm();
    const result = await extractPdf({ pdfBuffer });

    expect(result.pages).toHaveLength(1);
    const page = result.pages[0];

    // Should have extracted the vector Form XObject (uses same _im format as raster images)
    expect(page.images.length).toBeGreaterThanOrEqual(1);

    const vecImage = page.images[0];
    expect(vecImage.imageId).toBe("pg001_im001");
    expect(vecImage.buffer).toBeInstanceOf(Buffer);
    expect(vecImage.width).toBeGreaterThan(0);
    expect(vecImage.height).toBeGreaterThan(0);
    expect(vecImage.hash).toMatch(/^[a-f0-9]{16}$/);
  });
});

describe("extractPdfStream", () => {
  it("yields pages one at a time matching extractPdf output", async () => {
    const pdfBuffer = Buffer.from(TWO_PAGE_PDF);
    const { pdfMetadata, totalPagesInPdf, pages } = extractPdfStream({ pdfBuffer });

    // Metadata available before iterating
    expect(totalPagesInPdf).toBe(2);
    expect(pdfMetadata).toBeDefined();

    const collected = [];
    for await (const page of pages) {
      collected.push(page);
    }

    expect(collected).toHaveLength(2);
    expect(collected[0].pageId).toBe("pg001");
    expect(collected[1].pageId).toBe("pg002");
  });

  it("calls progress callback for each page", async () => {
    const pdfBuffer = Buffer.from(TWO_PAGE_PDF);
    const progressCalls: { page: number; totalPages: number }[] = [];
    const { pages } = extractPdfStream({ pdfBuffer }, (p) => {
      progressCalls.push({ ...p });
    });

    // Drain the generator
    for await (const _ of pages) { /* consume */ }

    expect(progressCalls).toEqual([
      { page: 1, totalPages: 2 },
      { page: 2, totalPages: 2 },
    ]);
  });

  it("cleans up document when generator is abandoned early", async () => {
    const pdfBuffer = Buffer.from(TWO_PAGE_PDF);
    const { pages } = extractPdfStream({ pdfBuffer });

    // Break after first page — should not leak the document
    for await (const page of pages) {
      expect(page.pageId).toBe("pg001");
      break;
    }
    // If doc.destroy() is not called in finally, WASM memory leaks.
    // No assertion needed — this test verifies no crash on early exit.
  });
});

// Helper: create an N-page PDF using mupdf
function createNPagePdf(n: number): Buffer {
  const doc = new mupdf.PDFDocument();
  for (let i = 0; i < n; i++) {
    const resources = doc.newDictionary();
    const pageObj = doc.addPage(
      [0, 0, 612, 792],
      0,
      resources,
      `BT /F1 12 Tf 100 700 Td (Page ${i + 1}) Tj ET`
    );
    doc.insertPage(-1, pageObj);
  }
  return Buffer.from(doc.saveToBuffer("").asUint8Array());
}

// Helper: create a tiny PNG of given dimensions
function createTestPng(width: number, height: number): Buffer {
  const png = new PNG({ width, height });
  // Fill with opaque red
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      png.data[idx] = 255;     // R
      png.data[idx + 1] = 0;   // G
      png.data[idx + 2] = 0;   // B
      png.data[idx + 3] = 255; // A
    }
  }
  return PNG.sync.write(png);
}

describe("stitchPngsHorizontally", () => {
  it("produces correct combined dimensions", () => {
    const left = createTestPng(100, 200);
    const right = createTestPng(150, 200);
    const result = stitchPngsHorizontally(left, right);
    const decoded = decodePng(result);
    expect(decoded.width).toBe(250);
    expect(decoded.height).toBe(200);
  });

  it("uses max height when pages differ", () => {
    const left = createTestPng(100, 150);
    const right = createTestPng(100, 200);
    const result = stitchPngsHorizontally(left, right);
    const decoded = decodePng(result);
    expect(decoded.width).toBe(200);
    expect(decoded.height).toBe(200);
  });
});

describe("extractPdf spread mode", () => {
  it("merges 5 pages into 3 logical pages (cover + 2 spreads)", async () => {
    const pdfBuffer = createNPagePdf(5);
    const result = await extractPdf({ pdfBuffer, spreadMode: true });

    expect(result.totalPagesInPdf).toBe(5);
    expect(result.pages).toHaveLength(3);

    // Page 1: cover (standalone)
    expect(result.pages[0].pageId).toBe("pg001");
    expect(result.pages[0].pageNumber).toBe(1);

    // Pages 2+3: first spread
    expect(result.pages[1].pageId).toBe("pg002003");
    expect(result.pages[1].pageNumber).toBe(2);

    // Pages 4+5: second spread
    expect(result.pages[2].pageId).toBe("pg004005");
    expect(result.pages[2].pageNumber).toBe(4);
  });

  it("handles even page count (last page unpaired)", async () => {
    const pdfBuffer = createNPagePdf(6);
    const result = await extractPdf({ pdfBuffer, spreadMode: true });

    // cover + spreads 2+3, 4+5 + standalone 6
    expect(result.pages).toHaveLength(4);
    expect(result.pages[0].pageId).toBe("pg001");
    expect(result.pages[1].pageId).toBe("pg002003");
    expect(result.pages[2].pageId).toBe("pg004005");
    expect(result.pages[3].pageId).toBe("pg006");
    expect(result.pages[3].pageNumber).toBe(6);
  });

  it("spread page image is wider than a single page", async () => {
    const pdfBuffer = createNPagePdf(3);
    const result = await extractPdf({ pdfBuffer, spreadMode: true });

    const coverWidth = result.pages[0].pageImage.width;
    const spreadWidth = result.pages[1].pageImage.width;
    // Spread should be roughly 2x the width of a single page
    expect(spreadWidth).toBeGreaterThan(coverWidth * 1.5);
  });

  it("spreadMode false (default) produces normal pages", async () => {
    const pdfBuffer = createNPagePdf(4);
    const result = await extractPdf({ pdfBuffer });

    expect(result.pages).toHaveLength(4);
    expect(result.pages[0].pageId).toBe("pg001");
    expect(result.pages[1].pageId).toBe("pg002");
    expect(result.pages[2].pageId).toBe("pg003");
    expect(result.pages[3].pageId).toBe("pg004");
  });

  it("spread page image ids use the spread pageId", async () => {
    const pdfBuffer = createNPagePdf(3);
    const result = await extractPdf({ pdfBuffer, spreadMode: true });

    expect(result.pages[1].pageImage.imageId).toBe("pg002003_page");
  });

  it("reports correct progress for spread mode", async () => {
    const pdfBuffer = createNPagePdf(5);
    const progressCalls: { page: number; totalPages: number }[] = [];
    await extractPdf({ pdfBuffer, spreadMode: true }, (p) => {
      progressCalls.push({ ...p });
    });

    expect(progressCalls).toEqual([
      { page: 1, totalPages: 3 },
      { page: 2, totalPages: 3 },
      { page: 3, totalPages: 3 },
    ]);
  });

  it("anchors grouping to the selected start page", async () => {
    const pdfBuffer = createNPagePdf(7);
    const result = await extractPdf({
      pdfBuffer,
      spreadMode: true,
      startPage: 3,
    });

    expect(result.pages).toHaveLength(3);
    expect(result.pages[0].pageId).toBe("pg003");
    expect(result.pages[1].pageId).toBe("pg004005");
    expect(result.pages[2].pageId).toBe("pg006007");
  });

  it("still starts with a standalone page for even start pages", async () => {
    const pdfBuffer = createNPagePdf(7);
    const result = await extractPdf({
      pdfBuffer,
      spreadMode: true,
      startPage: 4,
    });

    expect(result.pages).toHaveLength(3);
    expect(result.pages[0].pageId).toBe("pg004");
    expect(result.pages[1].pageId).toBe("pg005006");
    expect(result.pages[2].pageId).toBe("pg007");
  });
});

/**
 * Create a minimal JPEG buffer (2x2 red pixels) using mupdf.
 */
function createTinyJpeg(): Buffer {
  // Create a pixmap without alpha (JPEG doesn't support alpha)
  const pixmap = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, 2, 2], false);
  // Pixmap pixels are initialized to black by default, that's fine for a test image
  return Buffer.from(pixmap.asJPEG(90, false));
}

/**
 * Build a PDF with an image that has chained [FlateDecode, DCTDecode] filters.
 * This simulates PDFs where JPEG data is additionally compressed with zlib.
 */
function createPdfWithChainedFilterImage(): Buffer {
  const doc = new mupdf.PDFDocument();

  // Create a tiny JPEG, then wrap it in zlib compression
  const jpegBytes = createTinyJpeg();
  const zlibBytes = deflateSync(jpegBytes);

  // Build the image dictionary manually
  const imgDict = doc.newDictionary();
  imgDict.put("Type", doc.newName("XObject"));
  imgDict.put("Subtype", doc.newName("Image"));
  imgDict.put("Width", 2);
  imgDict.put("Height", 2);
  imgDict.put("BitsPerComponent", 8);
  imgDict.put("ColorSpace", doc.newName("DeviceRGB"));

  // Chained filter: data goes through FlateDecode first, then DCTDecode
  const filters = doc.newArray();
  filters.push(doc.newName("FlateDecode"));
  filters.push(doc.newName("DCTDecode"));
  imgDict.put("Filter", filters);

  // addRawStream stores bytes without applying extra compression
  const imgObj = doc.addRawStream(zlibBytes, imgDict);

  // Wire the image into a page
  const resources = doc.newDictionary();
  const xobjects = doc.newDictionary();
  xobjects.put("Im1", imgObj);
  resources.put("XObject", xobjects);

  const pageContent = "q 100 0 0 100 50 650 cm /Im1 Do Q";
  const pageObj = doc.addPage([0, 0, 612, 792], 0, resources, pageContent);
  doc.insertPage(-1, pageObj);

  return Buffer.from(doc.saveToBuffer("").asUint8Array());
}

/**
 * Build a PDF with an image that uses a single-element filter array [DCTDecode].
 * This should still be treated as a plain JPEG stream.
 */
function createPdfWithSingleArrayDctFilterImage(): Buffer {
  const doc = new mupdf.PDFDocument();
  const jpegBytes = createTinyJpeg();

  const imgDict = doc.newDictionary();
  imgDict.put("Type", doc.newName("XObject"));
  imgDict.put("Subtype", doc.newName("Image"));
  imgDict.put("Width", 2);
  imgDict.put("Height", 2);
  imgDict.put("BitsPerComponent", 8);
  imgDict.put("ColorSpace", doc.newName("DeviceRGB"));

  const filters = doc.newArray();
  filters.push(doc.newName("DCTDecode"));
  imgDict.put("Filter", filters);

  const imgObj = doc.addRawStream(jpegBytes, imgDict);

  const resources = doc.newDictionary();
  const xobjects = doc.newDictionary();
  xobjects.put("Im1", imgObj);
  resources.put("XObject", xobjects);

  const pageContent = "q 100 0 0 100 50 650 cm /Im1 Do Q";
  const pageObj = doc.addPage([0, 0, 612, 792], 0, resources, pageContent);
  doc.insertPage(-1, pageObj);

  return Buffer.from(doc.saveToBuffer("").asUint8Array());
}

/**
 * Build a PDF with a CMYK JPEG image. Mirrors what print-oriented PDFs commonly
 * produce — the image data is a single-filter DCTDecode stream with /ColorSpace
 * /DeviceCMYK.
 */
function createPdfWithCmykJpegImage(): Buffer {
  const doc = new mupdf.PDFDocument();

  // Create a CMYK pixmap and encode it as a CMYK JPEG.
  const cmykPixmap = new mupdf.Pixmap(mupdf.ColorSpace.DeviceCMYK, [0, 0, 4, 4], false);
  const cmykJpegBytes = Buffer.from(cmykPixmap.asJPEG(90, false));

  const imgDict = doc.newDictionary();
  imgDict.put("Type", doc.newName("XObject"));
  imgDict.put("Subtype", doc.newName("Image"));
  imgDict.put("Width", 4);
  imgDict.put("Height", 4);
  imgDict.put("BitsPerComponent", 8);
  imgDict.put("ColorSpace", doc.newName("DeviceCMYK"));
  imgDict.put("Filter", doc.newName("DCTDecode"));

  const imgObj = doc.addRawStream(cmykJpegBytes, imgDict);

  const resources = doc.newDictionary();
  const xobjects = doc.newDictionary();
  xobjects.put("Im1", imgObj);
  resources.put("XObject", xobjects);

  const pageContent = "q 100 0 0 100 50 650 cm /Im1 Do Q";
  const pageObj = doc.addPage([0, 0, 612, 792], 0, resources, pageContent);
  doc.insertPage(-1, pageObj);

  return Buffer.from(doc.saveToBuffer("").asUint8Array());
}

/**
 * Build a PDF with an RGB image that has an attached /SMask carrying alpha.
 * Mirrors the typical output of design tools that flatten transparency to a
 * base image plus a soft mask.
 */
function createPdfWithSoftMaskImage(): Buffer {
  const doc = new mupdf.PDFDocument();
  const w = 4;
  const h = 4;

  // Base RGB image — 4x4, fill with bright red so the alpha effect is obvious.
  const baseBytes = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    baseBytes[i * 3 + 0] = 255;
    baseBytes[i * 3 + 1] = 0;
    baseBytes[i * 3 + 2] = 0;
  }

  // SMask — gray; left half opaque (255), right half transparent (0).
  const maskBytes = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      maskBytes[y * w + x] = x < w / 2 ? 255 : 0;
    }
  }

  const maskDict = doc.newDictionary();
  maskDict.put("Type", doc.newName("XObject"));
  maskDict.put("Subtype", doc.newName("Image"));
  maskDict.put("Width", w);
  maskDict.put("Height", h);
  maskDict.put("BitsPerComponent", 8);
  maskDict.put("ColorSpace", doc.newName("DeviceGray"));
  const maskObj = doc.addStream(maskBytes, maskDict);

  const imgDict = doc.newDictionary();
  imgDict.put("Type", doc.newName("XObject"));
  imgDict.put("Subtype", doc.newName("Image"));
  imgDict.put("Width", w);
  imgDict.put("Height", h);
  imgDict.put("BitsPerComponent", 8);
  imgDict.put("ColorSpace", doc.newName("DeviceRGB"));
  imgDict.put("SMask", maskObj);
  const imgObj = doc.addStream(baseBytes, imgDict);

  const resources = doc.newDictionary();
  const xobjects = doc.newDictionary();
  xobjects.put("Im1", imgObj);
  resources.put("XObject", xobjects);

  const pageContent = "q 100 0 0 100 50 650 cm /Im1 Do Q";
  const pageObj = doc.addPage([0, 0, 612, 792], 0, resources, pageContent);
  doc.insertPage(-1, pageObj);

  return Buffer.from(doc.saveToBuffer("").asUint8Array());
}

/**
 * Build a PDF whose SMask carries a /Matte entry. The base RGB bytes are stored
 * pre-blended with the matte color (white) at 50% alpha — i.e. ~(127, 127, 127)
 * — so that un-matting must recover the original color (~black).
 */
function createPdfWithMattedSoftMaskImage(): Buffer {
  const doc = new mupdf.PDFDocument();
  const w = 4;
  const h = 4;

  // Pre-blended pixels: original black (0) onto white matte (255) at a=0.5.
  const baseBytes = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    baseBytes[i * 3 + 0] = 127;
    baseBytes[i * 3 + 1] = 127;
    baseBytes[i * 3 + 2] = 127;
  }

  // Uniform 50% alpha (128).
  const maskBytes = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) maskBytes[i] = 128;

  const maskDict = doc.newDictionary();
  maskDict.put("Type", doc.newName("XObject"));
  maskDict.put("Subtype", doc.newName("Image"));
  maskDict.put("Width", w);
  maskDict.put("Height", h);
  maskDict.put("BitsPerComponent", 8);
  maskDict.put("ColorSpace", doc.newName("DeviceGray"));
  const matte = doc.newArray();
  matte.push(1);
  matte.push(1);
  matte.push(1);
  maskDict.put("Matte", matte);
  const maskObj = doc.addStream(maskBytes, maskDict);

  const imgDict = doc.newDictionary();
  imgDict.put("Type", doc.newName("XObject"));
  imgDict.put("Subtype", doc.newName("Image"));
  imgDict.put("Width", w);
  imgDict.put("Height", h);
  imgDict.put("BitsPerComponent", 8);
  imgDict.put("ColorSpace", doc.newName("DeviceRGB"));
  imgDict.put("SMask", maskObj);
  const imgObj = doc.addStream(baseBytes, imgDict);

  const resources = doc.newDictionary();
  const xobjects = doc.newDictionary();
  xobjects.put("Im1", imgObj);
  resources.put("XObject", xobjects);

  const pageContent = "q 100 0 0 100 50 650 cm /Im1 Do Q";
  const pageObj = doc.addPage([0, 0, 612, 792], 0, resources, pageContent);
  doc.insertPage(-1, pageObj);

  return Buffer.from(doc.saveToBuffer("").asUint8Array());
}

describe("extractPdf images with soft masks", () => {
  it("preserves alpha from /SMask instead of producing an opaque image on a black background", async () => {
    const pdfBuffer = createPdfWithSoftMaskImage();
    const result = await extractPdf({ pdfBuffer });

    const rasterImages = result.pages[0].images.filter(
      (img) => !img.imageId.endsWith("_page")
    );
    expect(rasterImages).toHaveLength(1);
    const img = rasterImages[0];
    expect(img.format).toBe("png");

    // Decode and verify: left half is opaque red, right half is transparent.
    const { data, width, height } = decodePng(img.buffer);
    expect(width).toBe(4);
    expect(height).toBe(4);

    // The PNG must have an alpha channel.
    expect(data.length).toBe(width * height * 4);

    // Left column: opaque red.
    expect(data[0]).toBe(255); // R
    expect(data[1]).toBe(0); // G
    expect(data[2]).toBe(0); // B
    expect(data[3]).toBe(255); // A

    // Right column: alpha 0 (the actual color underneath is irrelevant —
    // the failure mode being tested is opaque pixels with no alpha).
    const lastPixelOffset = (4 * 4 - 1) * 4;
    expect(data[lastPixelOffset + 3]).toBe(0);
  });

  it("un-mattes base colors when /SMask carries a /Matte entry", async () => {
    const pdfBuffer = createPdfWithMattedSoftMaskImage();
    const result = await extractPdf({ pdfBuffer });

    const rasterImages = result.pages[0].images.filter(
      (img) => !img.imageId.endsWith("_page")
    );
    expect(rasterImages).toHaveLength(1);
    const { data } = decodePng(rasterImages[0].buffer);

    // Stored pixels are gray (~127) because they were pre-blended with a
    // white matte at 50% alpha. After un-matting we must recover near-black;
    // without un-matting the channels would stay around 127.
    expect(data[0]).toBeLessThan(10);
    expect(data[1]).toBeLessThan(10);
    expect(data[2]).toBeLessThan(10);
    expect(data[3]).toBe(128);
  });
});

describe("extractPdf CMYK images", () => {
  it("converts CMYK JPEGs to RGB so browsers render them correctly", async () => {
    const pdfBuffer = createPdfWithCmykJpegImage();
    const result = await extractPdf({ pdfBuffer });

    expect(result.pages).toHaveLength(1);
    const rasterImages = result.pages[0].images.filter(
      (img) => !img.imageId.endsWith("_page")
    );
    expect(rasterImages).toHaveLength(1);
    const img = rasterImages[0];

    expect(img.format).toBe("jpeg");
    // Re-decode the extracted JPEG and confirm it is no longer CMYK.
    const reloaded = new mupdf.Image(img.buffer);
    const cs = reloaded.getColorSpace();
    expect(cs?.getType()).toBe("RGB");
  });
});

describe("extractPdf chained image filters", () => {
  it("extracts a valid image from a [FlateDecode, DCTDecode] filter chain", async () => {
    const pdfBuffer = createPdfWithChainedFilterImage();
    const result = await extractPdf({ pdfBuffer });

    expect(result.pages).toHaveLength(1);
    const page = result.pages[0];

    // Should have extracted the raster image
    const rasterImages = page.images.filter((img) => !img.imageId.endsWith("_page"));
    expect(rasterImages).toHaveLength(1);

    const img = rasterImages[0];
    expect(img.buffer.length).toBeGreaterThan(0);
    expect(img.format).toBe("png");

    // Verify the output is actually a valid PNG (starts with PNG magic bytes)
    expect(img.buffer[0]).toBe(0x89);
    expect(img.buffer[1]).toBe(0x50); // 'P'
    expect(img.buffer[2]).toBe(0x4e); // 'N'
    expect(img.buffer[3]).toBe(0x47); // 'G'
  });

  it("keeps single-element [DCTDecode] filter arrays as jpeg", async () => {
    const pdfBuffer = createPdfWithSingleArrayDctFilterImage();
    const result = await extractPdf({ pdfBuffer });

    expect(result.pages).toHaveLength(1);
    const page = result.pages[0];
    const rasterImages = page.images.filter((img) => !img.imageId.endsWith("_page"));
    expect(rasterImages).toHaveLength(1);

    const img = rasterImages[0];
    expect(img.buffer.length).toBeGreaterThan(0);
    expect(img.format).toBe("jpeg");

    // Verify JPEG SOI signature
    expect(img.buffer[0]).toBe(0xff);
    expect(img.buffer[1]).toBe(0xd8);
    expect(img.buffer[2]).toBe(0xff);
  });

  it("takes the raw fast path for RGB JPEGs (no doc.loadImage decode)", async () => {
    // A single-filter DCTDecode RGB JPEG with no SMask must be copied straight
    // from the stream — the colorspace is read from the PDF dictionary, so
    // doc.loadImage() (which decodes) must never run for it. This guards the
    // #442 regression where loadImage was called for every image.
    const pdfBuffer = createPdfWithSingleArrayDctFilterImage();

    // Patch whichever prototype owns loadImage to count decode calls.
    const protos = [mupdf.PDFDocument?.prototype, mupdf.Document?.prototype].filter(
      (p): p is { loadImage: (...a: unknown[]) => unknown } =>
        !!p && Object.prototype.hasOwnProperty.call(p, "loadImage")
    );
    const originals = protos.map((p) => p.loadImage);
    let loadImageCalls = 0;
    protos.forEach((p, i) => {
      p.loadImage = function (this: unknown, ...a: unknown[]) {
        loadImageCalls++;
        return originals[i].apply(this, a);
      };
    });

    try {
      const result = await extractPdf({ pdfBuffer });
      const img = result.pages[0].images.find((i) => !i.imageId.endsWith("_page"));
      expect(img?.format).toBe("jpeg");
      expect(loadImageCalls).toBe(0);
    } finally {
      protos.forEach((p, i) => {
        p.loadImage = originals[i];
      });
    }
  });
});
