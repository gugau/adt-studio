import { describe, expect, it } from "vitest"
import type { AppConfig, TextClassificationOutput } from "@adt/types"
import type { LLMModel, GenerateObjectResult, GenerateObjectOptions } from "@adt/llm"
import {
  buildSectioningConfig,
  buildGroupSummaries,
  sectionPage,
  structureActivityParts,
  type GroupSummary,
} from "../page-sectioning.js"

describe("buildSectioningConfig", () => {
  it("extracts section types and config from AppConfig", () => {
    const appConfig: AppConfig = {
      text_types: { heading: "Heading" },
      text_group_types: { paragraph: "Paragraph" },
      section_types: {
        text_only: "Reading section with only text",
        images_only: "Section with only images",
      },
      pruned_section_types: ["credits"],
      page_sectioning: {
        prompt: "custom_sectioning",
        model: "openai:gpt-4.1-mini",
        max_retries: 7,
      },
    }

    const config = buildSectioningConfig(appConfig)
    expect(config.promptName).toBe("custom_sectioning")
    expect(config.modelId).toBe("openai:gpt-4.1-mini")
    expect(config.maxRetries).toBe(7)
    expect(config.sectionTypes).toEqual([
      { key: "text_only", description: "Reading section with only text" },
      { key: "images_only", description: "Section with only images" },
    ])
    expect(config.prunedSectionTypes).toEqual(["credits"])
  })

  it("excludes disabled section types from sectionTypes", () => {
    const appConfig: AppConfig = {
      text_types: { heading: "Heading" },
      text_group_types: { paragraph: "Paragraph" },
      section_types: {
        text_only: "Reading section with only text",
        images_only: "Section with only images",
        credits: "Credits section",
      },
      pruned_section_types: ["credits"],
      disabled_section_types: ["images_only"],
    }

    const config = buildSectioningConfig(appConfig)
    expect(config.sectionTypes).toEqual([
      { key: "text_only", description: "Reading section with only text" },
      { key: "credits", description: "Credits section" },
    ])
    expect(config.prunedSectionTypes).toEqual(["credits"])
  })

  it("handles empty disabled_section_types", () => {
    const appConfig: AppConfig = {
      text_types: { heading: "Heading" },
      text_group_types: { paragraph: "Paragraph" },
      section_types: { text_only: "Text" },
      disabled_section_types: [],
    }

    const config = buildSectioningConfig(appConfig)
    expect(config.sectionTypes).toEqual([
      { key: "text_only", description: "Text" },
    ])
  })

  it("defaults prompt and model when not specified", () => {
    const appConfig: AppConfig = {
      text_types: { heading: "Heading" },
      text_group_types: { paragraph: "Paragraph" },
    }

    const config = buildSectioningConfig(appConfig)
    expect(config.promptName).toBe("page_sectioning")
    expect(config.modelId).toBe("openai:gpt-5.4")
    expect(config.maxRetries).toBe(5)
    expect(config.sectionTypes).toEqual([])
    expect(config.prunedSectionTypes).toEqual([])
  })
})

describe("buildGroupSummaries", () => {
  it("builds summaries with individual text entry IDs", () => {
    const textClassification: TextClassificationOutput = {
      reasoning: "test",
      groups: [
        {
          groupId: "pg001_gp001",
          groupType: "paragraph",
          texts: [
            { textType: "section_text", text: "Hello world.", isPruned: false },
            { textType: "section_text", text: "More text.", isPruned: false },
          ],
          isPruned: false,
        },
        {
          groupId: "pg001_gp002",
          groupType: "heading",
          texts: [
            { textType: "section_heading", text: "Chapter 1", isPruned: false },
          ],
          isPruned: false,
        },
      ],
    }

    const summaries = buildGroupSummaries(textClassification)
    expect(summaries).toEqual([
      {
        groupId: "pg001_gp001",
        groupType: "paragraph",
        texts: [
          { textId: "pg001_gp001_tx001", textType: "section_text", text: "Hello world." },
          { textId: "pg001_gp001_tx002", textType: "section_text", text: "More text." },
        ],
      },
      {
        groupId: "pg001_gp002",
        groupType: "heading",
        texts: [
          { textId: "pg001_gp002_tx001", textType: "section_heading", text: "Chapter 1" },
        ],
      },
    ])
  })

  it("excludes groups where all texts are pruned", () => {
    const textClassification: TextClassificationOutput = {
      reasoning: "test",
      groups: [
        {
          groupId: "pg001_gp001",
          groupType: "paragraph",
          texts: [
            { textType: "header_text", text: "Header", isPruned: true },
          ],
          isPruned: false,
        },
        {
          groupId: "pg001_gp002",
          groupType: "paragraph",
          texts: [
            { textType: "section_text", text: "Body text", isPruned: false },
          ],
          isPruned: false,
        },
      ],
    }

    const summaries = buildGroupSummaries(textClassification)
    expect(summaries).toHaveLength(1)
    expect(summaries[0].groupId).toBe("pg001_gp002")
  })

  it("excludes pruned texts but preserves correct IDs", () => {
    const textClassification: TextClassificationOutput = {
      reasoning: "test",
      groups: [
        {
          groupId: "pg001_gp001",
          groupType: "paragraph",
          texts: [
            { textType: "page_number", text: "42", isPruned: true },
            { textType: "section_text", text: "Body text", isPruned: false },
          ],
          isPruned: false,
        },
      ],
    }

    const summaries = buildGroupSummaries(textClassification)
    expect(summaries).toEqual([
      {
        groupId: "pg001_gp001",
        groupType: "paragraph",
        texts: [
          // tx002 because tx001 (pruned) is at index 0
          { textId: "pg001_gp001_tx002", textType: "section_text", text: "Body text" },
        ],
      },
    ])
  })
})

