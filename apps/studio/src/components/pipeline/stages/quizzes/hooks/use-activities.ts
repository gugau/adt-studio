import { useQuery } from "@tanstack/react-query"
import { api } from "@/api/client"

export function useActivities(label: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["books", label, "activities"],
    queryFn: () => api.getActivities(label),
    enabled: !!label && (options?.enabled ?? true),
  })
}
