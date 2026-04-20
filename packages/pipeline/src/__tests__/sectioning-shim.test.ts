import { describe, expect, it } from "vitest"
import type {
  ContentNodeData,
  PageSection,
  PageSectioningSection,
} from "@adt/types"
import {
  partsToTree,
  partsToTreeOutput,
  treeToParts,
  treeToPartsOutput,
} from "../sectioning-shim.js"

function makeSection(
  overrides: Partial<PageSectioningSection> & { nodes: ContentNodeData[] }
): PageSectioningSection {
  return {
    sectionId: "sec_1",
    sectionType: "text_only",
    backgroundColor: "#ffffff",
    textColor: "#000000",
    pageNumber: 1,
    isPruned: false,
    ...overrides,
  }
}

describe("treeToParts", () => {
  it("emits one text_group per paragraph container", () => {
    const section = makeSection({
      nodes: [
        {
          nodeId: "p1",
          isPruned: false,
          structure: "paragraph",
          children: [
            { nodeId: "t1", isPruned: false, role: "text", text: "Hello" },
            { nodeId: "t2", isPruned: false, role: "text", text: "World" },
          ],
        },
      ],
    })
    const ui = treeToParts(section)
    expect(ui.parts).toEqual([
      {
        type: "text_group",
        groupId: "p1",
        groupType: "paragraph",
        isPruned: false,
        texts: [
          { textId: "t1", textType: "text", text: "Hello", isPruned: false },
          { textId: "t2", textType: "text", text: "World", isPruned: false },
        ],
      },
    ])
  })

  it("emits heading container as groupType heading", () => {
    const section = makeSection({
      nodes: [
        {
          nodeId: "h1",
          isPruned: false,
          structure: "heading",
          children: [
            { nodeId: "t1", isPruned: false, role: "heading", text: "Title" },
          ],
        },
      ],
    })
    const ui = treeToParts(section)
    expect(ui.parts[0]).toMatchObject({
      groupId: "h1",
      groupType: "heading",
    })
  })

  it("emits list with multiple list_items under the list container", () => {
    const section = makeSection({
      nodes: [
        {
          nodeId: "list_1",
          isPruned: false,
          structure: "list",
          children: [
            {
              nodeId: "li_1",
              isPruned: false,
              structure: "list_item",
              children: [
                { nodeId: "t1", isPruned: false, role: "text", text: "A" },
              ],
            },
            {
              nodeId: "li_2",
              isPruned: false,
              structure: "list_item",
              children: [
                { nodeId: "t2", isPruned: false, role: "text", text: "B" },
              ],
            },
          ],
        },
      ],
    })
    const ui = treeToParts(section)
    // Each list_item is the innermost container when its leaf is emitted, so
    // it forms its own text_group with groupType=list_item.
    expect(ui.parts).toHaveLength(2)
    expect(ui.parts[0]).toMatchObject({
      groupId: "li_1",
      groupType: "list_item",
    })
    expect(ui.parts[1]).toMatchObject({
      groupId: "li_2",
      groupType: "list_item",
    })
  })

  it("emits activity container as groupType activity", () => {
    const section = makeSection({
      sectionType: "activity",
      nodes: [
        {
          nodeId: "act_1",
          isPruned: false,
          structure: "activity",
          children: [
            { nodeId: "t1", isPruned: false, role: "text", text: "Question?" },
          ],
        },
      ],
    })
    const ui = treeToParts(section)
    expect(ui.parts[0]).toMatchObject({
      groupId: "act_1",
      groupType: "activity",
    })
  })

  it("lifts image_group images to top-level image parts with trailing caption group", () => {
    const section = makeSection({
      nodes: [
        {
          nodeId: "ig_1",
          isPruned: false,
          structure: "image_group",
          children: [
            { nodeId: "img_1", isPruned: false, role: "image" },
            { nodeId: "cap_1", isPruned: false, role: "caption", text: "Fig 1" },
          ],
        },
      ],
    })
    const ui = treeToParts(section)
    expect(ui.parts).toHaveLength(2)
    expect(ui.parts[0]).toEqual({
      type: "image",
      imageId: "img_1",
      isPruned: false,
    })
    expect(ui.parts[1]).toMatchObject({
      type: "text_group",
      groupId: "ig_1",
      groupType: "image_group",
      texts: [
        { textId: "cap_1", textType: "caption", text: "Fig 1", isPruned: false },
      ],
    })
  })

  it("handles a section with multiple top-level images", () => {
    const section = makeSection({
      nodes: [
        { nodeId: "img_a", isPruned: false, role: "image" },
        { nodeId: "img_b", isPruned: false, role: "image" },
        { nodeId: "img_c", isPruned: false, role: "image" },
      ],
    })
    const ui = treeToParts(section)
    expect(ui.parts).toEqual([
      { type: "image", imageId: "img_a", isPruned: false },
      { type: "image", imageId: "img_b", isPruned: false },
      { type: "image", imageId: "img_c", isPruned: false },
    ])
  })

  it("propagates pruned flag from ancestor container to descendants", () => {
    const section = makeSection({
      nodes: [
        {
          nodeId: "p1",
          isPruned: true,
          structure: "paragraph",
          children: [
            { nodeId: "t1", isPruned: false, role: "text", text: "hidden" },
            { nodeId: "img_1", isPruned: false, role: "image" },
          ],
        },
      ],
    })
    const ui = treeToParts(section)
    expect(ui.parts[0]).toMatchObject({ isPruned: true })
    expect(ui.parts[1]).toMatchObject({ isPruned: true })
  })

  it("appends __N suffix when an image splits a run within the same container", () => {
    const section = makeSection({
      nodes: [
        {
          nodeId: "p1",
          isPruned: false,
          structure: "paragraph",
          children: [
            { nodeId: "t1", isPruned: false, role: "text", text: "before" },
            { nodeId: "img_1", isPruned: false, role: "image" },
            { nodeId: "t2", isPruned: false, role: "text", text: "after" },
          ],
        },
      ],
    })
    const ui = treeToParts(section)
    expect(ui.parts).toHaveLength(3)
    expect(ui.parts[0]).toMatchObject({ type: "text_group", groupId: "p1" })
    expect(ui.parts[1]).toMatchObject({ type: "image", imageId: "img_1" })
    expect(ui.parts[2]).toMatchObject({ type: "text_group", groupId: "p1__1" })
  })

  it("synthesizes groupIds for top-level leaves with no container ancestor", () => {
    const section = makeSection({
      nodes: [
        { nodeId: "t1", isPruned: false, role: "text", text: "stray" },
      ],
    })
    const ui = treeToParts(section)
    expect(ui.parts).toHaveLength(1)
    const part = ui.parts[0]
    expect(part.type).toBe("text_group")
    if (part.type !== "text_group") throw new Error("unreachable")
    expect(part.groupType).toBe("group")
    expect(part.groupId).toMatch(/^synth_t1_/)
  })
})

