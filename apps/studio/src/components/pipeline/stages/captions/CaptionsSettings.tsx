import { useState } from "react"
import { useBookConfig } from "@/hooks/use-book-config"
import { useActiveConfig } from "@/hooks/use-debug"
import { api } from "@/api/client"
import { PromptViewer } from "@/components/pipeline/components/PromptViewer"
import { useStepConfig } from "@/hooks/use-step-config"
import {
  useSaveAndRerun,
  useDirtyConfig,
  StageRerunBar,
} from "@/components/pipeline/components/stage-rerun"
import { useLingui } from "@lingui/react/macro"

export function CaptionsSettings({ bookLabel }: { bookLabel: string; tab?: string }) {
  const { t } = useLingui()
  const { data: bookConfigData } = useBookConfig(bookLabel)
  const { data: activeConfigData } = useActiveConfig(bookLabel)
  const [promptDraft, setPromptDraft] = useState<string | null>(null)

  const { markDirty, isDirty, shouldWrite, reset } = useDirtyConfig(bookConfigData?.config)

  const merged = activeConfigData?.merged as Record<string, unknown> | undefined
  const caption = useStepConfig(merged, "image_captioning", markDirty)

  const buildOverrides = () => {
    const overrides: Record<string, unknown> = {}
    if (bookConfigData?.config) Object.assign(overrides, bookConfigData.config)

    if (shouldWrite("image_captioning")) {
      const existing = (bookConfigData?.config?.image_captioning ?? {}) as Record<string, unknown>
      overrides.image_captioning = { ...existing, ...caption.configOverrides }
    }
    return overrides
  }

  const rerun = useSaveAndRerun({
    bookLabel,
    stage: "captions",
    hasPendingChanges: isDirty || promptDraft != null,
    buildOverrides,
    savePrompts: async () => {
      if (promptDraft != null) await api.updatePrompt("image_captioning", promptDraft, bookLabel)
    },
    onSaved: () => {
      reset()
      setPromptDraft(null)
    },
    dialogTitle: t`Save & Rerun Captions`,
    dialogDescription: t`This will save your settings and re-run image captioning.`,
  })

  return (
    <>
      <StageRerunBar controller={rerun} />
      <div className="h-full max-w-4xl">
      <PromptViewer
        promptName="image_captioning"
        bookLabel={bookLabel}
        title={t`Caption Prompt`}
        description={t`The prompt template used to generate captions for images in the book.`}
        model={caption.model}
        onModelChange={caption.onModelChange}
        maxRetries={caption.maxRetries}
        onMaxRetriesChange={caption.onMaxRetriesChange}
        onContentChange={setPromptDraft}
      />
      </div>
    </>
  )
}
