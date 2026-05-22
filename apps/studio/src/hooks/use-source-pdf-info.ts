import { useQuery } from "@tanstack/react-query"
import { api } from "@/api/client"

export function useSourcePdfInfo(label: string) {
  return useQuery({
    queryKey: ["books", label, "source-pdf-info"],
    queryFn: () => api.getSourcePdfInfo(label),
    enabled: !!label,
    staleTime: Infinity,
  })
}
