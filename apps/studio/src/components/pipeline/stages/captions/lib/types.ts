import type { PageDetail } from "@/api/client"

export type CaptioningData = NonNullable<PageDetail["imageCaptioning"]>
export type CaptionEntry = CaptioningData["captions"][number]

export type DecorativeFilter = "all" | "captioned" | "decorative"

export interface CaptionGroup {
  sectionIndex: number
  sectionType?: string
  captions: CaptionEntry[]
}

export interface LightboxEntry {
  cap: CaptionEntry
  pageId: string
  pageNumber: number
}

/** An in-progress caption edit: which image, and the current draft text. */
export interface CaptionEdit {
  imageId: string
  draft: string
}

export interface PageStats {
  total: number
  captioned: number
  decorative: number
}

export interface PageJumperEntry {
  pageId: string
  pageNumber: number
  textPreview: string
  imageCount: number
  thumbnail: string | null
  stats?: PageStats
}
