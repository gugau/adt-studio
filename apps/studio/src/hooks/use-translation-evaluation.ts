import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/api/client"
import { bookTasksKey } from "./use-book-tasks"

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

  return useMutation({
    mutationFn: (language: string) => api.runTranslationEvaluation(label, language),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookTasksKey(label) })
      queryClient.invalidateQueries({ queryKey: translationEvaluationsKey(label) })
    },
  })
}
