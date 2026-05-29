import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AppConfig, ProgressEvent } from "@adt/types"
import { createBookStorage } from "@adt/storage"
import {
  buildStageRunnerImageClassifyConfig,
  createStageRunner,
} from "./stage-runner.js"

const {
  capturedCaptionInputs,
  captionPageImagesMock,
  generateSpeechFileMock,
  renderPageMock,
  sectionPageMock,
  transcribeWithWhisperMock,
} = vi.hoisted(() => {
  const capturedCaptionInputs: unknown[] = []
  return {
    capturedCaptionInputs,
    captionPageImagesMock: vi.fn(async (input: unknown) => {
      capturedCaptionInputs.push(input)
      return { captions: [] }
    }),
    generateSpeechFileMock: vi.fn(),
    renderPageMock: vi.fn(async () => ({ sections: [] })),
    sectionPageMock: vi.fn(async () => ({ reasoning: "", sections: [] })),
    transcribeWithWhisperMock: vi.fn(),
  }
})

vi.mock("@adt/pipeline", async () => {
  const actual = await vi.importActual<typeof import("@adt/pipeline")>(
    "@adt/pipeline"
  )
  return {
    ...actual,
    captionPageImages: captionPageImagesMock,
    generateSpeechFile: generateSpeechFileMock,
    renderPage: renderPageMock,
    sectionPage: sectionPageMock,
  }
})

vi.mock("@adt/llm", async () => {
  const actual = await vi.importActual<typeof import("@adt/llm")>("@adt/llm")
  return {
    ...actual,
    transcribeWithWhisper: transcribeWithWhisperMock,
  }
})

function writeBaseConfig(configPath: string): void {
  fs.writeFileSync(
    configPath,
    `role_types:
  section_text: Main body text
structure_types:
  paragraph: Paragraph
`
  )
}

function seedCaptionBook(
  booksDir: string,
  label: string,
  bookSummary?: string
): void {
  const storage = createBookStorage(label, booksDir)
  try {
    storage.putExtractedPage({
      pageId: "pg001",
      pageNumber: 1,
      text: "Page text",
      pageImage: {
        imageId: "pg001_page",
        buffer: Buffer.from("fake-page-image"),
        format: "png",
        hash: "hash-page",
        width: 800,
        height: 600,
      },
      images: [
        {
          imageId: "pg001_im001",
          buffer: Buffer.from("fake-image"),
          format: "png",
          hash: "hash-image",
          width: 400,
          height: 300,
        },
      ],
    })

    storage.putNodeData("web-rendering", "pg001", {
      sections: [
        {
          sectionIndex: 0,
          sectionType: "content",
          reasoning: "",
          html: '<section><img data-id="pg001_im001" src="x" /></section>',
        },
      ],
    })

    if (bookSummary) {
      storage.putNodeData("book-summary", "book", { summary: bookSummary })
    }
  } finally {
    storage.close()
  }
}

function seedStoryboardBook(booksDir: string, label: string): void {
  const storage = createBookStorage(label, booksDir)
  try {
    storage.putExtractedPage({
      pageId: "pg001",
      pageNumber: 1,
      text: "Page text",
      pageImage: {
        imageId: "pg001_page",
        buffer: Buffer.from("fake-page-image"),
        format: "png",
        hash: "hash-page",
        width: 800,
        height: 600,
      },
      images: [
        {
          imageId: "pg001_im001",
          buffer: Buffer.from("fake-image"),
          format: "png",
          hash: "hash-image",
          width: 400,
          height: 300,
        },
      ],
    })

    storage.putNodeData("page-sectioning", "pg001", {
      reasoning: "existing sectioning",
      sections: [
        {
          sectionId: "pg001_sec001",
          sectionType: "content",
          backgroundColor: "#ffffff",
          textColor: "#000000",
          pageNumber: 1,
          isPruned: false,
          nodes: [
            {
              nodeId: "pg001_n001",
              isPruned: false,
              role: "text",
              text: "Hello",
            },
          ],
        },
      ],
    })
  } finally {
    storage.close()
  }
}

function seedStoryboardBookPages(
  booksDir: string,
  label: string,
  pageIds: string[]
): void {
  const storage = createBookStorage(label, booksDir)
  try {
    pageIds.forEach((pageId, idx) => {
      storage.putExtractedPage({
        pageId,
        pageNumber: idx + 1,
        text: "Page text",
        pageImage: {
          imageId: `${pageId}_page`,
          buffer: Buffer.from("fake-page-image"),
          format: "png",
          hash: `hash-page-${pageId}`,
          width: 800,
          height: 600,
        },
        images: [],
      })
      storage.putNodeData("page-sectioning", pageId, {
        reasoning: "existing sectioning",
        sections: [
          {
            sectionId: `${pageId}_sec001`,
            sectionType: "content",
            backgroundColor: "#ffffff",
            textColor: "#000000",
            pageNumber: idx + 1,
            isPruned: false,
            nodes: [
              { nodeId: `${pageId}_n001`, isPruned: false, role: "text", text: "Hello" },
            ],
          },
        ],
      })
    })
  } finally {
    storage.close()
  }
}

