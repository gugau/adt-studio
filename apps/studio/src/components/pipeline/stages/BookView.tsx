import { BookPipelineMap } from "./BookPipelineMap"

interface ViewProps {
  bookLabel: string
  selectedPageId?: string
  onSelectPage?: (pageId: string | null) => void
}

export function BookView({ bookLabel }: ViewProps) {
  return <BookPipelineMap bookLabel={bookLabel} />
}