describe("sectionPage", () => {
  it("returns empty sections when no content", async () => {
    const fakeLlm: LLMModel = {
      generateObject: async <T>() =>
        ({ object: { reasoning: "", sections: [] } as T }) as GenerateObjectResult<T>,
    }

    const result = await sectionPage(
      {
        pageId: "pg001",
        pageNumber: 1,
        pageImageBase64: "base64img",
        textClassification: { reasoning: "test", groups: [] },
        imageClassification: { images: [] },
        images: [],
      },
      {
        sectionTypes: [{ key: "text_only", description: "Text only" }],
        prunedSectionTypes: [],
        promptName: "page_sectioning",
        modelId: "openai:gpt-4o",
      },
      fakeLlm
    )

    expect(result.reasoning).toBe("No content to section")
    expect(result.sections).toEqual([])
  })

  it("calls LLM and post-processes sections", async () => {
    const response = {
      reasoning: "Grouped content logically",
      sections: [
        {
          section_type: "text_only",
          parts: ["pg001_gp001"],
          background_color: "#ffffff",
          text_color: "#000000",
          page_number: 1,
        },
        {
          section_type: "credits",
          parts: ["pg001_gp002"],
          background_color: "#f0f0f0",
          text_color: "#333333",
          page_number: null,
        },
      ],
    }

    const fakeLlm: LLMModel = {
      generateObject: async <T>() =>
        ({ object: response as T }) as GenerateObjectResult<T>,
    }

    const result = await sectionPage(
      {
        pageId: "pg001",
        pageNumber: 1,
        pageImageBase64: "base64img",
        textClassification: {
          reasoning: "test",
          groups: [
            {
              groupId: "pg001_gp001",
              groupType: "paragraph",
              texts: [
                {
                  textType: "section_text",
                  text: "Body text",
                  isPruned: false,
                },
              ],
              isPruned: false,
            },
            {
              groupId: "pg001_gp002",
              groupType: "paragraph",
              texts: [
                {
                  textType: "section_text",
                  text: "Credits info",
                  isPruned: false,
                },
              ],
              isPruned: false,
            },
          ],
        },
        imageClassification: { images: [] },
        images: [],
      },
      {
        sectionTypes: [
          { key: "text_only", description: "Text only" },
          { key: "credits", description: "Credits" },
        ],
        prunedSectionTypes: ["credits"],
        promptName: "page_sectioning",
        modelId: "openai:gpt-4o",
      },
      fakeLlm
    )

    expect(result.reasoning).toBe("Grouped content logically")
    expect(result.sections).toHaveLength(2)

    expect(result.sections[0]).toEqual({
      sectionId: "pg001_sec001",
      sectionType: "text_only",
      parts: [
        {
          type: "text_group",
          groupId: "pg001_gp001",
          groupType: "paragraph",
          texts: [
            { textId: "pg001_gp001_tx001", textType: "section_text", text: "Body text", isPruned: false },
          ],
          isPruned: false,
        },
      ],
      backgroundColor: "#ffffff",
      textColor: "#000000",
      pageNumber: 1,
      isPruned: false,
    })

    expect(result.sections[1]).toEqual({
      sectionId: "pg001_sec002",
      sectionType: "credits",
      parts: [
        {
          type: "text_group",
          groupId: "pg001_gp002",
          groupType: "paragraph",
          texts: [
            { textId: "pg001_gp002_tx001", textType: "section_text", text: "Credits info", isPruned: false },
          ],
          isPruned: false,
        },
      ],
      backgroundColor: "#f0f0f0",
      textColor: "#333333",
      pageNumber: null,
      isPruned: true,
    })
  })

  it("filters pruned images from LLM input", async () => {
    let capturedContext: Record<string, unknown> | undefined

    const fakeLlm: LLMModel = {
      generateObject: async <T>(opts: GenerateObjectOptions) => {
        capturedContext = opts.context
        return {
          object: { reasoning: "test", sections: [] } as T,
        } as GenerateObjectResult<T>
      },
    }

    await sectionPage(
      {
        pageId: "pg001",
        pageNumber: 1,
        pageImageBase64: "base64img",
        textClassification: {
          reasoning: "test",
          groups: [
            {
              groupId: "pg001_gp001",
              groupType: "paragraph",
              texts: [
                {
                  textType: "section_text",
                  text: "Body",
                  isPruned: false,
                },
              ],
              isPruned: false,
            },
          ],
        },
        imageClassification: {
          images: [
            { imageId: "pg001_im001", isPruned: true, reason: "too small" },
            { imageId: "pg001_im002", isPruned: false },
          ],
        },
        images: [
          { imageId: "pg001_im001", imageBase64: "small" },
          { imageId: "pg001_im002", imageBase64: "good" },
        ],
      },
      {
        sectionTypes: [{ key: "text_only", description: "Text only" }],
        prunedSectionTypes: [],
        promptName: "page_sectioning",
        modelId: "openai:gpt-4o",
      },
      fakeLlm
    )

    // Only unpruned image should be passed to LLM
    const images = capturedContext?.images as Array<{ image_id: string }>
    expect(images).toHaveLength(1)
    expect(images[0].image_id).toBe("pg001_im002")
  })

  it("adds unassigned parts as pruned to last non-pruned section", async () => {
    const response = {
      reasoning: "Only used first group",
      sections: [
        {
          section_type: "text_only",
          parts: ["pg001_gp001"],
          background_color: "#ffffff",
          text_color: "#000000",
          page_number: 1,
        },
      ],
    }

    const fakeLlm: LLMModel = {
      generateObject: async <T>() =>
        ({ object: response as T }) as GenerateObjectResult<T>,
    }

    const result = await sectionPage(
      {
        pageId: "pg001",
        pageNumber: 1,
        pageImageBase64: "base64img",
        textClassification: {
          reasoning: "test",
          groups: [
            {
              groupId: "pg001_gp001",
              groupType: "paragraph",
              texts: [
                { textType: "section_text", text: "Body", isPruned: false },
              ],
              isPruned: false,
            },
            {
              groupId: "pg001_gp002",
              groupType: "heading",
              texts: [
                { textType: "header_text", text: "Header", isPruned: true },
              ],
              isPruned: false,
            },
          ],
        },
        imageClassification: {
          images: [
            { imageId: "pg001_im001", isPruned: true, reason: "too small" },
          ],
        },
        images: [],
      },
      {
        sectionTypes: [{ key: "text_only", description: "Text only" }],
        prunedSectionTypes: [],
        promptName: "page_sectioning",
        modelId: "openai:gpt-4o",
      },
      fakeLlm
    )

    // Section should have the assigned group + unassigned group and image as pruned
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].parts).toHaveLength(3)
    expect(result.sections[0].parts[0]).toEqual({
      type: "text_group",
      groupId: "pg001_gp001",
      groupType: "paragraph",
      texts: [{ textId: "pg001_gp001_tx001", textType: "section_text", text: "Body", isPruned: false }],
      isPruned: false,
    })
    expect(result.sections[0].parts[1]).toEqual({
      type: "text_group",
      groupId: "pg001_gp002",
      groupType: "heading",
      texts: [{ textId: "pg001_gp002_tx001", textType: "header_text", text: "Header", isPruned: true }],
      isPruned: true,
    })
    expect(result.sections[0].parts[2]).toEqual({
      type: "image",
      imageId: "pg001_im001",
      isPruned: true,
      reason: "too small",
    })
  })

  it("expands LLM group objects into nested SectionParts", async () => {
    // Simulate the LLM producing structured groups for a multiple choice section
    const response = {
      reasoning: "Multiple choice question",
      sections: [
        {
          section_type: "activity_multiple_choice",
          parts: [
            "pg001_gp001",
            "pg001_gp002_tx001",
            {
              group_type: "option_group",
              items: [
                { group_type: "option", items: ["pg001_gp002_tx002"] },
                { group_type: "option", items: ["pg001_gp002_tx003"] },
                { group_type: "option", items: ["pg001_gp002_tx004"] },
              ],
            },
          ],
          background_color: "#ffffff",
          text_color: "#000000",
          page_number: 1,
        },
      ],
    }

    const fakeLlm: LLMModel = {
      generateObject: async <T>() =>
        ({ object: response as T }) as GenerateObjectResult<T>,
    }

    const result = await sectionPage(
      {
        pageId: "pg001",
        pageNumber: 1,
        pageImageBase64: "base64img",
        textClassification: {
          reasoning: "test",
          groups: [
            {
              groupId: "pg001_gp001",
              groupType: "list",
              texts: [
                { textType: "instruction_text", text: "Choose the best answer.", isPruned: false },
              ],
              isPruned: false,
            },
            {
              groupId: "pg001_gp002",
              groupType: "other",
              texts: [
                { textType: "section_text", text: "Elena was taken to her grandfather.", isPruned: false },
                { textType: "activity_option", text: "Elena's arrival", isPruned: false },
                { textType: "activity_option", text: "Elena's journey", isPruned: false },
                { textType: "activity_option", text: "Elena's costume", isPruned: false },
              ],
              isPruned: false,
            },
          ],
        },
        imageClassification: { images: [] },
        images: [],
      },
      {
        sectionTypes: [{ key: "activity_multiple_choice", description: "Multiple choice" }],
        prunedSectionTypes: [],
        promptName: "page_sectioning",
        modelId: "openai:gpt-4o",
      },
      fakeLlm
    )

    const section = result.sections[0]
    expect(section.sectionType).toBe("activity_multiple_choice")

    // First part: instruction text_group (whole group referenced by group ID)
    expect(section.parts[0]).toEqual({
      type: "text_group",
      groupId: "pg001_gp001",
      groupType: "list",
      texts: [
        { textId: "pg001_gp001_tx001", textType: "instruction_text", text: "Choose the best answer.", isPruned: false },
      ],
      isPruned: false,
    })

    // Second part: individual text entry for the question
    expect(section.parts[1]).toMatchObject({
      type: "text_group",
      groupId: "pg001_gp002_tx001_tg",
      texts: [
        { textId: "pg001_gp002_tx001", textType: "section_text", text: "Elena was taken to her grandfather." },
      ],
    })

    // Third part: option_group wrapping 3 options
    const optionGroup = section.parts[2]
    expect(optionGroup.type).toBe("group")
    if (optionGroup.type === "group") {
      expect(optionGroup.groupType).toBe("option_group")
      expect(optionGroup.parts).toHaveLength(3)

      // Each option is a group wrapping a single-text text_group
      for (const opt of optionGroup.parts) {
        expect(opt.type).toBe("group")
        if (opt.type === "group") {
          expect(opt.groupType).toBe("option")
          expect(opt.parts).toHaveLength(1)
          expect(opt.parts[0].type).toBe("text_group")
        }
      }

      // Verify option texts
      const optionTexts = optionGroup.parts.map((opt) => {
        if (opt.type === "group" && opt.parts[0].type === "text_group") {
          return opt.parts[0].texts[0].text
        }
        return ""
      })
      expect(optionTexts).toEqual(["Elena's arrival", "Elena's journey", "Elena's costume"])
    }
  })

  it("throws when no section types configured", async () => {
    const fakeLlm: LLMModel = {
      generateObject: async <T>() =>
        ({ object: { reasoning: "", sections: [] } as T }) as GenerateObjectResult<T>,
    }

    await expect(
      sectionPage(
        {
          pageId: "pg001",
          pageNumber: 1,
          pageImageBase64: "base64img",
          textClassification: {
            reasoning: "test",
            groups: [
              {
                groupId: "pg001_gp001",
                groupType: "paragraph",
                texts: [
                  {
                    textType: "section_text",
                    text: "Body",
                    isPruned: false,
                  },
                ],
                isPruned: false,
              },
            ],
          },
          imageClassification: { images: [] },
          images: [],
        },
        {
          sectionTypes: [],
          prunedSectionTypes: [],
          promptName: "page_sectioning",
          modelId: "openai:gpt-4o",
        },
        fakeLlm
      )
    ).rejects.toThrow("No section types configured")
  })
})

