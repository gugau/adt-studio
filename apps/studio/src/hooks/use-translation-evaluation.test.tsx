// @vitest-environment jsdom
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { api } from "@/api/client"
import { useRunTranslationEvaluation } from "./use-translation-evaluation"

vi.mock("@/api/client", () => ({
  api: {
    runTranslationEvaluation: vi.fn(),
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe("useRunTranslationEvaluation", () => {
  it("trims and forwards the supplied OpenAI key to the API client", async () => {
    vi.mocked(api.runTranslationEvaluation).mockResolvedValue({
      taskId: "task-1",
      status: "submitted",
      label: "demo-book",
      language: "es-ES",
    })

    const hook = renderHook(() => useRunTranslationEvaluation("demo-book"), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await hook.result.current.mutateAsync({ language: "es-ES", apiKey: "  sk-test  " })
    })

    expect(api.runTranslationEvaluation).toHaveBeenCalledWith("demo-book", "es-ES", "sk-test")
  })

  it("allows blank keys so the API can use its server-side fallback", async () => {
    vi.mocked(api.runTranslationEvaluation).mockResolvedValue({
      taskId: "task-1",
      status: "submitted",
      label: "demo-book",
      language: "es-ES",
    })

    const hook = renderHook(() => useRunTranslationEvaluation("demo-book"), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await hook.result.current.mutateAsync({ language: "es-ES", apiKey: "   " })
    })

    expect(api.runTranslationEvaluation).toHaveBeenCalledWith("demo-book", "es-ES", "")
  })
})
