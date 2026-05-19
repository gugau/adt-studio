// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { useApiKey } from "./use-api-key"

afterEach(() => {
  localStorage.clear()
})

describe("useApiKey", () => {
  it("keeps mounted hook instances synchronized after saving a key", () => {
    const first = renderHook(() => useApiKey())
    const second = renderHook(() => useApiKey())

    expect(first.result.current.hasApiKey).toBe(false)
    expect(second.result.current.hasApiKey).toBe(false)

    act(() => {
      first.result.current.setApiKey("  sk-test  ")
    })

    expect(first.result.current.apiKey).toBe("sk-test")
    expect(first.result.current.hasApiKey).toBe(true)
    expect(second.result.current.apiKey).toBe("sk-test")
    expect(second.result.current.hasApiKey).toBe(true)
    expect(localStorage.getItem("adt-studio-openai-key")).toBe("sk-test")
  })

  it("does not treat whitespace as a configured key", () => {
    const hook = renderHook(() => useApiKey())

    act(() => {
      hook.result.current.setApiKey("   ")
    })

    expect(hook.result.current.apiKey).toBe("")
    expect(hook.result.current.hasApiKey).toBe(false)
    expect(localStorage.getItem("adt-studio-openai-key")).toBeNull()
  })
})
