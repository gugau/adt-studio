import { createOpenAI, openai } from "@ai-sdk/openai"
import { anthropic, createAnthropic } from "@ai-sdk/anthropic"
import type { LanguageModel } from "ai"

export interface AgentCredentials {
  openaiApiKey?: string
  anthropicApiKey?: string
}

/**
 * Resolve a "provider:model" string (e.g. "openai:gpt-5") to a Vercel AI SDK
 * LanguageModel suitable for generateText with tools. Mirrors the resolver in
 * @adt/llm but exposes the raw model, since the agent loop here uses
 * generateText rather than the wrapped generateObject pipeline.
 */
export function resolveAgentModel(
  modelId: string,
  credentials?: AgentCredentials,
): LanguageModel {
  const colonIdx = modelId.indexOf(":")
  const provider = colonIdx >= 0 ? modelId.slice(0, colonIdx) : "openai"
  const model = colonIdx >= 0 ? modelId.slice(colonIdx + 1) : modelId

  switch (provider) {
    case "openai": {
      const client = credentials?.openaiApiKey
        ? createOpenAI({ apiKey: credentials.openaiApiKey })
        : openai
      return client(model)
    }
    case "anthropic": {
      const client = credentials?.anthropicApiKey
        ? createAnthropic({ apiKey: credentials.anthropicApiKey })
        : anthropic
      return client(model)
    }
    default:
      throw new Error(`Unsupported agent provider: ${provider}`)
  }
}
