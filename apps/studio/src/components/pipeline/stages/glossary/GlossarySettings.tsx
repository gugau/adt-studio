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

export function GlossarySettings({ bookLabel }: { bookLabel: string; headerTarget?: HTMLDivElement | null; tab?: string }) {
  const { t } = useLingui()
  const { data: bookConfigData } = useBookConfig(bookLabel)
  const { data: activeConfigData } = useActiveConfig(bookLabel)
  const [promptDraft, setPromptDraft] = useState<string | null>(null)

  const { markDirty, isDirty, shouldWrite, reset } = useDirtyConfig(bookConfigData?.config)

  const merged = activeConfigData?.merged as Record<string, unknown> | undefined
  const glossary = useStepConfig(merged, "glossary", markDirty)

  const buildOverrides = () => {
    const overrides: Record<string, unknown> = {}
    if (bookConfigData?.config) Object.assign(overrides, bookConfigData.config)

    if (shouldWrite("glossary")) {
      const existing = (bookConfigData?.config?.glossary ?? {}) as Record<string, unknown>
      overrides.glossary = { ...existing, ...glossary.configOverrides }
    }
    return overrides
  }

  const rerun = useSaveAndRerun({
    bookLabel,
    stage: "glossary",
    hasPendingChanges: isDirty || promptDraft != null,
    buildOverrides,
    savePrompts: async () => {
      if (promptDraft != null) await api.updatePrompt("glossary", promptDraft, bookLabel)
    },
    onSaved: () => {
      reset()
      setPromptDraft(null)
    },
    dialogTitle: t`Save & Rerun Glossary`,
    dialogDescription: t`This will save your settings and re-run glossary generation.`,
  })

  return (
    <>
      <StageRerunBar controller={rerun} />
      <div className="h-full max-w-4xl">
      <PromptViewer
        promptName="glossary"
        bookLabel={bookLabel}
        title={t`Glossary Prompt`}
        description={t`The prompt template used to generate glossary terms from book content.`}
        model={glossary.model}
        onModelChange={glossary.onModelChange}
        maxRetries={glossary.maxRetries}
        onMaxRetriesChange={glossary.onMaxRetriesChange}
        onContentChange={setPromptDraft}
      />
      </div>
    </>
  )
}
