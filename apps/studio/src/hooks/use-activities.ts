import { useQuery } from "@tanstack/react-query"
import { api } from "@/api/client"

export function useActivities(label: string) {
  return useQuery({
    queryKey: ["books", label, "activities"],
    queryFn: () => api.getActivities(label),
  })
}
