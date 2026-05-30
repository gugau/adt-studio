export interface SectionEntry {
  sectionId: string
  sectionIndex: number
  pageNumber: number
  pageLabel: string
  sectionLabel: string
}

export type FilterValue = "missing" | "covered" | "all"