function seedTextAndSpeechBook(booksDir: string, label: string): void {
  const storage = createBookStorage(label, booksDir)
  try {
    storage.putExtractedPage({
      pageId: "pg001",
      pageNumber: 1,
      text: "Page text",
      pageImage: {
        imageId: "pg001_page",
        buffer: Buffer.from("fake-page-image"),
        format: "png",
        hash: "hash-page",
        width: 800,
        height: 600,
      },
      images: [],
    })

    storage.putNodeData("web-rendering", "pg001", {
      sections: [
        {
          sectionIndex: 0,
          sectionType: "content",
          reasoning: "",
          html: '<p data-id="pg001_t001">Hello world</p>',
        },
      ],
    })
  } finally {
    storage.close()
  }
}

describe("buildStageRunnerImageClassifyConfig", () => {
  it("injects getImageBytes so min_stddev filtering can decode image bytes", () => {
    const config: AppConfig = {
      role_types: { section_text: "Main body text" },
      structure_types: { paragraph: "Paragraph" },
      image_filters: {
        min_side: 100,
        min_stddev: 2,
        meaningfulness: true,
      },
    }
    const expectedBytes = Buffer.from("fake-image-bytes")
    const storage = {
      getImageBase64: (_imageId: string) => expectedBytes.toString("base64"),
    }

    const imageConfig = buildStageRunnerImageClassifyConfig(config, storage)

    expect(imageConfig.filters).toEqual({
      min_side: 100,
      min_stddev: 2,
      meaningfulness: true,
    })
    expect(imageConfig.getImageBytes).toBeTypeOf("function")
    expect(imageConfig.getImageBytes?.("pg001_im001")).toEqual(expectedBytes)
  })
})

describe("createStageRunner captions step", () => {
  let tmpDir = ""

  beforeEach(() => {
    capturedCaptionInputs.length = 0
    captionPageImagesMock.mockClear()
    generateSpeechFileMock.mockReset()
    generateSpeechFileMock.mockResolvedValue(undefined)
    transcribeWithWhisperMock.mockReset()
    transcribeWithWhisperMock.mockResolvedValue({
      text: "Hello world",
      duration: 1,
      words: [
        { word: "Hello", start: 0, end: 0.45 },
        { word: "world", start: 0.45, end: 0.9 },
      ],
    })
    renderPageMock.mockClear()
    sectionPageMock.mockClear()
  })

  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
      tmpDir = ""
    }
  })

  it("passes book summary to captionPageImages when summary exists", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "stage-runner-captions-"))
    const booksDir = path.join(tmpDir, "books")
    const promptsDir = path.join(tmpDir, "prompts")
    const configPath = path.join(tmpDir, "config.yaml")
    fs.mkdirSync(promptsDir, { recursive: true })
    writeBaseConfig(configPath)

    seedCaptionBook(
      booksDir,
      "with-summary",
      "A grade 3 science textbook about the water cycle."
    )

    const runner = createStageRunner()
    await runner.run(
      "with-summary",
      {
        booksDir,
        apiKey: "sk-test",
        promptsDir,
        configPath,
        fromStage: "captions",
        toStage: "captions",
      },
      { emit: () => {} }
    )

    expect(captionPageImagesMock).toHaveBeenCalledTimes(1)
    const firstInput = capturedCaptionInputs[0] as { bookSummary?: string }
    expect(firstInput.bookSummary).toBe(
      "A grade 3 science textbook about the water cycle."
    )
  })

  it("omits book summary when summary node is missing", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "stage-runner-captions-"))
    const booksDir = path.join(tmpDir, "books")
    const promptsDir = path.join(tmpDir, "prompts")
    const configPath = path.join(tmpDir, "config.yaml")
    fs.mkdirSync(promptsDir, { recursive: true })
    writeBaseConfig(configPath)

    seedCaptionBook(booksDir, "without-summary")

    const runner = createStageRunner()
    await runner.run(
      "without-summary",
      {
        booksDir,
        apiKey: "sk-test",
        promptsDir,
        configPath,
        fromStage: "captions",
        toStage: "captions",
      },
      { emit: () => {} }
    )

    expect(captionPageImagesMock).toHaveBeenCalledTimes(1)
    const firstInput = capturedCaptionInputs[0] as { bookSummary?: string }
    expect(firstInput.bookSummary).toBeUndefined()
  })
})