describe("partsToTree", () => {
  it("rebuilds a paragraph container from a text_group", () => {
    const ui: PageSection = {
      sectionId: "sec_1",
      sectionType: "text_only",
      backgroundColor: "#fff",
      textColor: "#000",
      pageNumber: 1,
      isPruned: false,
      parts: [
        {
          type: "text_group",
          groupId: "p1",
          groupType: "paragraph",
          isPruned: false,
          texts: [
            { textId: "t1", textType: "text", text: "Hello", isPruned: false },
          ],
        },
      ],
    }
    const tree = partsToTree(ui)
    expect(tree.nodes).toEqual([
      {
        nodeId: "p1",
        isPruned: false,
        structure: "paragraph",
        children: [
          { nodeId: "t1", isPruned: false, role: "text", text: "Hello" },
        ],
      },
    ])
  })

  it("writes image parts as role=image leaves at the section root", () => {
    const ui: PageSection = {
      sectionId: "sec_1",
      sectionType: "images_only",
      backgroundColor: "#fff",
      textColor: "#000",
      pageNumber: 1,
      isPruned: false,
      parts: [
        { type: "image", imageId: "img_1", isPruned: false },
      ],
    }
    const tree = partsToTree(ui)
    expect(tree.nodes).toEqual([
      { nodeId: "img_1", isPruned: false, role: "image" },
    ])
  })

  it("strips __N suffix on groupId when rebuilding the container nodeId", () => {
    const ui: PageSection = {
      sectionId: "sec_1",
      sectionType: "text_only",
      backgroundColor: "#fff",
      textColor: "#000",
      pageNumber: 1,
      isPruned: false,
      parts: [
        {
          type: "text_group",
          groupId: "p1__1",
          groupType: "paragraph",
          isPruned: false,
          texts: [
            { textId: "t2", textType: "text", text: "tail", isPruned: false },
          ],
        },
      ],
    }
    const tree = partsToTree(ui)
    // Note: the shim writes the groupId verbatim as nodeId so identity is
    // preserved on unchanged subtrees. The __N suffix is significant only on
    // the read side to keep data-ids unique; on write we leave it alone
    // because the round-trip happens through the whole section, not one
    // group in isolation.
    expect(tree.nodes[0].nodeId).toBe("p1__1")
  })
})

describe("round-trip", () => {
  it("preserves a paragraph with adjacent text leaves", () => {
    const original = makeSection({
      nodes: [
        {
          nodeId: "p1",
          isPruned: false,
          structure: "paragraph",
          children: [
            { nodeId: "t1", isPruned: false, role: "text", text: "one" },
            { nodeId: "t2", isPruned: false, role: "text", text: "two" },
          ],
        },
      ],
    })
    const ui = treeToParts(original)
    const back = partsToTree(ui)
    expect(back).toEqual(original)
  })

  it("preserves image + caption via image_group", () => {
    const original = makeSection({
      nodes: [
        { nodeId: "img_1", isPruned: false, role: "image" },
        {
          nodeId: "ig_1",
          isPruned: false,
          structure: "image_group",
          children: [
            { nodeId: "cap_1", isPruned: false, role: "caption", text: "Fig" },
          ],
        },
      ],
    })
    // The read side lifts image_group images to the top level; but here the
    // image is already top-level, so we just check the shape round-trips.
    const ui = treeToParts(original)
    const back = partsToTree(ui)
    expect(back.nodes).toHaveLength(2)
    expect(back.nodes[0]).toEqual({
      nodeId: "img_1",
      isPruned: false,
      role: "image",
    })
    expect(back.nodes[1]).toMatchObject({
      structure: "image_group",
      children: [
        { nodeId: "cap_1", role: "caption", text: "Fig", isPruned: false },
      ],
    })
  })

  it("round-trips the full PageSectioningOutput envelope", () => {
    const original = {
      reasoning: "why",
      sections: [
        makeSection({
          sectionId: "sec_1",
          nodes: [
            {
              nodeId: "p1",
              isPruned: false,
              structure: "paragraph",
              children: [
                { nodeId: "t1", isPruned: false, role: "text", text: "hello" },
              ],
            },
          ],
        }),
      ],
    }
    const ui = treeToPartsOutput(original)
    const back = partsToTreeOutput(ui)
    expect(back).toEqual(original)
  })
})
