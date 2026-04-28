import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"

const mocks = vi.hoisted(() => {
  const generateObject = vi.fn()
  const scopedOpenAIModel = vi.fn((model: string, options?: unknown) => ({
    provider: "scoped-openai",
    model,
    options,
  }))
  const createOpenAI = vi.fn(() => scopedOpenAIModel)
  const openai = vi.fn((model: string, options?: unknown) => ({
    provider: "env-openai",
    model,
    options,
  }))
  const anthropic = vi.fn()
  const google = vi.fn()

  return {
    anthropic,
    createOpenAI,
    generateObject,
    google,
    openai,
    scopedOpenAIModel,
  }
})

vi.mock("ai", () => ({
  APICallError: { isInstance: () => false },
  NoObjectGeneratedError: { isInstance: () => false },
  generateObject: mocks.generateObject,
}))

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: mocks.createOpenAI,
  openai: mocks.openai,
}))

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: mocks.anthropic,
}))

vi.mock("@ai-sdk/google", () => ({
  google: mocks.google,
}))

import { createLLMModel } from "../client.js"

describe("createLLMModel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.generateObject.mockResolvedValue({
      object: { ok: true },
      usage: { promptTokens: 3, completionTokens: 2 },
    })
  })

  it("passes an explicit OpenAI API key without using the env-backed provider", async () => {
    const model = createLLMModel({
      modelId: "openai:gpt-test",
      openaiApiKey: " sk-explicit ",
      logLevel: "silent",
    })

    await model.generateObject({
      schema: z.object({ ok: z.boolean() }),
      messages: [{ role: "user", content: "test" }],
    })

    expect(mocks.createOpenAI).toHaveBeenCalledWith({ apiKey: "sk-explicit" })
    expect(mocks.scopedOpenAIModel).toHaveBeenCalledWith("gpt-test", undefined)
    expect(mocks.openai).not.toHaveBeenCalled()
  })

  it("keeps the existing env-backed OpenAI provider when no explicit key is supplied", async () => {
    const model = createLLMModel({
      modelId: "openai:gpt-test",
      logLevel: "silent",
    })

    await model.generateObject({
      schema: z.object({ ok: z.boolean() }),
      messages: [{ role: "user", content: "test" }],
    })

    expect(mocks.openai).toHaveBeenCalledWith("gpt-test", undefined)
    expect(mocks.createOpenAI).not.toHaveBeenCalled()
  })

  it("passes explicit custom provider credentials", async () => {
    const model = createLLMModel({
      modelId: "custom:gpt-test",
      customBaseUrl: " https://llm.example/v1 ",
      customApiKey: " custom-key ",
      logLevel: "silent",
    })

    await model.generateObject({
      schema: z.object({ ok: z.boolean() }),
      messages: [{ role: "user", content: "test" }],
    })

    expect(mocks.createOpenAI).toHaveBeenCalledWith({
      baseURL: "https://llm.example/v1",
      apiKey: "custom-key",
    })
    expect(mocks.scopedOpenAIModel).toHaveBeenCalledWith("gpt-test", undefined)
  })
})