describe("createStageRunner storyboard render-only", () => {
  let tmpDir = ""

  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
      tmpDir = ""
    }
  })

  it("skips page sectioning and re-renders from existing section data", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "stage-runner-storyboard-"))
    const booksDir = path.join(tmpDir, "books")
    const promptsDir = path.join(tmpDir, "prompts")
    const configPath = path.join(tmpDir, "config.yaml")
    fs.mkdirSync(promptsDir, { recursive: true })
    writeBaseConfig(configPath)
    seedStoryboardBook(booksDir, "render-only")

    const events: ProgressEvent[] = []
    const runner = createStageRunner()
    await runner.run(
      "render-only",
      {
        booksDir,
        apiKey: "sk-test",
        promptsDir,
        configPath,
        fromStage: "storyboard",
        toStage: "storyboard",
        renderOnly: true,
      },
      { emit: (event) => events.push(event) }
    )

    expect(sectionPageMock).not.toHaveBeenCalled()
    expect(renderPageMock).toHaveBeenCalledTimes(1)
    expect(
      events.some(
        (event) =>
          event.type === "step-complete" && event.step === "web-rendering"
      )
    ).toBe(true)
    // page-sectioning is not part of the storyboard stage (it lives in the
    // sectioning stage), so running storyboard in render-only mode should
    // neither complete nor emit any events for page-sectioning.
    expect(
      events.some(
        (event) =>
          event.type === "step-complete" && event.step === "page-sectioning"
      )
    ).toBe(false)
  })
})

describe("createStageRunner cancellation", () => {
  let tmpDir = ""

  beforeEach(() => {
    renderPageMock.mockReset()
  })

  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
      tmpDir = ""
    }
  })

  it("cancels storyboard mid-run: keeps rendered pages and leaves the step not complete", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "stage-runner-cancel-"))
    const booksDir = path.join(tmpDir, "books")
    const promptsDir = path.join(tmpDir, "prompts")
    const configPath = path.join(tmpDir, "config.yaml")
    fs.mkdirSync(promptsDir, { recursive: true })
    // concurrency: 1 so the run awaits each page; the abort then takes effect
    // before the next page is scheduled.
    fs.writeFileSync(
      configPath,
      `role_types:
  section_text: Main body text
structure_types:
  paragraph: Paragraph
concurrency: 1
`
    )
    seedStoryboardBookPages(booksDir, "cancel-storyboard", ["pg001", "pg002"])

    const controller = new AbortController()
    renderPageMock.mockImplementation(async () => {
      // Abort as soon as the first page renders; the second must not start.
      controller.abort()
      return { sections: [] }
    })

    const events: ProgressEvent[] = []
    const runner = createStageRunner()
    await runner.run(
      "cancel-storyboard",
      {
        booksDir,
        apiKey: "sk-test",
        promptsDir,
        configPath,
        fromStage: "storyboard",
        toStage: "storyboard",
        signal: controller.signal,
      },
      { emit: (event) => events.push(event) }
    )

    // Scheduling stopped after the abort — only the first page rendered.
    expect(renderPageMock).toHaveBeenCalledTimes(1)

    // The interrupted step must NOT be marked complete (that would let the next
    // stage treat a partial step as finished). It surfaces as a step error.
    expect(
      events.some((e) => e.type === "step-complete" && e.step === "web-rendering")
    ).toBe(false)
    expect(
      events.some((e) => e.type === "step-error" && e.step === "web-rendering")
    ).toBe(true)

    const storage = createBookStorage("cancel-storyboard", booksDir)
    try {
      const step = storage.getStepRuns().find((s) => s.step === "web-rendering")
      expect(step?.status).toBe("error")
      expect(step?.error).toContain("re-run to resume")
      // The page that finished before the cancel is kept.
      expect(storage.getLatestNodeData("web-rendering", "pg001")).not.toBeNull()
      // The page that never started has no rendering.
      expect(storage.getLatestNodeData("web-rendering", "pg002")).toBeNull()
    } finally {
      storage.close()
    }
  })
})

