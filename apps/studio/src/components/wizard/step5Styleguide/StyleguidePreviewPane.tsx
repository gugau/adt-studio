import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { Trans, useLingui } from "@lingui/react/macro"
import type { ReactNode } from "react"
import { Palette } from "lucide-react"
import { useStyleguidePreview } from "@/hooks/use-presets"

const PREVIEW_HEADER = msg`Style guide`
const IFRAME_TITLE = msg`Styleguide Preview`

function PreviewShell({
  labelMsg,
  labelOverride,
  children,
}: {
  labelMsg: MessageDescriptor
  labelOverride?: string
  children: ReactNode
}) {
  const { i18n } = useLingui()

  return (
    <div className="@container flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md bg-white shadow-[0px_17px_38px_0px_rgba(0,0,0,0.1),0px_69px_69px_0px_rgba(0,0,0,0.09),0px_155px_93px_0px_rgba(0,0,0,0.05)]">
      <div className="shrink-0 border-b border-border/80 bg-muted/25 px-3 py-2">
        <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {labelOverride ?? i18n._(labelMsg)}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-[#fafafa]">{children}</div>
    </div>
  )
}

function IdleIllustration() {
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-6 px-6 py-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-border bg-white text-muted-foreground">
        <Palette className="h-7 w-7" />
      </div>
      <div className="max-w-[280px] text-center">
        <p className="text-base font-semibold text-foreground">
          <Trans>Style Guide</Trans>
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          <Trans>
            Select a style guide to preview how it styles the generated pages - typography, colors, and
            component layout.
          </Trans>
        </p>
      </div>
    </div>
  )
}

export function StyleguidePreviewPane({
  styleguide,
}: {
  styleguide: string
}) {
  const { i18n } = useLingui()
  const { data: previewData, isLoading } = useStyleguidePreview(
    styleguide || null,
  )

  if (!styleguide) {
    return (
      <PreviewShell labelMsg={PREVIEW_HEADER}>
        <IdleIllustration />
      </PreviewShell>
    )
  }

  return (
    <PreviewShell labelMsg={PREVIEW_HEADER} labelOverride={styleguide}>
      {isLoading ? (
        <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-muted-foreground">
          <Trans>Loading preview...</Trans>
        </div>
      ) : (
        <iframe
          srcDoc={previewData?.html ?? ""}
          className="h-full w-full border-0"
          sandbox="allow-scripts"
          title={i18n._(IFRAME_TITLE)}
        />
      )}
    </PreviewShell>
  )
}
