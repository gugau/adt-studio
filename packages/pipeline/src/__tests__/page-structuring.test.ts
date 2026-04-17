import { describe, expect, it } from "vitest"
import type {
  LLMContentNode,
  PageStructuringRefinementLLMOutput,
} from "@adt/types"
import type {
  GenerateObjectOptions,
  GenerateObjectResult,
  LLMModel,
} from "@adt/llm"
import {
  structurePage,
  type PageInput,
  type StructureConfig,
} from "../page-structuring.js"

interface ScriptedCall {
  attempts: unknown[]
}

const basePage: PageInput = {
  pageId: "pg001",
  pageNumber: 1,
  text: "Header\nBody",
  imageBase64: "cGFnZQ==",
  images: [],
}

const baseConfig: StructureConfig = {
  textTypes: [
    { key: "header", description: "Running page header" },
    { key: "body", description: "Body text" },
  ],
  containerTypes: [
    { key: "group", description: "Content group" },
  ],
  prunedTextTypes: ["header"],
  promptName: "page_structuring",
  modelId: "openai:gpt-5.4",
  maxRetries: 2,
  maxRefinements: 3,
}

function makeScriptedLLMModel(
  calls: ScriptedCall[],
  seenOptions: GenerateObjectOptions[]
): LLMModel {
  let callIndex = 0

  return {
    renderPrompt: async () => [],
    generateObject: async <T>(options: GenerateObjectOptions) => {
      seenOptions.push({
        ...options,
        context: options.context ? structuredClone(options.context) : options.context,
      })
      const call = calls[callIndex++]
      if (!call) {
        throw new Error("Unexpected generateObject call")
      }

      for (const attempt of call.attempts) {
        const validation = options.validate?.(attempt, options.context ?? {})
        if (validation && !validation.valid) {
          continue
        }
        return {
          object: attempt as T,
        } as GenerateObjectResult<T>
      }

      throw new Error("All scripted attempts failed validation")
    },
  }
}

function textNode(role: string, text: string): LLMContentNode {
  return { role, text }
}

function refinement(
  approved: boolean,
  reasoning: string,
  nodes: LLMContentNode[]
): PageStructuringRefinementLLMOutput {
  return { approved, reasoning, nodes }
}

describe("structurePage", () => {
  it("approves on the first refinement and finalizes node ids only for the final tree", async () => {
    const seenOptions: GenerateObjectOptions[] = []
    const llmModel = makeScriptedLLMModel(
      [
        {
          attempts: [
            {
              reasoning: "Initial structure",
              nodes: [textNode("body", "Body")],
            },
          ],
        },
        {
          attempts: [
            refinement(true, "Structure is accurate after review", [
              textNode("header", "Header"),
              textNode("body", "Body revised"),
            ]),
          ],
        },
      ],
      seenOptions
    )

    const result = await structurePage(basePage, baseConfig, llmModel)

    expect(seenOptions).toHaveLength(2)
    expect(seenOptions[0].log).toMatchObject({
      taskType: "page-structuring",
      promptName: "page_structuring",
    })
    expect(seenOptions[1].log).toMatchObject({
      taskType: "page-structuring",
      promptName: "page_structuring_refinement",
    })
    expect(result.reasoning).toBe("Structure is accurate after review")
    expect(result.nodes).toEqual([
      {
        nodeId: "pg001_nd001",
        role: "header",
        text: "Header",
        isPruned: true,
      },
      {
        nodeId: "pg001_nd002",
        role: "body",
        text: "Body revised",
        isPruned: false,
      },
    ])
  })

  it("continues refining until a later pass approves and forwards prior review notes", async () => {
    const seenOptions: GenerateObjectOptions[] = []
    const llmModel = makeScriptedLLMModel(
      [
        {
          attempts: [
            {
              reasoning: "Initial structure",
              nodes: [textNode("body", "Body")],
            },
          ],
        },
        {
          attempts: [
            refinement(false, "Missed the header", [textNode("body", "Body only")]),
          ],
        },
        {
          attempts: [
            refinement(false, "Reading order still needs work", [
              textNode("header", "Header"),
              textNode("body", "Body first"),
            ]),
          ],
        },
        {
          attempts: [
            refinement(true, "Structure is now correct", [
              textNode("header", "Header"),
              textNode("body", "Body final"),
            ]),
          ],
        },
      ],
      seenOptions
    )

    const result = await structurePage(basePage, baseConfig, llmModel)
    const secondRefinementContext = seenOptions[2].context as { prior_review_notes: string[] }
    const thirdRefinementContext = seenOptions[3].context as { prior_review_notes: string[] }

    expect(seenOptions).toHaveLength(4)
    expect(secondRefinementContext.prior_review_notes).toEqual(["Missed the header"])
    expect(thirdRefinementContext.prior_review_notes).toEqual([
      "Missed the header",
      "Reading order still needs work",
    ])
    expect(result.reasoning).toBe("Structure is now correct")
    expect(result.nodes[1]).toMatchObject({
      nodeId: "pg001_nd002",
      role: "body",
      text: "Body final",
    })
  })

  it("returns the latest valid candidate when all refinement passes reject", async () => {
    const seenOptions: GenerateObjectOptions[] = []
    const llmModel = makeScriptedLLMModel(
      [
        {
          attempts: [
            {
              reasoning: "Initial structure",
              nodes: [textNode("body", "Initial")],
            },
          ],
        },
        {
          attempts: [
            refinement(false, "Needs header", [textNode("body", "Draft 1")]),
          ],
        },
        {
          attempts: [
            refinement(false, "Needs image placement", [textNode("body", "Draft 2")]),
          ],
        },
        {
          attempts: [
            refinement(false, "Best available but still imperfect", [
              textNode("header", "Header"),
              textNode("body", "Draft 3"),
            ]),
          ],
        },
      ],
      seenOptions
    )

    const result = await structurePage(basePage, baseConfig, llmModel)

    expect(seenOptions).toHaveLength(4)
    expect(result.reasoning).toBe("Best available but still imperfect")
    expect(result.nodes).toEqual([
      {
        nodeId: "pg001_nd001",
        role: "header",
        text: "Header",
        isPruned: true,
      },
      {
        nodeId: "pg001_nd002",
        role: "body",
        text: "Draft 3",
        isPruned: false,
      },
    ])
  })

  it("uses the same validation hook for refinement outputs and accepts a later valid retry", async () => {
    const seenOptions: GenerateObjectOptions[] = []
    const invalidRefinement = refinement(false, "Bad refinement", [
      {
        role: "image",
        image_id: "missing_image",
      },
    ])
    const llmModel = makeScriptedLLMModel(
      [
        {
          attempts: [
            {
              reasoning: "Initial structure",
              nodes: [textNode("body", "Body")],
            },
          ],
        },
        {
          attempts: [
            invalidRefinement,
            refinement(true, "Fixed after validation retry", [
              textNode("body", "Body corrected"),
            ]),
          ],
        },
      ],
      seenOptions
    )

    const result = await structurePage(basePage, baseConfig, llmModel)
    const validation = seenOptions[1].validate?.(
      invalidRefinement,
      seenOptions[1].context ?? {}
    )

    expect(validation?.valid).toBe(false)
    expect(validation?.errors.join("\n")).toContain('Invalid image_id "missing_image"')
    expect(result.reasoning).toBe("Fixed after validation retry")
    expect(result.nodes[0]).toMatchObject({
      nodeId: "pg001_nd001",
      role: "body",
      text: "Body corrected",
      isPruned: false,
    })
  })
})
