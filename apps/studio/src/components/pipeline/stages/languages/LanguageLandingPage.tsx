import { useState, useEffect } from "react"
import { Languages, ArrowRight, X } from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import { LandingPageShell } from "@/components/pipeline/components/LandingPageShell"
import { PrereqGuard } from "@/components/pipeline/components/PrereqGuard"
import {
  SettingsCard,
  SettingsField,
} from "@/components/pipeline/components/SettingsCard"
import { BrandedSwitch } from "@/components/ui/branded-switch"
import { LanguagePicker } from "@/components/LanguagePicker"
import { useActiveConfig } from "@/hooks/use-debug"
import { useStageStatus } from "@/hooks/use-stage-status"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { useBookConfig } from "@/hooks/use-book-config"
import { usePersistConfig } from "@/hooks/use-persist-config"
import { useBook } from "@/hooks/use-books"
import { displayLang } from "./lib/display-lang"
import { cn } from "@/lib/utils"

export function LanguageLandingPage({ bookLabel }: { bookLabel: string }) {
  const { t } = useLingui()
  const { data: bookConfigData } = useBookConfig(bookLabel)
  const { data: activeConfigData } = useActiveConfig(bookLabel)
  const { data: book } = useBook(bookLabel)
  const persist = usePersistConfig(bookLabel)
  const { apiKey, hasApiKey } = useApiKey()
  const { queueRun } = useBookRun()
  const status = useStageStatus("translate")
  const storyboardStatus = useStageStatus("storyboard")
  const storyboardReady = storyboardStatus.isCompleted

  const [outputLanguages, setOutputLanguages] = useState<Set<string>>(new Set())
  const [imageTranslationEnabled, setImageTranslationEnabled] = useState(false)

  useEffect(() => {
    if (!activeConfigData) return
    const m = activeConfigData.merged as Record<string, unknown>
    if (Array.isArray(m.output_languages)) {
      setOutputLanguages(new Set(m.output_languages as string[]))
    }
    if (m.image_translation && typeof m.image_translation === "object") {
      const it = m.image_translation as Record<string, unknown>
      setImageTranslationEnabled(it.enabled === true)
    }
  }, [activeConfigData])

  const baseLanguage =
    typeof activeConfigData?.merged?.editing_language === "string"
      ? (activeConfigData.merged.editing_language as string)
      : book?.languageCode ?? "en"

  const handleLanguageToggle = (code: string) => {
    const next = new Set(outputLanguages)
    if (next.has(code)) next.delete(code)
    else next.add(code)
    setOutputLanguages(next)
    persist({ output_languages: Array.from(next) })
  }

  const handleLanguageRemove = (code: string) => {
    const next = new Set(outputLanguages)
    next.delete(code)
    setOutputLanguages(next)
    persist({ output_languages: Array.from(next) })
  }

  const handleImageTranslationToggle = (next: boolean) => {
    setImageTranslationEnabled(next)
    const existing = (bookConfigData?.config?.image_translation ?? {}) as Record<
      string,
      unknown
    >
    persist({ image_translation: { ...existing, enabled: next } })
  }

  const handleRun = () => {
    if (!hasApiKey || !storyboardReady || status.isRunning) return
    queueRun({ fromStage: "translate", toStage: "translate", apiKey })
  }

  const hasLanguages = outputLanguages.size > 0

  const disabledReason = !hasApiKey ? (
    <Trans>Add an API key in Book settings to run translation.</Trans>
  ) : !storyboardReady ? (
    <Trans>Run Storyboard first — translation needs the typed sections placed by Storyboard.</Trans>
  ) : !hasLanguages ? (
    <Trans>Add at least one output language to run translation.</Trans>
  ) : undefined

  return (
    <LandingPageShell
      bookLabel={bookLabel}
      stageSlug="translate"
      settingsTab="general"
      colorClass="bg-pink-600 hover:bg-pink-700"
      accentColor="#db2777"
      accentColorSoft="#fce7f3"
      isRunning={status.isRunning}
      isCompleted={status.isCompleted}
      hasError={status.hasError}
      canRun={true}
      extraDisabled={!hasApiKey || !storyboardReady || !hasLanguages}
      disabledReason={disabledReason}
      runLabel={<Trans>Run Translation</Trans>}
      rerunLabel={<Trans>Re-run</Trans>}
      previewLabel={t`Translation Preview`}
      onRun={handleRun}
      preview={
        <LanguagePreview
          baseLanguage={baseLanguage}
          outputLanguages={Array.from(outputLanguages)}
          imageTranslationEnabled={imageTranslationEnabled}
        />
      }
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
          <Trans>Language</Trans>
        </h1>
        <p className="text-[14px] text-[#737373] leading-relaxed">
          <Trans>
            Translate the book into additional languages. Each language is
            generated alongside the original, ready for narration, captions,
            and on-page reading.
          </Trans>
        </p>
      </div>

      <PrereqGuard
        upstreamSlug="storyboard"
        stageSlug="translate"
        description={
          <Trans>
            Translation runs on the typed sections placed by Storyboard.
            Finish Storyboard before running this stage.
          </Trans>
        }
      />

      <SettingsCard>
        <SettingsField
          label={<Trans>Output Languages</Trans>}
          hint={
            <Trans>
              Pick the languages you want to translate to. The book's original
              language stays as-is.
            </Trans>
          }
        >
          <div className="flex flex-col gap-2.5">
            {outputLanguages.size > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {Array.from(outputLanguages).map((code) => (
                  <li key={code}>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-200 bg-pink-50 px-2.5 py-1 text-[12px] font-medium text-pink-700">
                      {displayLang(code)}
                      <button
                        type="button"
                        onClick={() => handleLanguageRemove(code)}
                        aria-label={t`Remove ${displayLang(code)}`}
                        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-pink-500 transition-colors hover:bg-pink-100 hover:text-pink-700"
                      >
                        <X className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <LanguagePicker
              selected={outputLanguages}
              onSelect={handleLanguageToggle}
              multiple
              label={t`Add language`}
            />
          </div>
        </SettingsField>
      </SettingsCard>

      <ImageTranslationToggle
        checked={imageTranslationEnabled}
        onCheckedChange={handleImageTranslationToggle}
      />
    </LandingPageShell>
  )
}

function ImageTranslationToggle({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: (next: boolean) => void
}) {
  const toggle = () => onCheckedChange(!checked)
  return (
    <div
      role="switch"
      id="language-image-translation"
      aria-checked={checked}
      aria-labelledby="language-image-translation-title"
      aria-describedby="language-image-translation-subtitle"
      tabIndex={0}
      className={cn(
        "flex w-full cursor-pointer select-none items-center justify-center gap-2.5 rounded-lg border px-4 py-3 shadow-sm transition-colors",
        "bg-white border-border hover:bg-muted hover:border-input",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault()
          toggle()
        }
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col items-start justify-center gap-0.5">
        <p
          id="language-image-translation-title"
          className="select-none text-sm font-semibold leading-5 text-foreground"
        >
          <Trans>Image Translations</Trans>
        </p>
        <p
          id="language-image-translation-subtitle"
          className="w-full select-none text-xs font-normal leading-4 text-muted-foreground"
        >
          <Trans>
            Translate text rendered inside images (signs, labels, callouts) so
            readers see the localized version.
          </Trans>
        </p>
      </div>
      <BrandedSwitch
        id="language-image-translation-switch"
        checked={checked}
        decorative
      />
    </div>
  )
}

function LanguagePreview({
  baseLanguage,
  outputLanguages,
  imageTranslationEnabled,
}: {
  baseLanguage: string
  outputLanguages: string[]
  imageTranslationEnabled: boolean
}) {
  return (
    <div className="relative flex flex-1 min-h-0 overflow-hidden bg-gradient-to-b from-pink-50/40 via-white to-white">
      <div className="flex w-full h-full flex-col gap-4 px-5 py-5 min-h-0">
        {/* Header */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Languages className="h-3.5 w-3.5 text-pink-700" strokeWidth={2} aria-hidden />
          <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-pink-700 leading-none">
            <Trans>Translation Plan</Trans>
          </span>
        </div>

        {/* Source language card */}
        <div className="flex shrink-0 items-center gap-3 rounded-lg border border-[#e5e5e5] bg-white px-3 py-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#f5f5f5] text-[#525252]">
            <Languages className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
              <Trans>Source</Trans>
            </span>
            <span className="text-[13px] font-semibold text-[#0a0a0a]">
              {displayLang(baseLanguage)}
            </span>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex shrink-0 justify-center">
          <ArrowRight className="h-3.5 w-3.5 text-pink-400 rotate-90" strokeWidth={2} aria-hidden />
        </div>

        {/* Output languages */}
        <div className="flex flex-1 min-h-0 flex-col gap-1.5 overflow-hidden">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-pink-700">
            <Trans>{outputLanguages.length} translations</Trans>
          </span>
          {outputLanguages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-pink-200 bg-white/60 px-3 py-6 text-center text-[11.5px] text-pink-700/70">
              <Trans>Add a language to see translations appear here.</Trans>
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {outputLanguages.map((code) => (
                <li
                  key={code}
                  className="flex items-center gap-2.5 rounded-lg border border-pink-100 bg-white px-3 py-2 shadow-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-pink-100 text-[10px] font-semibold uppercase text-pink-700">
                    {code.split("-")[0]}
                  </span>
                  <span className="flex-1 text-[13px] font-medium text-[#0a0a0a]">
                    {displayLang(code)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer: image translation flag */}
        <div
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-[10.5px] transition-colors",
            imageTranslationEnabled
              ? "bg-pink-50 text-pink-700"
              : "bg-[#f5f5f5] text-[#737373]",
          )}
        >
          <span
            className={cn(
              "inline-block h-1.5 w-1.5 rounded-full",
              imageTranslationEnabled ? "bg-pink-500" : "bg-[#a3a3a3]",
            )}
            aria-hidden
          />
          {imageTranslationEnabled ? (
            <Trans>Images will be translated</Trans>
          ) : (
            <Trans>Images stay in the source language</Trans>
          )}
        </div>
      </div>
    </div>
  )
}
