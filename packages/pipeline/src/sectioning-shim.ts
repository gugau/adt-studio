import type {
  ContentNodeData,
  PageSection,
  PageSectioningOutput,
  PageSectioningSection,
  SectionPart,
  SectionTextPart,
  UIPageSectioningOutput,
} from "@adt/types"

// ── Tree → parts (read shim) ────────────────────────────────────

export function treeToParts(section: PageSectioningSection): PageSection {
  return {
    sectionId: section.sectionId,
    sectionType: section.sectionType,
    backgroundColor: section.backgroundColor,
    textColor: section.textColor,
    pageNumber: section.pageNumber,
    isPruned: section.isPruned,
    parts: flattenNodes(section.nodes),
  }
}

export function treeToPartsOutput(
  output: PageSectioningOutput
): UIPageSectioningOutput {
  return {
    reasoning: output.reasoning,
    sections: output.sections.map(treeToParts),
  }
}

interface ContainerFrame {
  structure: string
  nodeId: string
  isPruned: boolean
}

function flattenNodes(topNodes: ContentNodeData[]): SectionPart[] {
  const parts: SectionPart[] = []
  const stack: ContainerFrame[] = []
  let currentGroup: SectionTextPart | null = null
  // When a run within the same container is split by an image, each
  // subsequent run gets a disambiguating __N suffix on groupId so downstream
  // `data-id` values stay unique.
  const runCounter = new Map<string, number>()
  // Top-level leaves with no container ancestor get synthesized groupIds.
  let syntheticCounter = 0

  function inheritedPruned(): boolean {
    for (const f of stack) if (f.isPruned) return true
    return false
  }

  function innermost(): ContainerFrame | undefined {
    return stack.length > 0 ? stack[stack.length - 1] : undefined
  }

  function flush() {
    if (currentGroup) {
      parts.push(currentGroup)
      currentGroup = null
    }
  }

  function openGroupFor(inner: ContainerFrame | undefined, fallbackNodeId: string) {
    const baseId = inner?.nodeId ?? `synth_${fallbackNodeId}_${++syntheticCounter}`
    const count = runCounter.get(baseId) ?? 0
    const groupId = count === 0 ? baseId : `${baseId}__${count}`
    runCounter.set(baseId, count + 1)
    currentGroup = {
      type: "text_group",
      groupId,
      groupType: inner?.structure ?? "group",
      texts: [],
      isPruned: inner?.isPruned || inheritedPruned(),
    }
  }

  function visit(node: ContentNodeData) {
    if (node.role === "image") {
      flush()
      parts.push({
        type: "image",
        imageId: node.nodeId,
        isPruned: node.isPruned || inheritedPruned(),
      })
      return
    }

    if (node.role) {
      const inner = innermost()
      const targetBase = inner?.nodeId
      if (!currentGroup || groupBaseId(currentGroup.groupId) !== targetBase) {
        flush()
        openGroupFor(inner, node.nodeId)
      }
      currentGroup!.texts.push({
        textId: node.nodeId,
        textType: node.role,
        text: node.text ?? "",
        isPruned: node.isPruned,
      })
      return
    }

    if (node.structure) {
      flush()
      stack.push({
        structure: node.structure,
        nodeId: node.nodeId,
        isPruned: node.isPruned,
      })
      for (const child of node.children ?? []) visit(child)
      flush()
      stack.pop()
      return
    }
    // Malformed node (neither role nor structure) — skip.
  }

  for (const top of topNodes) visit(top)
  flush()
  return parts
}

function groupBaseId(groupId: string): string {
  const m = groupId.match(/^(.+)__\d+$/)
  return m ? m[1] : groupId
}

// ── Parts → tree (write shim) ───────────────────────────────────

export function partsToTree(section: PageSection): PageSectioningSection {
  return {
    sectionId: section.sectionId,
    sectionType: section.sectionType,
    backgroundColor: section.backgroundColor,
    textColor: section.textColor,
    pageNumber: section.pageNumber,
    isPruned: section.isPruned,
    nodes: section.parts.map(partToNode),
  }
}

export function partsToTreeOutput(
  output: UIPageSectioningOutput
): PageSectioningOutput {
  return {
    reasoning: output.reasoning,
    sections: output.sections.map(partsToTree),
  }
}

function partToNode(part: SectionPart): ContentNodeData {
  if (part.type === "image") {
    return {
      nodeId: part.imageId,
      isPruned: part.isPruned,
      role: "image",
    }
  }
  return {
    nodeId: part.groupId,
    isPruned: part.isPruned,
    structure: part.groupType,
    children: part.texts.map((t) => ({
      nodeId: t.textId,
      isPruned: t.isPruned,
      role: t.textType,
      text: t.text,
    })),
  }
}
