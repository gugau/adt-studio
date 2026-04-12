import { AlertCircle, FileX2 } from "lucide-react"
import { Trans } from "@lingui/react/macro"
import { useLingui } from "@lingui/react/macro"

type StageAction =
  | "previewing"
  | "exporting"
  | "running validation"
  | "adding sign language videos"
  | "generating quizzes"
  | "generating captions"
  | "generating glossary"
  | "generating table of contents"
  | "translating"
  | "generating speech"

export function StoryboardRequired({ action }: { action: StageAction }) {
  const { t } = useLingui()

  const actionLabels: Record<StageAction, string> = {
    "previewing": t`previewing`,
    "exporting": t`exporting`,
    "running validation": t`running validation`,
    "adding sign language videos": t`adding sign language videos`,
    "generating quizzes": t`generating quizzes`,
    "generating captions": t`generating captions`,
    "generating glossary": t`generating glossary`,
    "generating table of contents": t`generating table of contents`,
    "translating": t`translating`,
    "generating speech": t`generating speech`,
  }

  const translatedAction = actionLabels[action]

  return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 max-w-sm text-center px-6">
        <AlertCircle className="w-8 h-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          <Trans>A storyboard must be built before {translatedAction}.</Trans>
        </p>
        <p className="text-sm text-muted-foreground">
          <Trans>Run the pipeline through at least the <span className="font-medium text-foreground">Storyboard</span> stage first.</Trans>
        </p>
      </div>
    </div>
  )
}

type EmptyContext = "preview" | "export"

export function AllPagesPruned({ context }: { context: EmptyContext }) {
  const { t } = useLingui()

  const titles: Record<EmptyContext, string> = {
    "preview": t`No pages to preview`,
    "export": t`Nothing to export`,
  }

  return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 max-w-sm text-center px-6">
        <div className="rounded-full bg-muted/60 p-4">
          <FileX2 className="w-7 h-7 text-muted-foreground/60" />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-foreground">
            {titles[context]}
          </p>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            <Trans>All pages in this book have been pruned or have no content to render. Return to the <span className="font-medium text-foreground">Extract</span> stage to adjust pruning settings, then re-run the pipeline.</Trans>
          </p>
        </div>
      </div>
    </div>
  )
}