describe("createStageRunner speech Gemini partial failures", () => {
  let tmpDir = ""

  beforeEach(() => {
    generateSpeechFileMock.mockReset()
    generateSpeechFileMock.mockResolvedValue(undefined)
    transcribeWithWhisperMock.mockReset()
    transcribeWithWhisperMock.mockResolvedValue({
      text: "Hello world",
      duration: 1,
      words: [
        { word: "Hello", start: 0, end: 0.45 },
        { word: "world", start: 0.45, end: 0.9 },
      ],
    })
  })

  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
      tmpDir = ""
    }
  })

  it("keeps Gemini TTS in error state when some audio items fail", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "stage-runner-tts-"))
    const booksDir = path.join(tmpDir, "books")
    const promptsDir = path.join(tmpDir, "prompts")
    const configPath = path.join(tmpDir, "config.yaml")
    fs.mkdirSync(promptsDir, { recursive: true })
    fs.writeFileSync(
      configPath,
      `role_types:
  section_text: Main body text
structure_types:
  paragraph: Paragraph
speech:
  default_provider: gemini
  providers:
    gemini:
      languages:
        - en
`
    )
    seedTextAndSpeechBook(booksDir, "gemini-tts-failure")

    generateSpeechFileMock.mockRejectedValueOnce(
      new Error("Gemini TTS response did not include audio data")
    )

    const events: ProgressEvent[] = []
    const runner = createStageRunner()
    await runner.run(
      "gemini-tts-failure",
      {
        booksDir,
        apiKey: "sk-test",
        geminiApiKey: "gm-test",
        promptsDir,
        configPath,
        fromStage: "translate",
        toStage: "speech",
      },
      { emit: (event) => events.push(event) }
    )

    expect(
      events.some(
        (event) =>
          event.type === "step-error" &&
          event.step === "tts" &&
          event.error.includes("Missing Gemini audio can be generated one by one")
      )
    ).toBe(true)
    expect(
      events.some(
        (event) => event.type === "step-complete" && event.step === "tts"
      )
    ).toBe(false)

    const storage = createBookStorage("gemini-tts-failure", booksDir)
    try {
      const ttsStep = storage.getStepRuns().find((step) => step.step === "tts")
      expect(ttsStep?.status).toBe("error")
      expect(ttsStep?.error).toContain("Missing Gemini audio can be generated one by one")
    } finally {
      storage.close()
    }
  })

  it("retries rate-limited Gemini TTS items and completes the step when a retry succeeds", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "stage-runner-tts-"))
    const booksDir = path.join(tmpDir, "books")
    const promptsDir = path.join(tmpDir, "prompts")
    const configPath = path.join(tmpDir, "config.yaml")
    fs.mkdirSync(promptsDir, { recursive: true })
    fs.writeFileSync(
      configPath,
      `role_types:
  section_text: Main body text
structure_types:
  paragraph: Paragraph
speech:
  default_provider: gemini
  providers:
    gemini:
      languages:
        - en
`
    )
    seedTextAndSpeechBook(booksDir, "gemini-tts-retry")

    generateSpeechFileMock
      .mockRejectedValueOnce(
        new Error(
          "Gemini TTS request failed (429): Quota exceeded. Please retry in 0s."
        )
      )
      .mockResolvedValueOnce(undefined)

    const events: ProgressEvent[] = []
    const runner = createStageRunner()
    await runner.run(
      "gemini-tts-retry",
      {
        booksDir,
        apiKey: "sk-test",
        geminiApiKey: "gm-test",
        promptsDir,
        configPath,
        fromStage: "translate",
        toStage: "speech",
      },
      { emit: (event) => events.push(event) }
    )

    expect(generateSpeechFileMock).toHaveBeenCalledTimes(2)
    expect(
      events.some(
        (event) => event.type === "step-complete" && event.step === "tts"
      )
    ).toBe(true)
    expect(
      events.some(
        (event) =>
          event.type === "step-error" &&
          event.step === "tts" &&
          event.error.includes("Missing Gemini audio can be generated one by one")
      )
    ).toBe(false)

    const storage = createBookStorage("gemini-tts-retry", booksDir)
    try {
      const ttsStep = storage.getStepRuns().find((step) => step.step === "tts")
      expect(ttsStep?.status).toBe("done")
    } finally {
      storage.close()
    }
  })

  it("stores word timestamps for generated speech files", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "stage-runner-tts-"))
    const booksDir = path.join(tmpDir, "books")
    const promptsDir = path.join(tmpDir, "prompts")
    const configPath = path.join(tmpDir, "config.yaml")
    fs.mkdirSync(promptsDir, { recursive: true })
    writeBaseConfig(configPath)
    seedTextAndSpeechBook(booksDir, "speech-word-timestamps")
    fs.writeFileSync(
      path.join(booksDir, "speech-word-timestamps", "config.yaml"),
      "speech:\n  word_highlighting: true\n",
    )

    generateSpeechFileMock.mockImplementation(async (options: {
      bookDir: string
      textId: string
      language: string
      voice: string
      model: string
      provider?: string
    }) => {
      const audioDir = path.join(options.bookDir, "audio", options.language)
      fs.mkdirSync(audioDir, { recursive: true })
      const fileName = `${options.textId}.mp3`
      fs.writeFileSync(path.join(audioDir, fileName), Buffer.from("fake-audio"))
      return {
        textId: options.textId,
        language: options.language,
        fileName,
        voice: options.voice,
        model: options.model,
        cached: false,
        provider: options.provider ?? "openai",
      }
    })

    const events: ProgressEvent[] = []
    const runner = createStageRunner()
    await runner.run(
      "speech-word-timestamps",
      {
        booksDir,
        apiKey: "sk-test",
        promptsDir,
        configPath,
        fromStage: "translate",
        toStage: "speech",
      },
      { emit: (event) => events.push(event) }
    )

    expect(
      events.some(
        (event) => event.type === "step-complete" && event.step === "tts"
      )
    ).toBe(true)
    expect(transcribeWithWhisperMock).toHaveBeenCalledTimes(1)
    expect(transcribeWithWhisperMock).toHaveBeenCalledWith(
      expect.any(Buffer),
      "pg001_t001.mp3",
      "sk-test",
      "en",
      "Hello world",
    )

    const storage = createBookStorage("speech-word-timestamps", booksDir)
    try {
      const row = storage.getLatestNodeData("tts-timestamps", "en")
      expect(row).not.toBeNull()
      expect(
        (row?.data as {
          entries: Record<string, { words: Array<{ word: string; start: number; end: number }> }>
        }).entries.pg001_t001.words
      ).toEqual([
        { word: "Hello", start: 0, end: 0.45 },
        { word: "world", start: 0.45, end: 0.9 },
      ])
    } finally {
      storage.close()
    }
  })

  it("skips word timestamp generation when speech.word_highlighting is false", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "stage-runner-tts-"))
    const booksDir = path.join(tmpDir, "books")
    const promptsDir = path.join(tmpDir, "prompts")
    const configPath = path.join(tmpDir, "config.yaml")
    fs.mkdirSync(promptsDir, { recursive: true })
    writeBaseConfig(configPath)
    seedTextAndSpeechBook(booksDir, "speech-word-highlight-disabled")
    fs.writeFileSync(
      path.join(booksDir, "speech-word-highlight-disabled", "config.yaml"),
      "speech:\n  word_highlighting: false\n",
    )
    const seededStorage = createBookStorage("speech-word-highlight-disabled", booksDir)
    try {
      seededStorage.putNodeData("tts-timestamps", "en", {
        entries: {
          pg001_t001: {
            textId: "pg001_t001",
            language: "en",
            duration: 0.9,
            words: [
              { word: "stale", start: 0, end: 0.9 },
            ],
          },
        },
        generatedAt: "2026-01-01T00:00:00.000Z",
      })
    } finally {
      seededStorage.close()
    }

    generateSpeechFileMock.mockImplementation(async (options: {
      bookDir: string
      textId: string
      language: string
      voice: string
      model: string
      provider?: string
    }) => {
      const audioDir = path.join(options.bookDir, "audio", options.language)
      fs.mkdirSync(audioDir, { recursive: true })
      const fileName = `${options.textId}.mp3`
      fs.writeFileSync(path.join(audioDir, fileName), Buffer.from("fake-audio"))
      return {
        textId: options.textId,
        language: options.language,
        fileName,
        voice: options.voice,
        model: options.model,
        cached: false,
        provider: options.provider ?? "openai",
      }
    })

    const runner = createStageRunner()
    await runner.run(
      "speech-word-highlight-disabled",
      {
        booksDir,
        apiKey: "sk-test",
        promptsDir,
        configPath,
        fromStage: "translate",
        toStage: "speech",
      },
      { emit: () => {} }
    )

    expect(transcribeWithWhisperMock).not.toHaveBeenCalled()

    const storage = createBookStorage("speech-word-highlight-disabled", booksDir)
    try {
      const row = storage.getLatestNodeData("tts-timestamps", "en")
      expect(row).not.toBeNull()
      // With highlighting disabled, the seeded timestamps are preserved so that
      // manually-calculated entries (via the speech view) survive a speech re-run.
      const entries = (row?.data as {
        entries: Record<string, { words: Array<{ word: string; start: number; end: number }> }>
      }).entries
      expect(entries.pg001_t001?.words).toEqual([{ word: "stale", start: 0, end: 0.9 }])
    } finally {
      storage.close()
    }
  })
})
