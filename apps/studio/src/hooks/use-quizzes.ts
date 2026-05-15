import { useQuery } from "@tanstack/react-query"
import { api } from "@/api/client"

export function useQuizzes(label: string) {
  return useQuery({
    queryKey: ["books", label, "quizzes"],
    queryFn: () => api.getQuizzes(label),
    enabled: !!label,
  })
}

export function useTextbookActivities(label: string) {
  return useQuery({
    queryKey: ["books", label, "quizzes", "textbook-activities"],
    queryFn: () => api.getTextbookActivities(label),
    enabled: !!label,
  })
}
