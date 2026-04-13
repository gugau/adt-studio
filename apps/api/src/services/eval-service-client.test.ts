import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createEvalServiceClient } from "./eval-service-client.js"

describe("eval-service-client", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("posts translation evaluation requests and parses results", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          generated_at: "2026-04-06T12:02:00.000Z",
          provider: "mlflow",
          language: "fr",
          source_catalog_version: 2,
          translation_version: 3,
          eval_config_hash: "cfg-123",
          summary: {
            total: 1,
            acceptable: 1,
            unacceptable: 0,
          },
          items: [
            {
              entry_id: "pg001:body",
              acceptable: true,
              rationale: "Meaning is preserved.",
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    )

    const client = createEvalServiceClient({
      baseUrl: "http://eval-service:8081",
      token: "secret-token",
    })

    const result = await client.evaluateTranslation({
      book_label: "book-1",
      language: "fr",
      source_language: "en",
      source_catalog_version: 2,
      translation_version: 3,
      eval_config_hash: "cfg-123",
      judge_model: "openai:/gpt-4.1-mini",
      evaluation_scope_mode: "sample",
      evaluation_scope_count: 20,
      sampling_method: "random",
      sampling_seed: 1234,
      batch_size: 5,
      judge_instructions: "Review {{ inputs }} against {{ outputs }}.",
      additional_guidance: "Prefer school vocabulary.",
      sample_size: 20,
      entries: [
        {
          entry_id: "pg001:body",
          source_text: "Hello world",
          translated_text: "Bonjour le monde",
        },
      ],
    })

    expect(result.language).toBe("fr")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe("http://eval-service:8081/evaluate/translation")
    expect(init?.method).toBe("POST")
    expect(init?.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer secret-token",
    })
  })

  it("throws the service error message for non-2xx responses", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: "Judge model is not available" }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      ),
    )

    const client = createEvalServiceClient({
      baseUrl: "http://eval-service:8081",
    })

    await expect(client.evaluateTranslation({
      book_label: "book-1",
      language: "fr",
      source_catalog_version: 2,
      translation_version: 3,
      eval_config_hash: "cfg-123",
      entries: [
        {
          entry_id: "pg001:body",
          source_text: "Hello world",
          translated_text: "Bonjour le monde",
        },
      ],
    })).rejects.toThrow("Judge model is not available")
  })

  it("rejects invalid service responses", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    )

    const client = createEvalServiceClient({
      baseUrl: "http://eval-service:8081",
    })

    await expect(client.evaluateTranslation({
      book_label: "book-1",
      language: "fr",
      source_catalog_version: 2,
      translation_version: 3,
      eval_config_hash: "cfg-123",
      entries: [
        {
          entry_id: "pg001:body",
          source_text: "Hello world",
          translated_text: "Bonjour le monde",
        },
      ],
    })).rejects.toThrow()
  })
})
