import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { DomUtils, parseDocument } from "htmlparser2"
import type { GenerateObjectOptions, GenerateObjectResult, LLMModel } from "@adt/llm"
import type { PageData } from "@adt/storage"
import { buildEasyReadConfig } from "../easy-read.js"
import {
  buildPageEasyReadBlocks,
  generateEasyRead,
  flattenEasyReadEntries,
  getEasyReadElementEligibility,
} from "../easy-read.js"

function makeFakeModel(
  fn: (texts: Array<{ index: number; text: string }>) => string[],
  onCall?: (options: GenerateObjectOptions) => void,
): LLMModel {
  return {
    generateObject: async <T>(options: GenerateObjectOptions) => {
      onCall?.(options)
      const context = options.context as { texts: Array<{ index: number; text: string }> }
      const object = { texts: fn(context.texts) }
      options.validate?.(object, options.context ?? {})
      return {
        object: object as T,
        usage: { inputTokens: 1, outputTokens: 1 },
      } as GenerateObjectResult<T>
    },
  }
}

const page: PageData = { pageId: "pg001", pageNumber: 1, text: "" }

describe("buildPageEasyReadBlocks", () => {
  it("selects non-interactive body text and excludes headings, images, and activity controls", () => {
    const blocks = buildPageEasyReadBlocks(
      page,
      {
        sections: [
          {
            sectionIndex: 0,
            sectionType: "text_only",
            reasoning: "",
            html: `
              <section>
                <h1 data-id="pg001_h001">Chapter title</h1>
                <p data-id="pg001_tx001">Photosynthesis makes food for plants.</p>
                <img data-id="pg001_im001" src="x.png" />
                <p class="activity-text" data-id="pg001_tx002">Do this activity.</p>
              </section>
            `,
          },
          {
            sectionIndex: 1,
            sectionType: "activity_multiple_choice",
            reasoning: "",
            html: `
              <section>
                <p data-id="pg001_tx003">Read the source and answer.</p>
                <button data-activity-item="item-1"><span data-id="pg001_tx004">Option A</span></button>
              </section>
            `,
          },
        ],
      },
      {
        reasoning: "",
        sections: [
          {
            sectionId: "pg001_sec001",
            sectionType: "text_only",
            backgroundColor: "#fff",
            textColor: "#000",
            pageNumber: 1,
            isPruned: false,
            nodes: [],
          },
          {
            sectionId: "pg001_sec002",
            sectionType: "activity_multiple_choice",
            backgroundColor: "#fff",
            textColor: "#000",
            pageNumber: 1,
            isPruned: false,
            nodes: [],
          },
        ],
      },
    )

    expect(blocks).toHaveLength(2)
    expect(blocks[0].entries).toEqual([
      {
        sourceId: "pg001_tx001",
        easyReadId: "pg001_tx001_easy_read",
        originalText: "Photosynthesis makes food for plants.",
        text: "Photosynthesis makes food for plants.",
        pageId: "pg001",
        sectionId: "pg001_sec001",
        sectionIndex: 0,
      },
    ])
    expect(blocks[1].entries).toEqual([
      {
        sourceId: "pg001_tx003",
        easyReadId: "pg001_tx003_easy_read",
        originalText: "Read the source and answer.",
        text: "Read the source and answer.",
        pageId: "pg001",
        sectionId: "pg001_sec002",
        sectionIndex: 1,
      },
    ])
  })

  it("reports why rendered elements are excluded from Easy Read", () => {
    const doc = parseDocument(`
      <section>
        <p data-id="pg001_tx001">Body text.</p>
        <h2 data-id="pg001_h001">Heading</h2>
        <img data-id="pg001_im001" src="x.png" />
        <figcaption data-id="pg001_im002">Generated image caption.</figcaption>
        <div data-id="activity_gen_opt1">Generated option.</div>
        <p class="activity-text" data-id="pg001_tx002">Activity instruction.</p>
        <button data-activity-item="item-1"><span data-id="pg001_tx003">Option</span></button>
        <p data-id="pg001_tx004">   </p>
      </section>
    `)
    const elements = DomUtils.findAll(
      (el) => el.type === "tag" && el.attribs?.["data-id"] !== undefined,
      doc.children,
    )
    const reasons = new Map(
      elements.map((el) => [
        el.attribs["data-id"],
        getEasyReadElementEligibility(el).reason ?? "eligible",
      ]),
    )

    expect(reasons.get("pg001_tx001")).toBe("eligible")
    expect(reasons.get("pg001_h001")).toBe("heading")
    expect(reasons.get("pg001_im001")).toBe("image")
    expect(reasons.get("pg001_im002")).toBe("image-caption")
    expect(reasons.get("activity_gen_opt1")).toBe("activity-generated")
    expect(reasons.get("pg001_tx002")).toBe("excluded-context")
    expect(reasons.get("pg001_tx003")).toBe("excluded-context")
    expect(reasons.get("pg001_tx004")).toBe("empty-text")
  })

  it("keeps captions and interactive text out while allowing safe activity prompt text", () => {
    const blocks = buildPageEasyReadBlocks(
      page,
      {
        sections: [
          {
            sectionIndex: 0,
            sectionType: "text_only",
            reasoning: "",
            html: `
              <section>
                <p data-id="pg001_tx001">Body text.</p>
                <figcaption data-id="pg001_im001">Caption text.</figcaption>
                <button data-activity-item="item-1"><span data-id="pg001_tx002">Option</span></button>
              </section>
            `,
          },
          {
            sectionIndex: 1,
            sectionType: "activity_open_ended_answer",
            reasoning: "",
            html: `
              <section>
                <table>
                  <tbody>
                    <tr>
                      <td><span data-id="pg001_tx003">Los bovidos, los cervidos, los camelidos y los jirafidos son animales rumiantes que se alimentan de vegetales.</span></td>
                      <td><input data-activity-item="item-1" aria-label="answer" /></td>
                    </tr>
                  </tbody>
                </table>
                <button data-activity-item="item-2"><span data-id="pg001_tx004">Interactive option</span></button>
              </section>
            `,
          },
        ],
      },
      {
        reasoning: "",
        sections: [
          {
            sectionId: "pg001_sec001",
            sectionType: "text_only",
            backgroundColor: "#fff",
            textColor: "#000",
            pageNumber: 1,
            isPruned: false,
            nodes: [],
          },
          {
            sectionId: "pg001_sec002",
            sectionType: "activity_open_ended_answer",
            backgroundColor: "#fff",
            textColor: "#000",
            pageNumber: 1,
            isPruned: false,
            nodes: [],
          },
        ],
      },
    )

    expect(blocks).toHaveLength(2)
    expect(blocks[0].entries.map((entry) => entry.sourceId)).toEqual(["pg001_tx001"])
    expect(blocks[1].entries.map((entry) => entry.sourceId)).toEqual(["pg001_tx003"])
    expect(blocks[1].entries[0].originalText).toBe(
      "Los bovidos, los cervidos, los camelidos y los jirafidos son animales rumiantes que se alimentan de vegetales.",
    )
  })

  it("deduplicates repeated data-ids from responsive activity layouts", () => {
    const blocks = buildPageEasyReadBlocks(
      page,
      {
        sections: [
          {
            sectionIndex: 0,
            sectionType: "activity_open_ended_answer",
            reasoning: "",
            html: `
              <section>
                <div class="hidden md:block">
                  <span data-id="pg001_tx001">Long activity summary.</span>
                </div>
                <div class="md:hidden">
                  <span data-id="pg001_tx001">Long activity summary.</span>
                </div>
              </section>
            `,
          },
        ],
      },
      {
        reasoning: "",
        sections: [
          {
            sectionId: "pg001_sec001",
            sectionType: "activity_open_ended_answer",
            backgroundColor: "#fff",
            textColor: "#000",
            pageNumber: 1,
            isPruned: false,
            nodes: [],
          },
        ],
      },
    )

    expect(blocks).toHaveLength(1)
    expect(blocks[0].entries.map((entry) => entry.sourceId)).toEqual(["pg001_tx001"])
  })
})

