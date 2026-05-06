/**
 * Navigation atoms — back the page list and TOC, both fetched once on boot.
 *
 * Page-to-page navigation in the runtime is a full document reload (each page
 * is its own HTML file), so `currentSectionId` is derived from the DOM, not
 * mutated as the user navigates.
 */
import { ephemeralAtom } from "./persist"

export interface PageEntry {
  section_id: string
  href: string
  page_number?: number
}

export interface TocEntry {
  section_id: string
  href: string
  title: string
  chapter_id: string
  level?: number
}

export const pagesAtom = ephemeralAtom<PageEntry[]>([])
export const tocAtom = ephemeralAtom<TocEntry[]>([])

/**
 * The current section id from the page's `<meta name="title-id">`. Stable
 * for the lifetime of one page load.
 */
export const currentSectionIdAtom = ephemeralAtom<string | null>(null)
export const currentPageNumberAtom = ephemeralAtom<number | null>(null)
