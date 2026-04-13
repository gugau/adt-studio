import {
  TranslationEvaluationResult,
  TranslationEvaluationRunRequest,
  type TranslationEvaluationResult as TranslationEvaluationResultData,
  type TranslationEvaluationRunRequest as TranslationEvaluationRunRequestData,
} from "@adt/types"

export interface EvalServiceClient {
  evaluateTranslation(
    request: TranslationEvaluationRunRequestData,
  ): Promise<TranslationEvaluationResultData>
}

interface EvalServiceClientOptions {
  baseUrl: string
  token?: string
  fetchFn?: typeof fetch
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
}

async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? ""
  try {
    if (contentType.includes("application/json")) {
      const body = await response.json() as { error?: unknown; message?: unknown }
      if (typeof body.error === "string" && body.error.length > 0) return body.error
      if (typeof body.message === "string" && body.message.length > 0) return body.message
    }
    const text = await response.text()
    if (text.trim().length > 0) return text
  } catch {
    // Ignore parse failures and fall back to generic message.
  }
  return `Eval service request failed with status ${response.status}`
}

export function createEvalServiceClient(options: EvalServiceClientOptions): EvalServiceClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl)
  const fetchFn = options.fetchFn ?? fetch

  return {
    async evaluateTranslation(
      request: TranslationEvaluationRunRequestData,
    ): Promise<TranslationEvaluationResultData> {
      const parsedRequest = TranslationEvaluationRunRequest.parse(request)
      const response = await fetchFn(`${baseUrl}/evaluate/translation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        },
        body: JSON.stringify(parsedRequest),
      })

      if (!response.ok) {
        throw new Error(await readErrorMessage(response))
      }

      const body = await response.json()
      return TranslationEvaluationResult.parse(body)
    },
  }
}