describe("generateEasyRead", () => {
  it("defaults Easy Read to disabled unless a book opts in", () => {
    const config = buildEasyReadConfig(
      {
        role_types: { text: "Text" },
        structure_types: { paragraph: "Paragraph" },
      },
      "en",
    )

    expect(config.enabled).toBe(false)
  })

  it("generates _easy_read entries and validates response count", async () => {
    const config = buildEasyReadConfig(
      {
        role_types: { text: "Text" },
        structure_types: { paragraph: "Paragraph" },
        easy_read: { enabled: true, batch_size: 2 },
      },
      "en",
    )
    let sawValidator = false
    const model = makeFakeModel(
      (texts) => texts.map((t) => `Easy: ${t.text}`),
      (options) => {
        sawValidator = typeof options.validate === "function"
      },
    )

    const output = await generateEasyRead(
      [
        {
          pageId: "pg001",
          pageNumber: 1,
          sectionId: "pg001_sec001",
          sectionIndex: 0,
          sectionType: "text_only",
          entries: [
            {
              sourceId: "pg001_tx001",
              easyReadId: "pg001_tx001_easy_read",
              originalText: "A complex sentence.",
              text: "A complex sentence.",
              pageId: "pg001",
              sectionId: "pg001_sec001",
              sectionIndex: 0,
            },
          ],
        },
      ],
      config,
      model,
    )

    expect(sawValidator).toBe(true)
    expect(flattenEasyReadEntries(output)).toEqual([
      { id: "pg001_tx001_easy_read", text: "Easy: A complex sentence." },
    ])
  })

  it("passes section text as context while preserving one response per entry", async () => {
    const config = buildEasyReadConfig(
      {
        role_types: { text: "Text" },
        structure_types: { paragraph: "Paragraph" },
        easy_read: { enabled: true, batch_size: 10 },
      },
      "es",
    )
    let sectionText = ""
    const model = makeFakeModel(
      (texts) => texts.map((t) => `Adaptado: ${t.text}`),
      (options) => {
        const context = options.context as { section_text?: string }
        sectionText = context.section_text ?? ""
      },
    )

    await generateEasyRead(
      [
        {
          pageId: "pg001",
          pageNumber: 1,
          sectionId: "pg001_sec001",
          sectionIndex: 0,
          sectionType: "text_only",
          entries: [
            {
              sourceId: "pg001_tx001",
              easyReadId: "pg001_tx001_easy_read",
              originalText: "Primera idea compleja.",
              text: "Primera idea compleja.",
              pageId: "pg001",
              sectionId: "pg001_sec001",
              sectionIndex: 0,
            },
            {
              sourceId: "pg001_tx002",
              easyReadId: "pg001_tx002_easy_read",
              originalText: "Segunda idea compleja.",
              text: "Segunda idea compleja.",
              pageId: "pg001",
              sectionId: "pg001_sec001",
              sectionIndex: 0,
            },
          ],
        },
      ],
      config,
      model,
    )

    expect(sectionText).toBe("Primera idea compleja.\nSegunda idea compleja.")
  })

  it("allows prompt-shaped outputs for questions, enumerations, simple text, and abstract concepts", async () => {
    const config = buildEasyReadConfig(
      {
        role_types: { text: "Text" },
        structure_types: { paragraph: "Paragraph" },
        easy_read: { enabled: true, batch_size: 10 },
      },
      "es",
    )
    const outputs = [
      "¿Que tan lejos pueden ver los gatos?",
      "La democracia tiene varias dimensiones:\n- politica\n- social\n- cultural\n- economica",
      "El agua es necesaria para vivir.",
      "La solidaridad significa que las personas de un grupo ayudan y actuan juntas.",
    ]
    const model = makeFakeModel(() => outputs)

    const output = await generateEasyRead(
      [
        {
          pageId: "pg001",
          pageNumber: 1,
          sectionId: "pg001_sec001",
          sectionIndex: 0,
          sectionType: "text_only",
          entries: [
            {
              sourceId: "pg001_tx001",
              easyReadId: "pg001_tx001_easy_read",
              originalText: "¿A que distancia pueden ver los felinos?",
              text: "¿A que distancia pueden ver los felinos?",
              pageId: "pg001",
              sectionId: "pg001_sec001",
              sectionIndex: 0,
            },
            {
              sourceId: "pg001_tx002",
              easyReadId: "pg001_tx002_easy_read",
              originalText: "La democracia tiene dimensiones politica, social, cultural y economica.",
              text: "La democracia tiene dimensiones politica, social, cultural y economica.",
              pageId: "pg001",
              sectionId: "pg001_sec001",
              sectionIndex: 0,
            },
            {
              sourceId: "pg001_tx003",
              easyReadId: "pg001_tx003_easy_read",
              originalText: "El agua es necesaria para vivir.",
              text: "El agua es necesaria para vivir.",
              pageId: "pg001",
              sectionId: "pg001_sec001",
              sectionIndex: 0,
            },
            {
              sourceId: "pg001_tx004",
              easyReadId: "pg001_tx004_easy_read",
              originalText: "La solidaridad supone actuar como un todo.",
              text: "La solidaridad supone actuar como un todo.",
              pageId: "pg001",
              sectionId: "pg001_sec001",
              sectionIndex: 0,
            },
          ],
        },
      ],
      config,
      model,
    )

    expect(flattenEasyReadEntries(output)).toEqual([
      { id: "pg001_tx001_easy_read", text: outputs[0] },
      { id: "pg001_tx002_easy_read", text: outputs[1] },
      { id: "pg001_tx003_easy_read", text: outputs[2] },
      { id: "pg001_tx004_easy_read", text: outputs[3] },
    ])
  })
})

describe("easy_read prompt", () => {
  it("documents the compatibility contract and restrained section context usage", () => {
    const prompt = fs.readFileSync(path.join(process.cwd(), "prompts", "easy_read.liquid"), "utf-8")

    expect(prompt).toContain("Usa el contexto para entender referencias, sujetos omitidos, continuidad")
    expect(prompt).toContain("No copies información del contexto")
    expect(prompt).toContain("Cada salida debe corresponder solo al texto de entrada con el mismo índice")
    expect(prompt).toContain("No fusiones varios textos de entrada")
    expect(prompt).toContain("El idioma de salida debe ser {{ language }} ({{ language_code }})")
    expect(prompt).toContain("Si el texto de entrada enumera 3 o más elementos como ejemplos, partes, características")
    expect(prompt).toContain("No mantengas 3 o más elementos separados solo por comas dentro de una tabla")
    expect(prompt).toContain("Cada viñeta debe empezar con guion y un espacio")
    expect(prompt).toContain("Si 3 o más elementos son el sujeto de una sola frase corta y muy clara")
  })
})