describe("structureActivityParts", () => {
  it("returns content sections unchanged", () => {
    const parts: import("@adt/types").SectionPart[] = [
      {
        type: "text_group",
        groupId: "tg1",
        groupType: "paragraph",
        texts: [{ textId: "t1", textType: "section_text", text: "Hello", isPruned: false }],
        isPruned: false,
      },
      { type: "image", imageId: "img1", isPruned: false },
    ]

    const result = structureActivityParts("text_only", parts)
    expect(result).toEqual(parts)
  })

  it("wraps all-option text_group entries into option_group", () => {
    // Like pg012 word bank: a text_group where all entries are activity_option
    const parts: import("@adt/types").SectionPart[] = [
      {
        type: "text_group",
        groupId: "tg1",
        groupType: "paragraph",
        texts: [{ textId: "t1", textType: "instruction_text", text: "Fill in blanks", isPruned: false }],
        isPruned: false,
      },
      {
        type: "text_group",
        groupId: "tg2",
        groupType: "list",
        texts: [
          { textId: "t2", textType: "activity_option", text: "word1", isPruned: false },
          { textId: "t3", textType: "activity_option", text: "word2", isPruned: false },
        ],
        isPruned: false,
      },
    ]

    const result = structureActivityParts("activity_fill_in_the_blank", parts)
    expect(result).toHaveLength(2)
    expect(result[0].type).toBe("text_group") // instruction unchanged
    expect(result[1].type).toBe("group")
    if (result[1].type === "group") {
      expect(result[1].groupType).toBe("option_group")
      expect(result[1].parts).toHaveLength(2)
      expect(result[1].parts[0].type).toBe("group")
      if (result[1].parts[0].type === "group") {
        expect(result[1].parts[0].groupType).toBe("option")
      }
    }
  })

  it("splits mixed text_group into question + options", () => {
    // Like pg011: section_text + activity_option in same text_group
    const parts: import("@adt/types").SectionPart[] = [
      {
        type: "text_group",
        groupId: "tg1",
        groupType: "other",
        texts: [
          { textId: "t1", textType: "section_text", text: "Question text", isPruned: false },
          { textId: "t2", textType: "activity_option", text: "Option A", isPruned: false },
          { textId: "t3", textType: "activity_option", text: "Option B", isPruned: false },
        ],
        isPruned: false,
      },
    ]

    const result = structureActivityParts("activity_multiple_choice", parts)
    expect(result).toHaveLength(2)

    // First: question text_group with options removed
    expect(result[0].type).toBe("text_group")
    if (result[0].type === "text_group") {
      expect(result[0].texts).toHaveLength(1)
      expect(result[0].texts[0].textType).toBe("section_text")
    }

    // Second: option_group with 2 options
    expect(result[1].type).toBe("group")
    if (result[1].type === "group") {
      expect(result[1].groupType).toBe("option_group")
      expect(result[1].parts).toHaveLength(2)
    }
  })

  it("preserves images between text parts", () => {
    const parts: import("@adt/types").SectionPart[] = [
      {
        type: "text_group",
        groupId: "tg1",
        groupType: "other",
        texts: [
          { textId: "t1", textType: "activity_option", text: "Opt A", isPruned: false },
          { textId: "t2", textType: "activity_option", text: "Opt B", isPruned: false },
        ],
        isPruned: false,
      },
      { type: "image", imageId: "img1", isPruned: false },
      {
        type: "text_group",
        groupId: "tg2",
        groupType: "other",
        texts: [
          { textId: "t3", textType: "activity_option", text: "Opt C", isPruned: false },
        ],
        isPruned: false,
      },
    ]

    const result = structureActivityParts("activity_multiple_choice", parts)
    // Options before image → option_group, then image, then another option_group
    expect(result).toHaveLength(3)
    expect(result[0].type).toBe("group") // option_group for Opt A, B
    expect(result[1].type).toBe("image")
    expect(result[2].type).toBe("group") // option_group for Opt C
  })

  it("handles pruned option entries gracefully", () => {
    const parts: import("@adt/types").SectionPart[] = [
      {
        type: "text_group",
        groupId: "tg1",
        groupType: "other",
        texts: [
          { textId: "t1", textType: "activity_option", text: "Active", isPruned: false },
          { textId: "t2", textType: "activity_option", text: "Pruned", isPruned: true },
        ],
        isPruned: false,
      },
    ]

    const result = structureActivityParts("activity_true_false", parts)
    // Pruned entries are excluded from option extraction; only the active option
    // becomes an option group. Since no non-pruned non-option entries remain,
    // the text_group is fully consumed.
    expect(result).toHaveLength(1)

    expect(result[0].type).toBe("group")
    if (result[0].type === "group") {
      expect(result[0].groupType).toBe("option_group")
      expect(result[0].parts).toHaveLength(1)
      // The single active option
      if (result[0].parts[0].type === "group") {
        expect(result[0].parts[0].groupType).toBe("option")
      }
    }
  })
})
