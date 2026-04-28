// @vitest-environment jsdom
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { TranslationEvaluationStatusResponse } from "@/api/client"

function templateToString(strings: TemplateStringsArray, values: unknown[]) {
  let text = ""
  for (let index = 0; index < strings.length; index += 1) {
    text += strings[index]
    if (index < values.length) text += String(values[index])
  }
  return text
}

const evaluationsState = {
  data: { evaluations: [] as TranslationEvaluationStatusResponse[] },
  isLoading: false,
  error: null as Error | null,
}

const runEvaluationState = {
  isPending: false,
  error: null as Error | null,
  mutate: vi.fn(),
}

const bookConfigState = {
  data: { config: { translation_evaluation: { enabled: true } } },
}

const bookTasksState = {
  isTaskRunning: vi.fn(() => false),
  tasks: [] as Array<{
    kind: string
    status: string
    error?: string
    description?: string
    progressMessage?: string
    progressPercent?: number
    startedAt?: number
    completedAt?: number
  }>,
}

const apiKeyState = {
  hasApiKey: true,
}

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLingui: () => ({
    t(strings: TemplateStringsArray, ...values: unknown[]) {
      return templateToString(strings, values)
    },
  }),
}))

vi.mock("@/hooks/use-translation-evaluation", () => ({
  useTranslationEvaluations: () => evaluationsState,
  useRunTranslationEvaluation: () => runEvaluationState,
}))

vi.mock("@/hooks/use-book-config", () => ({
  useBookConfig: () => bookConfigState,
}))

vi.mock("@/hooks/use-book-tasks", () => ({
  useBookTasks: () => bookTasksState,
}))

vi.mock("@/hooks/use-api-key", () => ({
  useApiKey: () => apiKeyState,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  evaluationsState.data = { evaluations: [] }
  evaluationsState.isLoading = false
  evaluationsState.error = null
  runEvaluationState.isPending = false
  runEvaluationState.error = null
  bookConfigState.data = { config: { translation_evaluation: { enabled: true } } }
  bookTasksState.isTaskRunning.mockReturnValue(false)
  bookTasksState.tasks = []
  apiKeyState.hasApiKey = true
})

describe("TranslationEvaluationTab", () => {
  it("renders summary cards and per-entry verdicts for the selected language", async () => {
    evaluationsState.data = {
      evaluations: [
        {
          language: "fr",
          currentSourceCatalogVersion: 4,
          currentTranslationVersion: 3,
          evaluationVersion: 2,
          isStale: false,
          evaluation: {
            generated_at: "2026-04-06T10:00:00.000Z",
            provider: "mlflow",
            language: "fr",
            source_catalog_version: 4,
            translation_version: 3,
            eval_config_hash: "cfg-123",
            summary: {
              total: 2,
              acceptable: 1,
              unacceptable: 1,
            },
            items: [
              {
                entry_id: "pg001_tx001",
                acceptable: true,
                source_text: "Hello world",
                translated_text: "Bonjour le monde",
                rationale: "Preserves the meaning well.",
                issue_types: [],
              },
              {
                entry_id: "pg001_tx002",
                acceptable: false,
                source_text: "Key term source",
                translated_text: "Missing term target",
                rationale: "Drops a key term from the source sentence.",
                issue_types: ["meaning", "terminology"],
              },
            ],
            mlflow: {
              run_id: "run-123",
              url: "https://mlflow.example/runs/run-123",
            },
          },
        },
      ],
    }

    const { TranslationEvaluationTab } = await import("./TranslationEvaluationTab")
    render(<TranslationEvaluationTab label="demo-book" />)

    await waitFor(() => expect(screen.getByText("Translation evaluation")).toBeTruthy())

    expect(screen.getAllByText("Acceptable").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Needs review").length).toBeGreaterThan(0)
    expect(screen.getByText("Common issue types")).toBeTruthy()
    expect(screen.getByText("meaning (1)")).toBeTruthy()
    expect(screen.getByText("terminology (1)")).toBeTruthy()
    expect(screen.getAllByText("Drops a key term from the source sentence.").length).toBeGreaterThan(0)
    expect(screen.queryByText("Hello world")).toBeNull()
    expect(screen.getByText("Key term source")).toBeTruthy()
    expect(screen.getByText("Missing term target")).toBeTruthy()
    expect(screen.getByText("Original")).toBeTruthy()
    expect(screen.getByText("Translation")).toBeTruthy()
    expect(screen.getByText("Rationale")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Expand details" }))
    expect(screen.getByText("Hello world")).toBeTruthy()
    expect(screen.getByText("Bonjour le monde")).toBeTruthy()
    const mlflowLink = screen.getByRole("link", { name: "Open MLflow run" })
    expect(mlflowLink.getAttribute("href")).toBe("https://mlflow.example/runs/run-123")
  })

  it("submits a run for the selected language and shows task errors", async () => {
    evaluationsState.data = {
      evaluations: [
        {
          language: "sw",
          currentSourceCatalogVersion: 2,
          currentTranslationVersion: 5,
          evaluationVersion: null,
          isStale: false,
          evaluation: null,
        },
      ],
    }
    bookTasksState.tasks = [
      {
        kind: "translation-evaluation",
        status: "failed",
        error: "MLflow judge timed out",
        completedAt: 100,
      },
    ]

    const { TranslationEvaluationTab } = await import("./TranslationEvaluationTab")
    render(<TranslationEvaluationTab label="demo-book" />)

    await waitFor(() => {
      const runButton = screen.getByRole("button", { name: "Run evaluation" }) as HTMLButtonElement
      expect(runButton.disabled).toBe(false)
    })

    fireEvent.click(screen.getByRole("button", { name: "Run evaluation" }))

    expect(runEvaluationState.mutate).toHaveBeenCalledWith("sw")
    expect(screen.getByText("MLflow judge timed out")).toBeTruthy()
    expect(
      screen.getByText("No evaluation has been stored for this language yet. Run an evaluation to generate verdicts."),
    ).toBeTruthy()
  })

  it("shows active translation-evaluation task progress while the rerun is still in flight", async () => {
    evaluationsState.data = {
      evaluations: [
        {
          language: "es-ES",
          currentSourceCatalogVersion: 3,
          currentTranslationVersion: 4,
          evaluationVersion: 1,
          isStale: false,
          evaluation: {
            generated_at: "2026-04-06T10:00:00.000Z",
            provider: "mlflow",
            language: "es-ES",
            source_catalog_version: 3,
            translation_version: 4,
            eval_config_hash: "cfg-123",
            summary: {
              total: 10,
              acceptable: 8,
              unacceptable: 2,
            },
            items: [],
          },
        },
      ],
    }
    bookTasksState.isTaskRunning.mockReturnValue(true)
    bookTasksState.tasks = [
      {
        kind: "translation-evaluation",
        status: "running",
        description: "Running translation evaluation for es-ES",
        progressMessage: "Submitting translation evaluation",
        progressPercent: 40,
        startedAt: 100,
      },
    ]

    const { TranslationEvaluationTab } = await import("./TranslationEvaluationTab")
    render(<TranslationEvaluationTab label="demo-book" />)

    await waitFor(() => expect(screen.getByText("Translation evaluation is running")).toBeTruthy())

    expect(screen.getByText("Submitting translation evaluation")).toBeTruthy()
    expect(
      screen.getByText("The cards below continue to show the last saved evaluation until this task finishes."),
    ).toBeTruthy()
    expect(screen.getByText("40%")).toBeTruthy()
  })
})
