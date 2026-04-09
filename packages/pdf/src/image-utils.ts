import { PNG } from "pngjs";
import jpeg from "jpeg-js";

interface DecodedImage {
  data: Buffer;
  width: number;
  height: number;
}

function decodeImage(buf: Buffer, format: "png" | "jpeg"): DecodedImage {
  if (format === "png") {
    const png = PNG.sync.read(buf);
    return { data: Buffer.from(png.data), width: png.width, height: png.height };
  }
  const jpg = jpeg.decode(buf, { useTArray: false, formatAsRGBA: true });
  return { data: Buffer.from(jpg.data), width: jpg.width, height: jpg.height };
}

/**
 * Stitch two images side by side (left | right), accepting PNG or JPEG input.
 * Returns a PNG buffer. Shorter image is top-aligned with transparent padding.
 */
export function stitchImagesHorizontally(
  left: Buffer,
  leftFormat: "png" | "jpeg",
  right: Buffer,
  rightFormat: "png" | "jpeg",
): Buffer {
  const l = decodeImage(left, leftFormat);
  const r = decodeImage(right, rightFormat);
  const width = l.width + r.width;
  const height = Math.max(l.height, r.height);
  const data = Buffer.alloc(width * height * 4);

  for (let y = 0; y < l.height; y++) {
    const srcOffset = y * l.width * 4;
    const dstOffset = y * width * 4;
    l.data.copy(data, dstOffset, srcOffset, srcOffset + l.width * 4);
  }

  for (let y = 0; y < r.height; y++) {
    const srcOffset = y * r.width * 4;
    const dstOffset = y * width * 4 + l.width * 4;
    r.data.copy(data, dstOffset, srcOffset, srcOffset + r.width * 4);
  }

  const png = new PNG({ width, height });
  png.data = data;
  return PNG.sync.write(png);
}
