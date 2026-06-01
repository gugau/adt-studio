import type { PageDetail } from "@/api/client"
import type { ContentNodeData } from "@adt/types"
import type { CaptionEntry, DecorativeFilter } from "./types"

export function matchesDecorativeFilter(cap: CaptionEntry, filter: DecorativeFilter): boolean {
  if (filter === "captioned") return cap.decorative !== true
  if (filter === "decorative") return cap.decorative === true
  return true
}

export function matchesSearch(cap: CaptionEntry, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase().trim()
  if (!q) return true
  return cap.caption.toLowerCase().includes(q) || cap.imageId.toLowerCase().includes(q)
}

/** Build a map from imageId → sectionIndex by walking each section's tree. */
export function buildImageSectionMap(page: PageDetail | undefined): Map<string, number> {
  const map = new Map<string, number>()
  if (!page?.sectioningTree) return map
  const walk = (nodes: ContentNodeData[], sectionIdx: number) => {
    for (const node of nodes) {
      if (node.role === "image") map.set(node.nodeId, sectionIdx)
      else if (node.children) walk(node.children, sectionIdx)
    }
  }
  page.sectioningTree.sections.forEach((section, idx) => {
    walk(section.nodes, idx)
  })
  return map
}
