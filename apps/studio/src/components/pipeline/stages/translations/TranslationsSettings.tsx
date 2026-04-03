import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "@tanstack/react-router"
import { Play, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useBookConfig, useUpdateBookConfig } from "@/hooks/use-book-config"
import { useActiveConfig } from "@/hooks/use-debug"
import { useBook } from "@/hooks/use-books"
import { useApiKey } from "@/hooks/use-api-key"
import { api } from "@/api/client"
import { PromptViewer } from "@/components/pipeline/components/PromptViewer"
import { LanguagePicker } from "@/components/LanguagePicker"
import { useBookRun } from "@/hooks/use-book-run"
import { useStepConfig } from "@/hooks/use-step-config"
import { normalizeLocale } from "@/lib/languages"
import { useLingui } from "@lingui/react/macro"

export function TranslationsSettings({ bookLabel, headerTarget, tab = "general" }: { bookLabel: string; headerTarget?: HTMLDivElement | null; tab?: string }) {
  const { t } = useLingui()
  const { data: bookConfigData } = useBookConfig(bookLabel)
  const { data: activeConfigData } = useActiveConfig(bookLabel)
  const { data: book } = useBook(bookLabel)
  const updateConfig = useUpdateBookConfig()
  const { apiKey, hasApiKey, azureKey, azureRegion, geminiKey } = useApiKey()
  const { queueRun } = useBookRun()
  const navigate = useNavigate()
  const [showRerunDialog, setShowRerunDialog] = useState(false)

  const [outputLanguages, setOutputLanguages] = useState<Set<string>>(new Set())
  const [promptDraft, setPromptDraft] = useState<string | null>(null)

  const [dirty, setDirty] = useState<Record<string, boolean>>({})
  const markDirty = (field: string) => setDirty((prev) => ({ ...prev, [field]: true }))

  const merged = activeConfigData?.merged as Record<string, unknown> | undefined
  const translation = useStepConfig(merged, "translation", markDirty)
  const bookLanguage = book?.languageCode ?? book?.metadata?.language_code ?? null

  useEffect(() => {
    if (!activeConfigData) return
    const m = activeConfigData.merged as Record<string, unknown>
    if (Array.isArray(m.output_languages) && m.output_languages.length > 0) {
      const normalized = (m.output_languages as string[]).map((code) => normalizeLocale(code))
      setOutputLanguages(new Set(normalized))
    } else if (bookLanguage) {
      setOutputLanguages(new Set([normalizeLocale(bookLanguage)]))
    }
  }, [activeConfigData, bookLanguage])

  const shouldWrite = (field: string) =>
    dirty[field] || (bookConfigData?.config && field in bookConfigData.config)

  const buildOverrides = () => {
    const overrides: Record<string, unknown> = {}
    if (bookConfigData?.config) Object.assign(overrides, bookConfigData.config)

    if (shouldWrite("translation")) {
      const existing = (bookConfigData?.config?.translation ?? {}) as Record<string, unknown>
      overrides.translation = { ...existing, ...translation.configOverrides }
    }
    if (shouldWrite("output_languages")) {
      const normalized = Array.from(outputLanguages).map((code) => normalizeLocale(code))
      const isOnlyBookLang = bookLanguage && normalized.length === 1 && normalizeLocale(normalized[0]) === normalizeLocale(bookLanguage)
      overrides.output_languages = normalized.length > 0 && !isOnlyBookLang ? normalized : undefined
    }
    return overrides
  }

  const toggleLanguage = (code: string) => {
    const normalizedCode = normalizeLocale(code)
    setOutputLanguages((prev) => {
      const next = new Set(prev)
      if (next.has(normalizedCode)) next.delete(normalizedCode)
      else next.add(normalizedCode)
      return next
    })
    markDirty("output_languages")
  }

  const saveOnly = async () => {
    const promptSaves: Promise<unknown>[] = []
    if (promptDraft != null) promptSaves.push(api.updatePrompt("translation", promptDraft, bookLabel))
    if (promptSaves.length > 0) await Promise.all(promptSaves)

    const overrides = buildOverrides()
    updateConfig.mutate(
      { label: bookLabel, config: overrides },
      {
        onSuccess: () => {
          setDirty({})
          setPromptDraft(null)
        },
      }
    )
  }

  const confirmSaveAndRerun = async () => {
    const promptSaves: Promise<unknown>[] = []
    if (promptDraft != null) promptSaves.push(api.updatePrompt("translation", promptDraft, bookLabel))
    if (promptSaves.length > 0) await Promise.all(promptSaves)

    const overrides = buildOverrides()
    updateConfig.mutate(
      { label: bookLabel, config: overrides },
      {
        onSuccess: async () => {
          setDirty({})
          setPromptDraft(null)
          setShowRerunDialog(false)
          queueRun({
            fromStage: "translation",
            toStage: "translation",
            apiKey,
            providerCredentials: {
              azure: { key: azureKey, region: azureRegion },
              geminiApiKey: geminiKey,
            },
          })
          navigate({ to: "/books/$label/$step", params: { label: bookLabel, step: "translation" } })
        },
      }
    )
  }

  return (
    <div className={tab === "prompt" ? "h-full max-w-4xl" : "p-4 max-w-2xl space-y-6"}>
      {tab === "general" && (
        <LanguagePicker
          selected={outputLanguages}
          onSelect={toggleLanguage}
          multiple
          label={t`Output Languages`}
          bookLanguage={bookLanguage}
        />
      )}

      {tab === "prompt" && (
        <PromptViewer
          promptName="translation"
          bookLabel={bookLabel}
          title={t`Translation Prompt`}
          description={t`The prompt template used to translate text catalog entries.`}
          model={translation.model}
          onModelChange={translation.onModelChange}
          maxRetries={translation.maxRetries}
          onMaxRetriesChange={translation.onMaxRetriesChange}
          onContentChange={setPromptDraft}
          enabled={tab === "prompt"}
        />
      )}

      {headerTarget && (tab === "general" || tab === "prompt") && createPortal(
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            className="h-7 px-2.5 text-xs bg-black/15 text-white hover:bg-black/25"
            onClick={saveOnly}
            disabled={updateConfig.isPending}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {t`Save`}
          </Button>
          <Button
            size="sm"
            className="h-7 px-2.5 text-xs bg-black/15 text-white hover:bg-black/25"
            onClick={() => setShowRerunDialog(true)}
            disabled={updateConfig.isPending || !hasApiKey}
          >
            <Play className="mr-1.5 h-3.5 w-3.5" />
            {t`Save & Rerun`}
          </Button>
        </div>,
        headerTarget
      )}

      <Dialog open={showRerunDialog} onOpenChange={setShowRerunDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t`Save & Rerun Translations`}</DialogTitle>
            <DialogDescription>
              {t`This will save your settings and re-run translations, rebuilding the text catalog and translating to output languages.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRerunDialog(false)}>
              {t`Cancel`}
            </Button>
            <Button onClick={confirmSaveAndRerun} disabled={updateConfig.isPending}>
              {updateConfig.isPending ? t`Saving...` : t`Confirm Rerun`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
