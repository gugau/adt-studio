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
      { pageId: "pg001", pageNumber: 1, sectionCount: 1, prunedSections: [] },
      { pageId: "pg002", pageNumber: 2, sectionCount: 1, prunedSections: [] },
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
    expect(selector.textContent).toContain("Open Ended")
    expect(selector.textContent).toContain("Sorting")
  })

  it("offers distinct plain-language reusable activity layouts", () => {
    renderConfig()

    expect(screen.getByRole("button", { name: /Worksheet rows/ })).toBeTruthy()
    expect(screen.getByRole("button", { name: /Practice cards/ })).toBeTruthy()
    expect(screen.getByRole("button", { name: /Quick check/ })).toBeTruthy()
    expect(screen.getByRole("button", { name: /Step by step/ })).toBeTruthy()
  })

  it("sends the selected reusable template when generating", async () => {
    renderConfig()

    fireEvent.change(screen.getByLabelText("Template name"), {
      target: { value: "My workbook style" },
    })
    fireEvent.change(screen.getByLabelText("Template instructions"), {
      target: { value: "Keep every activity compact and table-like." },
    })
    fireEvent.click(screen.getByRole("button", { name: "Generate" }))

    await waitFor(() => {
      expect(mocks.generateQuizzes).toHaveBeenCalledWith(
        "demo-book",
        "test-key",
        expect.objectContaining({
          template: expect.objectContaining({
            name: "My workbook style",
            style: "worksheet_rows",
            generationMode: "template_single_page",
            instructions: "Keep every activity compact and table-like.",
          }),
        }),
        undefined
      )
    })
  })

  it.each([
    ["Worksheet rows", "worksheet_rows", "template_single_page"],
    ["Practice cards", "practice_cards", "template_single_page"],
    ["Quick check", "quick_check", "template_single_page"],
    ["Step by step", "guided_steps", "template_multi_step"],
  ])("sends the %s layout preset when generating", async (buttonName, style, generationMode) => {
    renderConfig()

    fireEvent.click(screen.getByRole("button", { name: new RegExp(buttonName) }))
    fireEvent.click(screen.getByRole("button", { name: "Generate" }))

    await waitFor(() => {
      expect(mocks.generateQuizzes).toHaveBeenCalledWith(
        "demo-book",
        "test-key",
        expect.objectContaining({
          template: expect.objectContaining({
            style,
            generationMode,
          }),
        }),
        undefined
      )
    })
  })
})
