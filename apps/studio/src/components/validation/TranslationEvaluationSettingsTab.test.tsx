// @vitest-environment jsdom
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

function templateToString(strings: TemplateStringsArray, values: unknown[]) {
  let text = ""
  for (let index = 0; index < strings.length; index += 1) {
    text += strings[index]
    if (index < values.length) text += String(values[index])
  }
  return text
}

const DEFAULT_TRANSLATION_EVALUATION_JUDGE_INSTRUCTIONS = `
Review the translation in {{ outputs }} against the source content in {{ inputs }}.

Decide whether the translation is acceptable overall.
Use these criteria:
- preserve meaning faithfully
- sound fluent and natural in the target language
- keep important terminology correct and consistent
- avoid important omissions or unsupported additions
- preserve meaningful formatting markers and placeholders when they affect meaning

Return a concise rationale for your decision.
When the translation needs review, return a suggested corrected translation when a clear correction is possible.
`.trim()

const bookConfigState = {
  data: {
    config: {
      translation_evaluation: {
        judge_model: "openai:/gpt-4.1-mini",
        max_retries: 2,
        evaluation_scope_mode: "sample",
        evaluation_scope_count: 25,
        sampling_method: "random",
        sampling_seed: 42,
        batch_size: 5,
        judge_instructions: "Review {{ inputs }} against {{ outputs }}.",
        additional_guidance: "Prefer literal translations only when necessary.",
      },
    },
  },
  isLoading: false,
  error: null as Error | null,
}

const updateConfigState = {
  mutate: vi.fn(),
  isPending: false,
}

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLingui: () => ({
    t(strings: TemplateStringsArray, ...values: unknown[]) {
      return templateToString(strings, values)
    },
  }),
}))

vi.mock("@/hooks/use-book-config", () => ({
  useBookConfig: () => bookConfigState,
  useUpdateBookConfig: () => updateConfigState,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  bookConfigState.data = {
    config: {
      translation_evaluation: {
        judge_model: "openai:/gpt-4.1-mini",
        max_retries: 2,
        evaluation_scope_mode: "sample",
        evaluation_scope_count: 25,
        sampling_method: "random",
        sampling_seed: 42,
        batch_size: 5,
        judge_instructions: "Review {{ inputs }} against {{ outputs }}.",
        additional_guidance: "Prefer literal translations only when necessary.",
      },
    },
  }
  bookConfigState.isLoading = false
  bookConfigState.error = null
  updateConfigState.isPending = false
})

describe("TranslationEvaluationSettingsTab", () => {
  it("saves the redesigned translation evaluation settings", async () => {
    const { TranslationEvaluationSettingsTab } = await import("./TranslationEvaluationSettingsTab")
    render(<TranslationEvaluationSettingsTab label="demo-book" />)

    fireEvent.change(screen.getByLabelText("Judge model"), {
      target: { value: "openai:/gpt-5.4-mini" },
    })
    fireEvent.change(screen.getByLabelText("Evaluation scope count"), {
      target: { value: "50" },
    })
    fireEvent.change(screen.getByLabelText("Sampling seed"), {
      target: { value: "123" },
    })
    fireEvent.change(screen.getByLabelText("Batch size"), {
      target: { value: "8" },
    })
    fireEvent.change(screen.getByLabelText("Max retries"), {
      target: { value: "4" },
    })
    fireEvent.change(screen.getByLabelText("Judge instructions"), {
      target: { value: "Check {{ inputs }} against {{ outputs }} carefully." },
    })
    fireEvent.change(screen.getByLabelText("Additional guidance"), {
      target: { value: "Favor terms used in primary school textbooks." },
    })

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    expect(updateConfigState.mutate).toHaveBeenCalledWith({
      label: "demo-book",
      config: {
        translation_evaluation: {
          judge_model: "openai:/gpt-5.4-mini",
          max_retries: 4,
          evaluation_scope_mode: "sample",
          evaluation_scope_count: 50,
          sampling_method: "random",
          sampling_seed: 123,
          batch_size: 8,
          judge_instructions: "Check {{ inputs }} against {{ outputs }} carefully.",
          additional_guidance: "Favor terms used in primary school textbooks.",
        },
      },
    })
  })

  it("maps legacy sample_size into the new scope controls", async () => {
    bookConfigState.data = {
      config: {
        translation_evaluation: {
          enabled: true,
          judge_model: "openai:/gpt-4.1-mini",
          sample_size: 25,
          max_retries: 2,
        },
      },
    }

    const { TranslationEvaluationSettingsTab } = await import("./TranslationEvaluationSettingsTab")
    render(<TranslationEvaluationSettingsTab label="demo-book" />)

    expect((screen.getByRole("combobox", { name: "Scope mode" }) as HTMLButtonElement).textContent).toContain("Sample entries")
    expect((screen.getByLabelText("Evaluation scope count") as HTMLInputElement).value).toBe("25")
  })

  it("resets judge instructions to the default template", async () => {
    const { TranslationEvaluationSettingsTab } = await import("./TranslationEvaluationSettingsTab")
    render(<TranslationEvaluationSettingsTab label="demo-book" />)

    fireEvent.change(screen.getByLabelText("Judge instructions"), {
      target: { value: "Custom judge prompt" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Reset to default" }))

    expect((screen.getByLabelText("Judge instructions") as HTMLTextAreaElement).value).toBe(
      DEFAULT_TRANSLATION_EVALUATION_JUDGE_INSTRUCTIONS,
    )
  })

  it("disables scope controls and resets sampling method to sequential when all entries is selected", async () => {
    const { TranslationEvaluationSettingsTab } = await import("./TranslationEvaluationSettingsTab")
    render(<TranslationEvaluationSettingsTab label="demo-book" />)

    fireEvent.click(screen.getByRole("combobox", { name: "Scope mode" }))
    fireEvent.click(screen.getByText("All entries"))

    expect((screen.getByLabelText("Evaluation scope count") as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByRole("combobox", { name: "Sampling method" }).getAttribute("data-disabled")).not.toBeNull()
    expect((screen.getByLabelText("Sampling seed") as HTMLInputElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    expect(updateConfigState.mutate).toHaveBeenCalledWith({
      label: "demo-book",
      config: expect.objectContaining({
        translation_evaluation: expect.objectContaining({
          evaluation_scope_mode: "all",
          sampling_method: "sequential",
        }),
      }),
    })
  })
})
