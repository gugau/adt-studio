// @vitest-environment jsdom
import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { QuizzesLandingConfig } from "./QuizzesLandingConfig"

const mocks = vi.hoisted(() => ({
  generateQuizzes: vi.fn(),
  usePages: vi.fn(),
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
  api: {
    generateQuizzes: (...args: unknown[]) => mocks.generateQuizzes(...args),
  },
}))

vi.mock("@/hooks/use-pages", () => ({
  usePages: (...args: unknown[]) => mocks.usePages(...args),
}))

function renderConfig() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <QuizzesLandingConfig
        bookLabel="demo-book"
        apiKey="test-key"
        hasApiKey={true}
        initialSelectedPageId="pg001"
      />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  mocks.generateQuizzes.mockResolvedValue({
    quizzes: { generatedAt: "2026-05-14T00:00:00.000Z", language: "en", pagesPerQuiz: 1, quizzes: [] },
    version: 1,
  })
  mocks.usePages.mockReturnValue({
    data: [
      { pageId: "pg001", pageNumber: 1, sectionCount: 1, prunedSections: [], hasQuizSourceContent: true },
      { pageId: "pg002", pageNumber: 2, sectionCount: 1, prunedSections: [], hasQuizSourceContent: true },
    ],
  })
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.clearAllMocks()
})

describe("QuizzesLandingConfig", () => {
  it("uses the smart last-selected page as the default insertion point", async () => {
    renderConfig()

    fireEvent.click(screen.getByRole("button", { name: "Generate" }))

    await waitFor(() => {
      expect(mocks.generateQuizzes).toHaveBeenCalledWith(
        "demo-book",
        "test-key",
        expect.objectContaining({
          pageIds: ["pg001"],
          insertAfterPageId: "pg001",
        }),
        undefined
      )
    })
  })

  it("lets users choose an explicit insertion page before generating", async () => {
    renderConfig()

    fireEvent.change(screen.getByLabelText("Insert activity after"), {
      target: { value: "pg002" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Generate" }))

    await waitFor(() => {
      expect(mocks.generateQuizzes).toHaveBeenCalledWith(
        "demo-book",
        "test-key",
        expect.objectContaining({
          pageIds: ["pg001"],
          insertAfterPageId: "pg002",
        }),
        undefined
      )
    })
  })

  it("offers multiple select, open ended, and sorting activity types", () => {
    renderConfig()

    const selector = screen.getByDisplayValue("MCQ")
    expect(selector.textContent).toContain("MCQ Multiple Select")
    expect(selector.textContent).toContain("True / False")
    expect(selector.textContent).toContain("Open Ended")
    expect(selector.textContent).toContain("Sorting")
  })

  it("labels the question count badge as the per-quiz setting", () => {
    renderConfig()

    expect(screen.getByText("Questions/quiz: 1")).toBeTruthy()
    expect(screen.queryByText("1 questions")).toBeNull()
  })

  it("explains that pages without usable content are hidden by default", () => {
    renderConfig()

    expect(screen.getByText("Note: Pages without usable content are hidden by default.")).toBeTruthy()
  })

  it("sends the default worksheet template when generating", async () => {
    renderConfig()

    fireEvent.click(screen.getByRole("button", { name: "Generate" }))

    await waitFor(() => {
      expect(mocks.generateQuizzes).toHaveBeenCalledWith(
        "demo-book",
        "test-key",
        expect.objectContaining({
          template: expect.objectContaining({
            name: "Worksheet rows",
            style: "worksheet_rows",
            generationMode: "template_single_page",
          }),
        }),
        undefined
      )
    })
  })

  it("hides pages without usable quiz source content by default and skips them in ranges", async () => {
    mocks.usePages.mockReturnValue({
      data: [
        { pageId: "pg001", pageNumber: 1, sectionCount: 1, prunedSections: [], hasQuizSourceContent: false },
        { pageId: "pg002", pageNumber: 2, sectionCount: 1, prunedSections: [], hasQuizSourceContent: true },
      ],
    })
    renderConfig()

    expect(screen.queryByRole("button", { name: "Page 1, No quiz source" })).toBeNull()
    expect(screen.getByRole("button", { name: "Page 2" })).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Show hidden pages" }))
    expect(screen.getByRole("button", { name: "Page 1, No quiz source" }).hasAttribute("disabled")).toBe(true)

    fireEvent.change(screen.getByPlaceholderText("1-12, 20, pg045"), {
      target: { value: "1-2" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Apply range" }))
    fireEvent.click(screen.getByRole("button", { name: "Generate" }))

    await waitFor(() => {
      expect(mocks.generateQuizzes).toHaveBeenCalledWith(
        "demo-book",
        "test-key",
        expect.objectContaining({
          pageIds: ["pg002"],
          insertAfterPageId: "pg002",
        }),
        undefined
      )
    })
  })
})
