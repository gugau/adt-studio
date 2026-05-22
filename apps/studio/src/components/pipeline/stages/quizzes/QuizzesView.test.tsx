// @vitest-environment jsdom
import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const mocks = vi.hoisted(() => ({
  setExtra: vi.fn(),
  useQuizzes: vi.fn(),
  useTextbookActivities: vi.fn(),
  usePages: vi.fn(),
  updateQuizzes: vi.fn(),
  generateQuizzes: vi.fn(),
  listBookImages: vi.fn(),
  listCaptionedImages: vi.fn(),
  uploadNewImage: vi.fn(),
  generateImageCaption: vi.fn(),
  queueRun: vi.fn(),
  stageState: vi.fn(),
  stepState: vi.fn(),
  stepProgress: vi.fn(),
  stepError: vi.fn(),
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
    generateQuizzes: (...args: unknown[]) => mocks.generateQuizzes(...args),
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

vi.mock("@/hooks/use-book-run", () => ({
  useBookRun: () => ({
    stageState: (...args: unknown[]) => mocks.stageState(...args),
    stepState: (...args: unknown[]) => mocks.stepState(...args),
    stepProgress: (...args: unknown[]) => mocks.stepProgress(...args),
    stepError: (...args: unknown[]) => mocks.stepError(...args),
    error: null,
    isRunning: false,
    queueRun: (...args: unknown[]) => mocks.queueRun(...args),
  }),
}))

vi.mock("../../components/StepViewRouter", () => ({
  useStepHeader: () => ({ setExtra: mocks.setExtra }),
}))

vi.mock("../../components/StageRunCard", () => ({
  StageRunCard: ({
    isRunning,
    disabled,
    onRun,
  }: {
    isRunning: boolean
    disabled: boolean
    onRun: () => void
  }) => (
    <div>
      <span>Activity Generation</span>
      <button
        type="button"
        title={isRunning ? "Generating Activities..." : "Run Activities"}
        disabled={disabled}
        onClick={onRun}
      >
        Run
      </button>
    </div>
  ),
}))

vi.mock("./components/QuizzesLandingConfig", () => ({
  QuizzesLandingConfig: () => <div>AI generator</div>,
}))

function quizFixture(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  }
}

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
  mocks.queueRun.mockReset()
  mocks.stageState.mockReturnValue("idle")
  mocks.stepState.mockReturnValue("idle")
  mocks.stepProgress.mockReturnValue(undefined)
  mocks.stepError.mockReturnValue(undefined)
  mocks.updateQuizzes.mockResolvedValue({ version: 8 })
  mocks.generateQuizzes.mockResolvedValue({
    quizzes: { generatedAt: "2026-05-14T00:00:00.000Z", language: "en", pagesPerQuiz: 1, quizzes: [] },
    version: 9,
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
    data: { activities: [] },
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
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("QuizzesView", () => {
  it("shows the stage run card before activities are generated", async () => {
    const { QuizzesView } = await import("./QuizzesView")
    renderQuizzesView(QuizzesView)

    expect(screen.getByText("Activity Generation")).toBeTruthy()
    expect(screen.queryByText("AI generator")).toBeNull()

    fireEvent.click(screen.getByTitle("Run Activities"))
    expect(mocks.queueRun).toHaveBeenCalledWith({
      fromStage: "quizzes",
      toStage: "quizzes",
      apiKey: "test-key",
    })
  })

  it("shows the AI activity generator after activities exist", async () => {
    mocks.stageState.mockReturnValue("done")
    mocks.useQuizzes.mockReturnValue({
      data: {
        version: 7,
        quizzes: {
          generatedAt: "2026-05-14T00:00:00.000Z",
          language: "en",
          pagesPerQuiz: 1,
          quizzes: [],
        },
      },
      isLoading: false,
    })

    const { QuizzesView } = await import("./QuizzesView")
    renderQuizzesView(QuizzesView)

    expect(screen.getByText("AI generator")).toBeTruthy()
  })

  it("lets users change the correct answer for generated multiple-choice quizzes", async () => {
    mocks.useQuizzes.mockReturnValue({
      data: {
        version: 7,
        quizzes: {
          generatedAt: "2026-05-14T00:00:00.000Z",
          language: "en",
          pagesPerQuiz: 1,
          quizzes: [quizFixture()],
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
          quizzes: [quizFixture()],
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

  it("collapses and expands generated activity rows", async () => {
    mocks.useQuizzes.mockReturnValue({
      data: {
        version: 7,
        quizzes: {
          generatedAt: "2026-05-14T00:00:00.000Z",
          language: "en",
          pagesPerQuiz: 1,
          quizzes: [quizFixture()],
        },
      },
      isLoading: false,
    })

    const { QuizzesView } = await import("./QuizzesView")
    renderQuizzesView(QuizzesView)

    expect(screen.getByDisplayValue("What happened?")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Collapse activity" }))
    expect(screen.queryByDisplayValue("What happened?")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Expand activity" }))
    expect(screen.getByDisplayValue("What happened?")).toBeTruthy()
  })

  it("uses the full True / False activity label", async () => {
    mocks.useQuizzes.mockReturnValue({
      data: {
        version: 7,
        quizzes: {
          generatedAt: "2026-05-14T00:00:00.000Z",
          language: "en",
          pagesPerQuiz: 1,
          quizzes: [
            quizFixture({
              activityType: "true_false",
              question: "True or false.",
              statements: [{ text: "Karma liked bananas.", answer: false }],
              options: undefined,
              answerIndex: undefined,
            }),
          ],
        },
      },
      isLoading: false,
    })

    const { QuizzesView } = await import("./QuizzesView")
    renderQuizzesView(QuizzesView)

    expect(screen.getAllByText("True / False").length).toBeGreaterThan(0)
    expect(screen.queryByText("True/False")).toBeNull()
  })

  it("lets generated activities change type and reshapes the editor fields", async () => {
    mocks.useQuizzes.mockReturnValue({
      data: {
        version: 7,
        quizzes: {
          generatedAt: "2026-05-14T00:00:00.000Z",
          language: "en",
          pagesPerQuiz: 1,
          quizzes: [quizFixture()],
        },
      },
      isLoading: false,
    })

    const { QuizzesView } = await import("./QuizzesView")
    renderQuizzesView(QuizzesView)

    const typeSelect = screen.getByLabelText("Activity type") as HTMLSelectElement
    expect(typeSelect.value).toBe("multiple_choice")

    fireEvent.change(typeSelect, { target: { value: "fill_in_the_blank" } })

    expect((screen.getByLabelText("Activity type") as HTMLSelectElement).value).toBe("fill_in_the_blank")
    expect(screen.getByDisplayValue("What happened ____")).toBeTruthy()
    expect(screen.getByDisplayValue("Option 2")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Set option 1 as correct answer" })).toBeNull()

    fireEvent.change(screen.getByLabelText("Activity type"), { target: { value: "open_ended" } })

    expect((screen.getByLabelText("Activity type") as HTMLSelectElement).value).toBe("open_ended")
    expect(screen.getByLabelText("Open ended prompt")).toBeTruthy()
    expect((screen.getByLabelText("Sample answer") as HTMLTextAreaElement).value).toBe("Option 2")
  })

  it("regenerates a single activity when its layout changes", async () => {
    mocks.useQuizzes.mockReturnValue({
      data: {
        version: 7,
        quizzes: {
          generatedAt: "2026-05-14T00:00:00.000Z",
          language: "en",
          pagesPerQuiz: 1,
          quizzes: [quizFixture()],
        },
      },
      isLoading: false,
    })

    const { QuizzesView } = await import("./QuizzesView")
    renderQuizzesView(QuizzesView)

    fireEvent.change(screen.getByLabelText("Activity layout"), {
      target: { value: "practice_cards" },
    })

    await waitFor(() => {
      expect(mocks.generateQuizzes).toHaveBeenCalledWith(
        "demo-book",
        "test-key",
        expect.objectContaining({
          pageIds: ["pg001"],
          insertAfterPageId: "pg001",
          replaceQuizIndex: 0,
          template: expect.objectContaining({ style: "practice_cards" }),
        }),
        expect.any(Object)
      )
    })
  })
})
