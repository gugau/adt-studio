// @vitest-environment jsdom
import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setExtra: vi.fn(),
  useQuizzes: vi.fn(),
  useTextbookActivities: vi.fn(),
  usePages: vi.fn(),
  useBookConfig: vi.fn(),
  updateQuizzes: vi.fn(),
  saveTextbookActivityOverride: vi.fn(),
  deleteTextbookActivityOverride: vi.fn(),
  listBookImages: vi.fn(),
  listCaptionedImages: vi.fn(),
  uploadNewImage: vi.fn(),
  generateImageCaption: vi.fn(),
  setSectionIndex: vi.fn(),
  skipNextResetRef: { current: false },
}))

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}))

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLingui: () => ({
    t(strings: TemplateStringsArray, ...values: unknown[]) {
      let text = ""
      for (let index = 0; index < strings.length; index += 1) {
        text += strings[index]
        if (index < values.length) text += String(values[index])
      }
      return text
    },
  }),
}))

vi.mock("@/api/client", () => ({
  BASE_URL: "/api",
  api: {
    updateQuizzes: (...args: unknown[]) => mocks.updateQuizzes(...args),
    saveTextbookActivityOverride: (...args: unknown[]) => mocks.saveTextbookActivityOverride(...args),
    deleteTextbookActivityOverride: (...args: unknown[]) => mocks.deleteTextbookActivityOverride(...args),
    listBookImages: (...args: unknown[]) => mocks.listBookImages(...args),
    listCaptionedImages: (...args: unknown[]) => mocks.listCaptionedImages(...args),
    uploadNewImage: (...args: unknown[]) => mocks.uploadNewImage(...args),
    generateImageCaption: (...args: unknown[]) => mocks.generateImageCaption(...args),
    getVersionHistory: vi.fn(),
  },
}))

vi.mock("@/hooks/use-quizzes", () => ({
  useQuizzes: (...args: unknown[]) => mocks.useQuizzes(...args),
  useTextbookActivities: (...args: unknown[]) => mocks.useTextbookActivities(...args),
}))

vi.mock("@/hooks/use-pages", () => ({
  usePageImage: () => ({ data: null, isLoading: false, isError: false, refetch: vi.fn() }),
  usePages: (...args: unknown[]) => mocks.usePages(...args),
}))

vi.mock("@/hooks/use-book-config", () => ({
  useBookConfig: (...args: unknown[]) => mocks.useBookConfig(...args),
}))

vi.mock("@/hooks/use-api-key", () => ({
  useApiKey: () => ({
    apiKey: "test-key",
    hasApiKey: true,
    anthropicKey: "",
    googleKey: "",
    customBaseUrl: "",
    customApiKey: "",
    azureKey: "",
    azureRegion: "",
    geminiKey: "",
  }),
}))

vi.mock("@/routes/books.$label", () => ({
  useSectionNav: () => ({
    sectionIndex: 0,
    setSectionIndex: mocks.setSectionIndex,
    skipNextResetRef: mocks.skipNextResetRef,
  }),
}))

vi.mock("../../components/StepViewRouter", () => ({
  useStepHeader: () => ({ setExtra: mocks.setExtra }),
}))

vi.mock("./components/QuizzesLandingConfig", () => ({
  QuizzesLandingConfig: () => <div>AI generator</div>,
}))

