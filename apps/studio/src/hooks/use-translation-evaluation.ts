import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/api/client"
import { bookTasksKey } from "./use-book-tasks"
import { useApiKey } from "./use-api-key"

export const translationEvaluationsKey = (label: string) =>
  ["evaluations", "translations", label] as const

export function useTranslationEvaluations(label: string) {
  return useQuery({
    queryKey: translationEvaluationsKey(label),
    queryFn: () => api.getTranslationEvaluations(label),
    enabled: !!label,
  })
}

export function useRunTranslationEvaluation(label: string) {
  const queryClient = useQueryClient()
  const { apiKey } = useApiKey()

  return useMutation({
    mutationFn: (language: string) => {
      const openaiApiKey = apiKey.trim()
      if (!openaiApiKey) {
        throw new Error("OpenAI API key required for translation evaluation.")
      }
      return api.runTranslationEvaluation(label, language, openaiApiKey)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookTasksKey(label) })
      queryClient.invalidateQueries({ queryKey: translationEvaluationsKey(label) })
    },
  })
}
