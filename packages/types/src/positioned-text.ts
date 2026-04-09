import { z } from "zod"

export const PositionedParagraph = z.object({
  /** Top position in CSS pixels at render scale */
  top: z.number(),
  /** Left position in CSS pixels at render scale */
  left: z.number(),
  /** Line height in CSS pixels at render scale */
  lineHeight: z.number(),
  /** HTML content of the paragraph (spans with font styling) */
  html: z.string(),
})
export type PositionedParagraph = z.infer<typeof PositionedParagraph>

export const ImageBounds = z.object({
  /** Left edge in PDF points */
  x: z.number(),
  /** Top edge in PDF points */
  y: z.number(),
  /** Width in PDF points */
  width: z.number(),
  /** Height in PDF points */
  height: z.number(),
})
export type ImageBounds = z.infer<typeof ImageBounds>

export const PositionedTextOutput = z.object({
  /** Paragraphs with position and styled content */
  paragraphs: z.array(PositionedParagraph),
  /** Page width in PDF points */
  pageWidth: z.number(),
  /** Page height in PDF points */
  pageHeight: z.number(),
  /** Rendered width in pixels (at render scale, typically 2x) */
  renderWidth: z.number(),
  /** Rendered height in pixels (at render scale, typically 2x) */
  renderHeight: z.number(),
  /** Bounding boxes of images on the page, in PDF points */
  imageBounds: z.array(ImageBounds).optional(),
})
export type PositionedTextOutput = z.infer<typeof PositionedTextOutput>
