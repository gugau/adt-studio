import { TriangleAlert } from "lucide-react"
import { Trans } from "@lingui/react/macro"

export function PrerequisiteWarnings({
  storyboardReady,
  hasNoPages,
  allPagesPruned,
  stageName,
}: {
  storyboardReady: boolean
  hasNoPages: boolean
  allPagesPruned: boolean
  stageName: string
}) {
  return (
    <>
      {!storyboardReady && (
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <TriangleAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium text-amber-800">
              <Trans>Storyboard not ready</Trans>
            </span>
            <span className="text-[12px] text-amber-700 leading-relaxed">
              <Trans>
                The storyboard must be completed before generating {stageName}.
                Run the Storyboard stage first.
              </Trans>
            </span>
          </div>
        </div>
      )}

      {storyboardReady && hasNoPages && (
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <TriangleAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium text-amber-800">
              <Trans>No pages found</Trans>
            </span>
            <span className="text-[12px] text-amber-700 leading-relaxed">
              <Trans>
                This book has no pages. Make sure the extraction and storyboard
                stages produced content before generating {stageName}.
              </Trans>
            </span>
          </div>
        </div>
      )}

      {storyboardReady && !hasNoPages && allPagesPruned && (
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <TriangleAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium text-amber-800">
              <Trans>All pages are pruned</Trans>
            </span>
            <span className="text-[12px] text-amber-700 leading-relaxed">
              <Trans>
                Every page in this book has all sections pruned. There is no
                content available to generate {stageName} from.
              </Trans>
            </span>
          </div>
        </div>
      )}
    </>
  )
}
