import { describe, expect, it } from "vitest"
import type { AppConfig, PageSectioningOutput } from "@adt/types"
import type {
  GenerateObjectOptions,
  GenerateObjectResult,
  LLMModel,
} from "@adt/llm"
import {
  normalizeLocale,
  getBaseLanguage,
  shouldTranslate,
  buildTranslationConfig,
  translatePageTree,
} from "../translation.js"

const sampleStructuring: PageSectioningOutput = {
  reasoning: "Detected grouped text.",
  sections: [
    {
      sectionId: "pg001_sec001",
      sectionType: "text_only",
      backgroundColor: "#ffffff",
      textColor: "#000000",
      pageNumber: 1,
      isPruned: false,
      nodes: [
        {
          nodeId: "pg001_n001",
          isPruned: false,
          structure: "paragraph",
          children: [
            {
              nodeId: "pg001_n002",
              isPruned: false,
              role: "text",
              text: "Hello world",
            },
            {
              nodeId: "pg001_n003",
              isPruned: false,
              role: "text",
              text: "Read this aloud.",
            },
          ],
        },
      ],
    },
  ],
}

function makeFakeLLMModel(
  translations: string[],
  onCall?: (options: GenerateObjectOptions) => void
): LLMModel {
  return {
    generateObject: async <T>(options: GenerateObjectOptions) => {
      onCall?.(options)
      return {
        object: { translations } as T,
        usage: { inputTokens: 10, outputTokens: 10 },
      } as GenerateObjectResult<T>
    },
  }
}

describe("translation", () => {
  it("normalizes locale variants to dash format", () => {
    expect(normalizeLocale("en_US")).toBe("en-US")
    expect(normalizeLocale("pt-br")).toBe("pt-BR")
    expect(normalizeLocale("ur_pk")).toBe("ur-PK")
    expect(normalizeLocale("ES")).toBe("es")
  })

  it("extracts base language from locale variants", () => {
    expect(getBaseLanguage("en_US")).toBe("en")
    expect(getBaseLanguage("pt-br")).toBe("pt")
    expect(getBaseLanguage("ur_PK")).toBe("ur")
    expect(getBaseLanguage("ES")).toBe("es")
  })

  it("determines when translation is required", () => {
    expect(shouldTranslate("en", "en")).toBe(false)
    expect(shouldTranslate("en_US", "en-GB")).toBe(false)
    expect(shouldTranslate("es", "en")).toBe(true)
    expect(shouldTranslate(null, "en")).toBe(false)
    expect(shouldTranslate("en", undefined)).toBe(false)
  })

  it("builds translation config from app config", () => {
    const appConfig: AppConfig = {
      role_types: { text: "Main body text" },
      structure_types: { paragraph: "Paragraph" },
      editing_language: "fr",
      translation: { prompt: "custom_translation", model: "openai:gpt-5.4" },
    }

    const config = buildTranslationConfig(appConfig, "en")
    expect(config).toEqual({
      sourceLanguage: "en",
      targetLanguage: "fr",
      promptName: "custom_translation",
      modelId: "openai:gpt-5.4",
      maxRetries: 5,
    })
  })

  it("builds translation config for Urdu locales", () => {
    const appConfig: AppConfig = {
      role_types: { text: "Main body text" },
      structure_types: { paragraph: "Paragraph" },
      editing_language: "ur_pk",
    }

    const config = buildTranslationConfig(appConfig, "en_US")
    expect(config).toEqual({
      sourceLanguage: "en-US",
      targetLanguage: "ur-PK",
      promptName: "translation",
      modelId: "openai:gpt-4.1",
      maxRetries: 5,
    })
  })

  it("returns null translation config when source and target base languages match", () => {
    const appConfig: AppConfig = {
      role_types: { text: "Main body text" },
      structure_types: { paragraph: "Paragraph" },
      editing_language: "en-GB",
    }

    expect(buildTranslationConfig(appConfig, "en_US")).toBeNull()
  })

  it("translates all leaf text and preserves tree structure", async () => {
    const appConfig: AppConfig = {
      role_types: { text: "Main body text" },
      structure_types: { paragraph: "Paragraph" },
      editing_language: "fr",
    }
    const config = buildTranslationConfig(appConfig, "en")
    expect(config).not.toBeNull()

    let capturedOptions: GenerateObjectOptions | null = null
    const llmModel = makeFakeLLMModel(
      ["Bonjour le monde", "Lisez ceci a voix haute."],
      (options) => {
        capturedOptions = options
      }
    )

    const translated = await translatePageTree(
      "pg001",
      sampleStructuring,
      config!,
      llmModel
    )

    expect(capturedOptions?.prompt).toBe("translation")
    expect(
      (capturedOptions?.context?.texts as Array<{ text: string }>).map((t) => t.text)
    ).toEqual(["Hello world", "Read this aloud."])

    // Tree shape preserved: section and container node IDs unchanged.
    expect(translated.sections).toHaveLength(1)
    expect(translated.sections[0].sectionId).toBe("pg001_sec001")
    expect(translated.sections[0].nodes[0].nodeId).toBe("pg001_n001")
    expect(translated.sections[0].nodes[0].structure).toBe("paragraph")

    // Leaf texts replaced in reading order.
    const children = translated.sections[0].nodes[0].children!
    expect(children[0].text).toBe("Bonjour le monde")
    expect(children[0].role).toBe("text")
    expect(children[0].isPruned).toBe(false)
    expect(children[1].text).toBe("Lisez ceci a voix haute.")

    expect(translated.reasoning).toContain("Translated from en to fr.")
    expect(translated.reasoning).toContain(
      "Original reasoning: Detected grouped text."
    )
  })

  it("enforces translation count validation", async () => {
    const appConfig: AppConfig = {
      role_types: { text: "Main body text" },
      structure_types: { paragraph: "Paragraph" },
      editing_language: "fr",
    }
    const config = buildTranslationConfig(appConfig, "en")
    expect(config).not.toBeNull()

    let capturedOptions: GenerateObjectOptions | null = null
    const llmModel = makeFakeLLMModel(["Bonjour"], (options) => {
      capturedOptions = options
    })

    await translatePageTree("pg001", sampleStructuring, config!, llmModel)

    const validation = capturedOptions?.validate?.(
      { translations: ["Only one"] },
      {}
    )
    expect(validation?.valid).toBe(false)
    expect(validation?.errors[0]).toContain("Expected 2 translations but got 1")
  })

  it("returns original data when there are no leaf texts", async () => {
    const emptyStructuring: PageSectioningOutput = {
      reasoning: "No text found.",
      sections: [
        {
          sectionId: "pg001_sec001",
          sectionType: "text_only",
          backgroundColor: "#ffffff",
          textColor: "#000000",
          pageNumber: 1,
          isPruned: false,
          nodes: [],
        },
      ],
    }
    const config = {
      sourceLanguage: "en",
      targetLanguage: "fr",
      promptName: "translation",
      modelId: "openai:gpt-4.1",
      maxRetries: 5,
    }

    let called = false
    const llmModel: LLMModel = {
      generateObject: async <T>() => {
        called = true
        return { object: { translations: [] } as T }
      },
    }

    const result = await translatePageTree(
      "pg001",
      emptyStructuring,
      config,
      llmModel
    )

    expect(result).toBe(emptyStructuring)
    expect(called).toBe(false)
  })
})