function renderQuizzesView(
  QuizzesView: React.ComponentType<{ bookLabel: string; selectedPageId?: string }>,
  selectedPageId?: string
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <QuizzesView bookLabel="demo-book" selectedPageId={selectedPageId} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  mocks.skipNextResetRef.current = false
  mocks.saveTextbookActivityOverride.mockResolvedValue({
    override: null,
    version: 1,
  })
  mocks.deleteTextbookActivityOverride.mockResolvedValue({
    override: null,
    version: 2,
  })
  mocks.listBookImages.mockResolvedValue({ images: [] })
  mocks.listCaptionedImages.mockResolvedValue({ images: [] })
  mocks.uploadNewImage.mockResolvedValue({ imageId: "pg001_upload1", width: 120, height: 80 })
  mocks.generateImageCaption.mockResolvedValue({
    caption: { imageId: "pg001_upload1", reasoning: "visible object", caption: "A small banana." },
    version: 3,
  })
  mocks.useQuizzes.mockReturnValue({
    data: { quizzes: null, version: null },
    isLoading: false,
  })
  mocks.useTextbookActivities.mockReturnValue({
    data: {
      activities: [
        {
          id: "pg001_sec001",
          pageId: "pg001",
          pageNumber: 1,
          sectionId: "pg001_sec001",
          sectionIndex: 0,
          sectionType: "activity_multiple_choice",
          textPreview: "Choose the best answer.",
          textBlockCount: 3,
          imageCount: 1,
          answerCount: 2,
          hasRendering: true,
        },
      ],
    },
    isLoading: false,
    isError: false,
    error: null,
  })
  mocks.usePages.mockReturnValue({
    data: [
      { pageId: "pg001", pageNumber: 1 },
      { pageId: "pg002", pageNumber: 2 },
    ],
  })
  mocks.useBookConfig.mockReturnValue({
    data: { config: { layout_type: "textbook" } },
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("QuizzesView", () => {
  it("switches between AI-generated quizzes and textbook activities", async () => {
    const { QuizzesView } = await import("./QuizzesView")
    renderQuizzesView(QuizzesView)

    expect(screen.getByText("AI generator")).toBeTruthy()

    fireEvent.click(screen.getByRole("radio", { name: "Textbook activities" }))

    expect(screen.queryByText("AI generator")).toBeNull()
    expect(screen.getByText("Textbook Activities")).toBeTruthy()
    expect(screen.getByText("Multiple Choice")).toBeTruthy()
    expect(screen.getByText("Choose the best answer.")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Open in Storyboard" }))
    expect(mocks.setSectionIndex).toHaveBeenCalledWith(0)
    expect(mocks.skipNextResetRef.current).toBe(true)
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/books/$label/$step/$pageId",
      params: { label: "demo-book", step: "storyboard", pageId: "pg001" },
    })

    fireEvent.click(screen.getByRole("radio", { name: "AI generated" }))

    expect(screen.getByText("AI generator")).toBeTruthy()
  })

  it("shows missing-rendering state and disables textbook activity preview", async () => {
    mocks.useTextbookActivities.mockReturnValue({
      data: {
        activities: [
          {
            id: "pg002_sec001",
            pageId: "pg002",
            pageNumber: 2,
            sectionId: "pg002_sec001",
            sectionIndex: 0,
            sectionType: "activity_matching",
            textPreview: "Match the pairs.",
            textBlockCount: 2,
            imageCount: 0,
            answerCount: 0,
            hasRendering: false,
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    })

    const { QuizzesView } = await import("./QuizzesView")
    renderQuizzesView(QuizzesView)

    fireEvent.click(screen.getByRole("radio", { name: "Textbook activities" }))

    expect(screen.getByText("Needs rendering")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Try" }).hasAttribute("disabled")).toBe(true)
  })

  it("does not silently restrict textbook activities to the currently selected page", async () => {
    mocks.useTextbookActivities.mockReturnValue({
      data: {
        activities: [
          {
            id: "pg001_sec001",
            pageId: "pg001",
            pageNumber: 1,
            sectionId: "pg001_sec001",
            sectionIndex: 0,
            sectionType: "activity_multiple_choice",
            textPreview: "Question from page one.",
            textBlockCount: 1,
            imageCount: 0,
            answerCount: 1,
            hasRendering: true,
          },
          {
            id: "pg002_sec001",
            pageId: "pg002",
            pageNumber: 2,
            sectionId: "pg002_sec001",
            sectionIndex: 0,
            sectionType: "activity_fill_in_the_blank",
            textPreview: "Question from page two.",
            textBlockCount: 1,
            imageCount: 0,
            answerCount: 1,
            hasRendering: true,
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    })

    const { QuizzesView } = await import("./QuizzesView")
    renderQuizzesView(QuizzesView, "pg001")

    fireEvent.click(screen.getByRole("radio", { name: "Textbook activities" }))

    expect(screen.getByText("2 of 2 detected activities")).toBeTruthy()
    expect(screen.getByText("Question from page one.")).toBeTruthy()
    expect(screen.getByText("Question from page two.")).toBeTruthy()
  })

  it("opens the textbook activity editor and saves a non-destructive override", async () => {
    const { QuizzesView } = await import("./QuizzesView")
    renderQuizzesView(QuizzesView)

    fireEvent.click(screen.getByRole("radio", { name: "Textbook activities" }))
    fireEvent.click(screen.getByRole("button", { name: "Edit textbook activity" }))

    expect(screen.getByRole("region", { name: "Textbook activity editor" })).toBeTruthy()
    expect(screen.getByLabelText("Activity type")).toBeTruthy()
    expect(screen.getByText("Customize selected layout")).toBeTruthy()

    fireEvent.change(screen.getByLabelText("Page range"), { target: { value: "2" } })
    fireEvent.click(screen.getByRole("button", { name: "Apply range" }))
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(mocks.saveTextbookActivityOverride).toHaveBeenCalled()
    })
    expect(mocks.saveTextbookActivityOverride).toHaveBeenCalledWith(
      "demo-book",
      "pg001_pg001_sec001",
      expect.objectContaining({
        sourcePageId: "pg001",
        sourceSectionId: "pg001_sec001",
        assignedPageIds: ["pg002"],
        insertAfterPageId: "pg002",
        questionsPerQuiz: 1,
        replaceExistingForPages: false,
        template: expect.objectContaining({ style: "worksheet_rows" }),
      })
    )
    const payload = mocks.saveTextbookActivityOverride.mock.calls[0][2]
    expect(payload.questions[0].options).toHaveLength(4)
  })

  it("auto-generates and syncs captions when uploading activity images", async () => {
    const { QuizzesView } = await import("./QuizzesView")
    renderQuizzesView(QuizzesView)

    fireEvent.click(screen.getByRole("radio", { name: "Textbook activities" }))
    fireEvent.click(screen.getByRole("button", { name: "Edit textbook activity" }))
    fireEvent.click(screen.getByRole("button", { name: "Add image to Option 1" }))

    expect(await screen.findByText("Auto-generate caption after upload")).toBeTruthy()
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(["image-bytes"], "small-banana.png", { type: "image/png" })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(mocks.uploadNewImage).toHaveBeenCalledWith("demo-book", "pg001", file)
      expect(mocks.generateImageCaption).toHaveBeenCalledWith(
        "demo-book",
        "pg001",
        "pg001_upload1",
        "test-key",
        expect.any(Object)
      )
    })

    await waitFor(() => {
      expect(screen.getByDisplayValue("A small banana.")).toBeTruthy()
    })
    expect(screen.getByText("Caption synced to Image Captions.")).toBeTruthy()
  })

  it("resets a customized textbook activity back to the detected textbook activity", async () => {
    mocks.useQuizzes.mockReturnValue({
      data: {
        version: 12,
        quizzes: {
          generatedAt: "2026-05-15T00:00:00.000Z",
          language: "en",
          pagesPerQuiz: 1,
          quizzes: [
            {
              quizIndex: 0,
              afterPageId: "pg001",
              pageIds: ["pg001"],
              activityType: "multiple_choice",
              question: "Choose the best answer.",
              options: [
                { text: "One", explanation: "" },
                { text: "Two", explanation: "" },
                { text: "Three", explanation: "" },
                { text: "Four", explanation: "" },
              ],
              answerIndex: 0,
              reasoning: "test",
              sourceTextbookActivityId: "pg001_pg001_sec001",
            },
          ],
        },
      },
      isLoading: false,
    })
    mocks.useTextbookActivities.mockReturnValue({
      data: {
        activities: [
          {
            id: "pg001_sec001",
            pageId: "pg001",
            pageNumber: 1,
            sectionId: "pg001_sec001",
            sectionIndex: 0,
            sectionType: "activity_fill_in_a_table",
            textPreview: "Choose the word from the first row and fill the right column.",
            textBlockCount: 28,
            imageCount: 7,
            answerCount: 5,
            hasRendering: true,
            override: {
              id: "pg001_pg001_sec001",
              sourcePageId: "pg001",
              sourceSectionId: "pg001_sec001",
              activityType: "fill_in_the_blank",
              template: {
                id: "worksheet-rows",
                name: "Worksheet rows",
                style: "worksheet_rows",
                generationMode: "template_single_page",
              },
              questions: [
                {
                  activityType: "fill_in_the_blank",
                  question: "Fill in the blanks.",
                  blanks: [{ prompt: "Choose the word ____", answer: "radio" }],
                  reasoning: "test",
                },
              ],
              assignedPageIds: ["pg001"],
              insertAfterPageId: "pg001",
              questionsPerQuiz: 1,
              replaceExistingForPages: false,
              hidden: false,
              updatedAt: "2026-05-15T00:00:00.000Z",
            },
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    })

    const { QuizzesView } = await import("./QuizzesView")
    renderQuizzesView(QuizzesView)

    fireEvent.click(screen.getByRole("radio", { name: "Textbook activities" }))
    fireEvent.click(screen.getByRole("button", { name: "Edit textbook activity" }))
    expect(screen.getByRole("region", { name: "Textbook activity editor" })).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Reset to detected" }))

    await waitFor(() => {
      expect(mocks.deleteTextbookActivityOverride).toHaveBeenCalledWith(
        "demo-book",
        "pg001_pg001_sec001"
      )
    })
    expect(screen.queryByRole("region", { name: "Textbook activity editor" })).toBeNull()
  })

  it("opens customized textbook activities on their first assigned storyboard page", async () => {
    mocks.useQuizzes.mockReturnValue({
      data: {
        version: 12,
        quizzes: {
          generatedAt: "2026-05-15T00:00:00.000Z",
          language: "en",
          pagesPerQuiz: 1,
          quizzes: [
            {
              quizIndex: 0,
              afterPageId: "pg002",
              pageIds: ["pg002"],
              activityType: "multiple_choice",
              question: "Choose the best answer.",
              options: [
                { text: "One", explanation: "" },
                { text: "Two", explanation: "" },
                { text: "Three", explanation: "" },
                { text: "Four", explanation: "" },
              ],
              answerIndex: 0,
              reasoning: "test",
              sourceTextbookActivityId: "pg001_pg001_sec001",
            },
          ],
        },
      },
      isLoading: false,
    })
    mocks.useTextbookActivities.mockReturnValue({
      data: {
        activities: [
          {
            id: "pg001_sec001",
            pageId: "pg001",
            pageNumber: 1,
            sectionId: "pg001_sec001",
            sectionIndex: 0,
            sectionType: "activity_multiple_choice",
            textPreview: "Choose the best answer.",
            textBlockCount: 3,
            imageCount: 1,
            answerCount: 2,
            hasRendering: true,
            override: {
              id: "pg001_pg001_sec001",
              sourcePageId: "pg001",
              sourceSectionId: "pg001_sec001",
              activityType: "multiple_choice",
              template: {
                id: "worksheet-rows",
                name: "Worksheet rows",
                style: "worksheet_rows",
                generationMode: "template_single_page",
              },
              questions: [
                {
                  activityType: "multiple_choice",
                  question: "Choose the best answer.",
                  options: [
                    { text: "One", explanation: "" },
                    { text: "Two", explanation: "" },
                    { text: "Three", explanation: "" },
                    { text: "Four", explanation: "" },
                  ],
                  answerIndex: 0,
                  reasoning: "test",
                },
              ],
              assignedPageIds: ["pg002"],
              insertAfterPageId: "pg002",
              questionsPerQuiz: 1,
              replaceExistingForPages: false,
              hidden: false,
              updatedAt: "2026-05-15T00:00:00.000Z",
            },
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    })

    const { QuizzesView } = await import("./QuizzesView")
    renderQuizzesView(QuizzesView)

    fireEvent.click(screen.getByRole("radio", { name: "Textbook activities" }))
    expect(screen.getAllByText("Customized").length).toBeGreaterThan(0)
    expect(screen.getByText("Synced to pg002 ✓")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Open in Storyboard" }))

    expect(mocks.setSectionIndex).toHaveBeenCalledWith(0)
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/books/$label/$step/$pageId",
      params: { label: "demo-book", step: "storyboard", pageId: "pg002" },
    })
  })

  it("previews customized textbook activities from the synced quiz page", async () => {
    mocks.useQuizzes.mockReturnValue({
      data: {
        version: 12,
        quizzes: {
          generatedAt: "2026-05-15T00:00:00.000Z",
          language: "en",
          pagesPerQuiz: 1,
          quizzes: [
            {
              quizIndex: 0,
              afterPageId: "pg001",
              pageIds: ["pg001"],
              activityType: "multiple_choice",
              question: "Choose the best answer.",
              options: [
                { text: "One", explanation: "" },
                { text: "Two", explanation: "" },
                { text: "Three", explanation: "" },
                { text: "Four", explanation: "" },
              ],
              answerIndex: 0,
              reasoning: "test",
              sourceTextbookActivityId: "pg001_pg001_sec001",
            },
          ],
        },
      },
      isLoading: false,
    })
    mocks.useTextbookActivities.mockReturnValue({
      data: {
        activities: [
          {
            id: "pg001_sec001",
            pageId: "pg001",
            pageNumber: 1,
            sectionId: "pg001_sec001",
            sectionIndex: 0,
            sectionType: "activity_fill_in_the_blank",
            textPreview: "Fill the blank.",
            textBlockCount: 3,
            imageCount: 1,
            answerCount: 2,
            hasRendering: true,
            override: {
              id: "pg001_pg001_sec001",
              sourcePageId: "pg001",
              sourceSectionId: "pg001_sec001",
              activityType: "multiple_choice",
              template: {
                id: "worksheet-rows",
                name: "Worksheet rows",
                style: "worksheet_rows",
                generationMode: "template_single_page",
              },
              questions: [
                {
                  activityType: "multiple_choice",
                  question: "Choose the best answer.",
                  options: [
                    { text: "One", explanation: "" },
                    { text: "Two", explanation: "" },
                    { text: "Three", explanation: "" },
                    { text: "Four", explanation: "" },
                  ],
                  answerIndex: 0,
                  reasoning: "test",
                },
              ],
              assignedPageIds: ["pg001"],
              insertAfterPageId: "pg001",
              questionsPerQuiz: 1,
              replaceExistingForPages: false,
              hidden: false,
              updatedAt: "2026-05-15T00:00:00.000Z",
            },
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    })

    const { QuizzesView } = await import("./QuizzesView")
    renderQuizzesView(QuizzesView)

    fireEvent.click(screen.getByRole("radio", { name: "Textbook activities" }))
    expect(screen.getByText("Detected as Fill In The Blank")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Try" }))

    expect((screen.getByTitle("Textbook activity preview") as HTMLIFrameElement).getAttribute("src")).toBe(
      "/api/books/demo-book/adt-preview/qz001.html?embed=1"
    )
  })

  it.each(["storybook", "reference", "custom"])(
    "hides the textbook activities switch for %s presets",
    async (layoutType) => {
    mocks.useBookConfig.mockReturnValue({
      data: { config: { layout_type: layoutType } },
    })

    const { QuizzesView } = await import("./QuizzesView")
    renderQuizzesView(QuizzesView)

    expect(screen.queryByRole("radio", { name: "AI generated" })).toBeNull()
    expect(screen.queryByRole("radio", { name: "Textbook activities" })).toBeNull()
    expect(screen.getByText("AI generator")).toBeTruthy()
    expect(screen.queryByText("Textbook Activities")).toBeNull()
    }
  )

  it("lets users change the correct answer for generated multiple-choice quizzes", async () => {
    mocks.useQuizzes.mockReturnValue({
      data: {
        version: 7,
        quizzes: {
          generatedAt: "2026-05-14T00:00:00.000Z",
          language: "en",
          pagesPerQuiz: 1,
          quizzes: [
            {
              quizIndex: 0,
              afterPageId: "pg001",
              pageIds: ["pg001"],
              activityType: "multiple_choice",
              question: "What happened?",
              options: [
                { text: "Option 1", explanation: "First explanation" },
                { text: "Option 2", explanation: "Second explanation" },
              ],
              answerIndex: 1,
              reasoning: "test",
            },
          ],
        },
      },
      isLoading: false,
    })

    const { QuizzesView } = await import("./QuizzesView")
    renderQuizzesView(QuizzesView)

    const option1Button = screen.getByRole("button", { name: "Set option 1 as correct answer" })
    expect(option1Button.getAttribute("aria-pressed")).toBe("false")

    fireEvent.click(option1Button)

    expect(screen.getByRole("button", { name: "Correct answer" }).getAttribute("aria-pressed")).toBe("true")
    expect(screen.getByRole("button", { name: "Set option 2 as correct answer" })).toBeTruthy()
  })

  it("lets users change where a generated quiz is inserted", async () => {
    mocks.useQuizzes.mockReturnValue({
      data: {
        version: 7,
        quizzes: {
          generatedAt: "2026-05-14T00:00:00.000Z",
          language: "en",
          pagesPerQuiz: 1,
          quizzes: [
            {
              quizIndex: 0,
              afterPageId: "pg001",
              pageIds: ["pg001"],
              activityType: "multiple_choice",
              question: "What happened?",
              options: [
                { text: "Option 1", explanation: "First explanation" },
                { text: "Option 2", explanation: "Second explanation" },
              ],
              answerIndex: 1,
              reasoning: "test",
            },
          ],
        },
      },
      isLoading: false,
    })

    const { QuizzesView } = await import("./QuizzesView")
    renderQuizzesView(QuizzesView)

    const placement = screen.getByLabelText("Insert after page") as HTMLSelectElement
    expect(placement.value).toBe("pg001")

    fireEvent.change(placement, { target: { value: "pg002" } })

    expect((screen.getByLabelText("Insert after page") as HTMLSelectElement).value).toBe("pg002")
  })
})
