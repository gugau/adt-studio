import { createBookStorage } from "@adt/storage"
import { PageSectioningOutput } from "@adt/types"
import type { ContentNodeData, PageSectioningSection } from "@adt/types"
import { reRenderPage } from "./page-edit-service.js"

export interface CreateActivityOptions {
  label: string
  contextPageIds: string[]
  sectionType: string
  /** Free-form extra instructions passed to the activity LLM as userPrompt. */
  extraInstructions?: string
  booksDir: string
  promptsDir: string
  webAssetsDir?: string
  configPath?: string
  apiKey: string
}

export interface CreateActivityResult {
  pageId: string
  sectionIndex: number
  sectioningVersion: number
  renderingVersion: number
}

/** Walk a content tree and collect leaf text nodes. */
function collectTextLeaves(node: ContentNodeData, out: ContentNodeData[]): void {
  if (node.isPruned) return
  if (node.children?.length) {
    for (const child of node.children) collectTextLeaves(child, out)
    return
  }
  // Leaf — keep only text-bearing leaves; skip images (their nodeId references
  // image assets stored on the target page, which would 404 on the new page).
  if (node.role && node.role !== "image" && (node.text ?? "").trim().length > 0) {
    out.push(node)
  }
}

function rekeyNodeIds(node: ContentNodeData, prefix: string, counter: { n: number }): ContentNodeData {
  const nextId = `${prefix}-${counter.n++}`
  const next: ContentNodeData = {
    ...node,
    nodeId: nextId,
  }
  if (node.children?.length) {
    next.children = node.children.map((c) => rekeyNodeIds(c, prefix, counter))
  }
  return next
}

/**
 * Create a new user-authored activity section on the last selected context
 * page. Seeds the new section's nodes from text leaves of the context pages
 * so the activity LLM has source material, then re-renders that section.
 */
export async function createActivity(
  options: CreateActivityOptions,
): Promise<CreateActivityResult> {
  const {
    label,
    contextPageIds,
    sectionType,
    extraInstructions,
    booksDir,
    promptsDir,
    webAssetsDir,
    configPath,
    apiKey,
  } = options

  if (contextPageIds.length === 0) {
    throw new Error("contextPageIds must be non-empty")
  }
  const targetPageId = contextPageIds[contextPageIds.length - 1]

  const storage = createBookStorage(label, booksDir)
  let sectioningVersion: number
  let newSectionIndex: number
  let targetSectioningParsed: PageSectioningOutput

  try {
    // Gather text leaves from each context page in order.
    const contextLeaves: ContentNodeData[] = []
    for (const pageId of contextPageIds) {
      const row = storage.getLatestNodeData("page-sectioning", pageId)
      if (!row) continue
      const parsed = PageSectioningOutput.safeParse(row.data)
      if (!parsed.success) continue
      for (const section of parsed.data.sections) {
        if (section.isPruned) continue
        for (const n of section.nodes) collectTextLeaves(n, contextLeaves)
      }
    }

    // Load target page sectioning and append the new section.
    const targetRow = storage.getLatestNodeData("page-sectioning", targetPageId)
    if (!targetRow) {
      throw new Error(`Target page has no page-sectioning data: ${targetPageId}`)
    }
    const parsedTarget = PageSectioningOutput.safeParse(targetRow.data)
    if (!parsedTarget.success) {
      throw new Error("Invalid page-sectioning data on target page")
    }
    targetSectioningParsed = parsedTarget.data

    const newSectionId = `usr-act-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`

    const idCounter = { n: 0 }
    const newNodes: ContentNodeData[] =
      contextLeaves.length > 0
        ? [
            rekeyNodeIds(
              {
                nodeId: `${newSectionId}-root`,
                isPruned: false,
                structure: "group",
                children: contextLeaves,
              },
              `${newSectionId}`,
              idCounter,
            ),
          ]
        : []

    const newSection: PageSectioningSection = {
      sectionId: newSectionId,
      sectionType,
      backgroundColor: "#ffffff",
      textColor: "#000000",
      pageNumber: targetSectioningParsed.sections[0]?.pageNumber ?? null,
      isPruned: false,
      nodes: newNodes,
    }

    const updated: PageSectioningOutput = {
      ...targetSectioningParsed,
      sections: [...targetSectioningParsed.sections, newSection],
    }

    sectioningVersion = storage.putNodeData("page-sectioning", targetPageId, updated)
    newSectionIndex = updated.sections.length - 1
  } finally {
    storage.close()
  }

  // Re-render only the new section. reRenderPage opens its own storage handle.
  const renderResult = await reRenderPage({
    label,
    pageId: targetPageId,
    sectionIndex: newSectionIndex,
    prompt: extraInstructions,
    booksDir,
    promptsDir,
    webAssetsDir,
    configPath,
    apiKey,
  })

  return {
    pageId: targetPageId,
    sectionIndex: newSectionIndex,
    sectioningVersion,
    renderingVersion: renderResult.version,
  }
}
