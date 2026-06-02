import { HelpCircle } from "lucide-react"
import { Trans } from "@lingui/react/macro"

export function GlossaryHintBanner() {
  return (
    <div className="mx-4 mt-3 flex items-start gap-3 rounded-lg border border-lime-200/70 bg-lime-50/60 px-4 py-3">
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime-100 text-lime-700">
        <HelpCircle className="h-3.5 w-3.5" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-lime-900">
          <Trans>How the glossary works</Trans>
        </span>
        <p className="text-[12px] leading-relaxed text-lime-800/80">
          <Trans>
            Terms were picked by AI from the book. Edit a definition or its emojis, add your own
            terms, or prune the ones you don't want. Pruned terms stay out of the output and future
            regenerations. Changes are saved as a new version, so you can always roll back.
          </Trans>
        </p>
      </div>
    </div>
  )
}
