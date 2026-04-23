import { createFileRoute } from "@tanstack/react-router"
import { ImportProject } from "@/components/import/ImportProject"
import { StudioTopBar } from "@/components/StudioTopBar"
import { Trans } from "@lingui/react/macro"

function ImportBookPage() {
  return (
    <div className="flex flex-1 min-h-0 flex-col h-full bg-white">
      <StudioTopBar brandLinksHome trailingTitle={<Trans>Import Project</Trans>} />
      <div className="flex flex-1 min-h-0 flex-col overflow-auto">
        <ImportProject />
      </div>
    </div>
  )
}

export const Route = createFileRoute("/books/import")({
  component: ImportBookPage,
})
