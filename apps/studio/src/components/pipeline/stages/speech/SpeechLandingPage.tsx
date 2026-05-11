import { useState, useEffect, useMemo } from "react"
import { AlertCircle, AudioLines, Mic2, Pencil, Play, Settings2 } from "lucide-react"
import { Link } from "@tanstack/react-router"
import { Trans, useLingui } from "@lingui/react/macro"
import { msg } from "@lingui/core/macro"
import { i18n as linguiI18n } from "@lingui/core"
import type { MessageDescriptor } from "@lingui/core"
import { LandingPageShell } from "@/components/pipeline/components/LandingPageShell"
import { PrereqGuard } from "@/components/pipeline/components/PrereqGuard"
import {
  SettingsCard,
  SettingsField,
} from "@/components/pipeline/components/SettingsCard"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { useActiveConfig } from "@/hooks/use-debug"
import { useStageStatus } from "@/hooks/use-stage-status"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { useBookConfig } from "@/hooks/use-book-config"
import { usePersistConfig } from "@/hooks/use-persist-config"
import { cn } from "@/lib/utils"

type ProviderKey = "openai" | "azure" | "gemini"

const PROVIDER_LABELS: Record<ProviderKey, MessageDescriptor> = {
  openai: msg`OpenAI`,
  azure: msg`Azure`,
  gemini: msg`Gemini`,
}

const PROVIDER_HINTS: Record<ProviderKey, MessageDescriptor> = {
  openai: msg`Natural, expressive voices. Best general-purpose default.`,
  azure: msg`Wide multilingual coverage with neural voices for many locales.`,
  gemini: msg`Google's voices with strong intonation for narrative content.`,
}

export function SpeechLandingPage({ bookLabel }: { bookLabel: string }) {
  const { t } = useLingui()
  const { data: bookConfigData } = useBookConfig(bookLabel)
  const { data: activeConfigData } = useActiveConfig(bookLabel)
  const persist = usePersistConfig(bookLabel)
  const { apiKey, hasApiKey, hasAzureKey, hasGeminiKey } = useApiKey()
  const { queueRun } = useBookRun()
  const status = useStageStatus("speech")
  const translateStatus = useStageStatus("translate")
  const translateReady = translateStatus.isCompleted

  const [wordHighlighting, setWordHighlighting] = useState(false)
  const [provider, setProvider] = useState<ProviderKey>("openai")

  useEffect(() => {
    if (!activeConfigData) return
    const m = activeConfigData.merged as Record<string, unknown>
    const speech = (m.speech ?? {}) as Record<string, unknown>
    if (typeof speech.word_highlighting === "boolean") {
      setWordHighlighting(speech.word_highlighting)
    }
    if (
      speech.default_provider === "openai" ||
      speech.default_provider === "azure" ||
      speech.default_provider === "gemini"
    ) {
      setProvider(speech.default_provider)
    }
  }, [activeConfigData])

  const persistSpeech = (patch: Record<string, unknown>) => {
    const existing = (bookConfigData?.config?.speech ?? {}) as Record<
      string,
      unknown
    >
    persist({ speech: { ...existing, ...patch } })
  }

  const handleHighlightingToggle = (next: boolean) => {
    setWordHighlighting(next)
    persistSpeech({ word_highlighting: next })
  }

  const handleProviderChange = (value: ProviderKey) => {
    setProvider(value)
    persistSpeech({ default_provider: value })
  }

  const handleRun = () => {
    if (!hasApiKey || !translateReady || status.isRunning) return
    queueRun({ fromStage: "speech", toStage: "speech", apiKey })
  }

  const providerKeyAvailable: Record<ProviderKey, boolean> = {
    openai: hasApiKey,
    azure: hasAzureKey,
    gemini: hasGeminiKey,
  }

  const providerOptions = useMemo(
    () => {
      const disabledHint = t`Add this provider's API key in Book settings.`
      return [
        {
          value: "openai" as const,
          label: linguiI18n._(PROVIDER_LABELS.openai),
          disabled: !hasApiKey,
          disabledHint,
        },
        {
          value: "azure" as const,
          label: linguiI18n._(PROVIDER_LABELS.azure),
          disabled: !hasAzureKey,
          disabledHint,
        },
        {
          value: "gemini" as const,
          label: linguiI18n._(PROVIDER_LABELS.gemini),
          disabled: !hasGeminiKey,
          disabledHint,
        },
      ]
    },
    [t, hasApiKey, hasAzureKey, hasGeminiKey],
  )

  const selectedProviderKeyMissing = !providerKeyAvailable[provider]

  const disabledProviderLabels = useMemo(
    () =>
      providerOptions
        .filter((o) => o.disabled)
        .map((o) => o.label),
    [providerOptions],
  )

  const disabledProvidersText = useMemo(() => {
    if (disabledProviderLabels.length === 0) return ""
    const formatter = new Intl.ListFormat(linguiI18n.locale ?? "en", {
      style: "long",
      type: "conjunction",
    })
    return formatter.format(disabledProviderLabels)
  }, [disabledProviderLabels])

  const highlightingOptions = useMemo(
    () => [
      { value: "sentence" as const, label: t`Per-Sentence` },
      { value: "word" as const, label: t`Per-Word` },
    ],
    [t],
  )

  const disabledReason = !hasApiKey ? (
    <Trans>Add an API key in Book settings to run speech.</Trans>
  ) : selectedProviderKeyMissing ? (
    <Trans>Add the selected provider's API key in Book settings to run speech.</Trans>
  ) : !translateReady ? (
    <Trans>Run Language first — speech narrates the translated text.</Trans>
  ) : undefined

  return (
    <LandingPageShell
      bookLabel={bookLabel}
      stageSlug="speech"
      settingsTab="general"
      colorClass="bg-rose-600 hover:bg-rose-700"
      accentColor="#e11d48"
      accentColorSoft="#ffe4e6"
      isRunning={status.isRunning}
      isCompleted={status.isCompleted}
      hasError={status.hasError}
      canRun={true}
      extraDisabled={!hasApiKey || selectedProviderKeyMissing || !translateReady}
      disabledReason={disabledReason}
      runLabel={<Trans>Run Speech</Trans>}
      rerunLabel={<Trans>Re-run</Trans>}
      previewLabel={t`Speech Preview`}
      onRun={handleRun}
      preview={<SpeechPreview wordHighlighting={wordHighlighting} />}
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
          <Trans>Speech</Trans>
        </h1>
        <p className="text-[14px] text-[#737373] leading-relaxed">
          <Trans>
            Generate audio narration for every page of the book. Pick a
            provider and choose whether to highlight each word as it's read
            aloud.
          </Trans>
        </p>
      </div>

      <PrereqGuard
        upstreamSlug="translate"
        stageSlug="speech"
        description={
          <Trans>
            Speech narrates the translated text Language produces. Finish
            Language before running this stage.
          </Trans>
        }
      />

      <SettingsCard>
        <SettingsField
          label={<Trans>Provider</Trans>}
          hint={
            selectedProviderKeyMissing ? (
              <Trans>
                No API key for {linguiI18n._(PROVIDER_LABELS[provider])} yet.
                Add one in Book settings to enable this provider.
              </Trans>
            ) : (
              linguiI18n._(PROVIDER_HINTS[provider])
            )
          }
        >
          <div className="flex flex-col gap-2">
            <SegmentedControl
              options={providerOptions}
              value={provider}
              onValueChange={handleProviderChange}
            />
            {disabledProviderLabels.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
                <AlertCircle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600"
                  strokeWidth={2}
                  aria-hidden
                />
                <span>
                  {disabledProviderLabels.length === 1 ? (
                    <Trans>
                      {disabledProvidersText} is disabled — add its API key in
                      Book settings to enable it.
                    </Trans>
                  ) : (
                    <Trans>
                      {disabledProvidersText} are disabled — add their API keys
                      in Book settings to enable them.
                    </Trans>
                  )}
                </span>
              </div>
            )}
          </div>
        </SettingsField>
      </SettingsCard>

      <SettingsCard>
        <SettingsField
          label={<Trans>Reader Highlighting</Trans>}
          hint={
            wordHighlighting ? (
              <Trans>
                Highlights each word as it's narrated. Adds a transcription
                step so audio aligns with text on the page.
              </Trans>
            ) : (
              <Trans>
                Highlights the active sentence while audio plays. Skips the
                per-word transcription step.
              </Trans>
            )
          }
        >
          <SegmentedControl
            options={highlightingOptions}
            value={wordHighlighting ? "word" : "sentence"}
            onValueChange={(value) =>
              handleHighlightingToggle(value === "word")
            }
          />
        </SettingsField>
      </SettingsCard>

      <SettingsCard>
        <SettingsField
          label={<Trans>Voices &amp; Accents</Trans>}
          hint={
            <Trans>
              Pick which voice each language uses for narration, including
              regional accents.
            </Trans>
          }
        >
          <Link
            to="/books/$label/$step/settings"
            params={{ label: bookLabel, step: "speech" }}
            search={{ tab: "general" }}
            className="group flex w-full items-center gap-3 rounded-md border border-[#e5e5e5] bg-white px-3 py-2.5 text-left transition-colors hover:border-[#d4d4d4] hover:bg-[#fafafa] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-ring/40"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-rose-100 text-rose-700">
              <Settings2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </span>
            <span className="flex-1 text-[13px] font-medium text-[#0a0a0a]">
              <Trans>Configure voices and accents</Trans>
            </span>
            <Pencil
              className="h-3.5 w-3.5 text-[#a3a3a3] transition-colors group-hover:text-[#525252]"
              strokeWidth={2}
              aria-hidden
            />
          </Link>
        </SettingsField>
      </SettingsCard>
    </LandingPageShell>
  )
}

function SpeechPreview({ wordHighlighting }: { wordHighlighting: boolean }) {
  /* eslint-disable lingui/no-unlocalized-strings -- sample preview text, illustrative only */
  const sentences: string[][] = [
    ["Lorem", "ipsum", "dolor", "sit", "amet,", "consectetur", "adipiscing", "elit."],
    ["Sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore."],
  ]
  /* eslint-enable lingui/no-unlocalized-strings */
  const activeSentence = 0
  const activeWord = 3

  return (
    <div className="relative flex flex-1 min-h-0 overflow-hidden bg-gradient-to-b from-rose-50/40 via-white to-white">
      <div className="flex w-full h-full flex-col gap-4 px-5 py-5 min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <Mic2 className="h-3.5 w-3.5 text-rose-700" strokeWidth={2} aria-hidden />
            <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-rose-700 leading-none">
              <Trans>Audio Player</Trans>
            </span>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-rose-500/80 leading-none">
            <Trans>Sample</Trans>
          </span>
        </div>

        {/* Narrated text */}
        <div className="flex-1 min-h-0 overflow-hidden rounded-lg border border-rose-100 bg-white p-4 shadow-sm flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <Play
              className="h-2.5 w-2.5 text-rose-500"
              strokeWidth={2}
              fill="none"
              aria-hidden
            />
            <span className="text-[9px] font-semibold tracking-[0.18em] uppercase text-rose-600 leading-none">
              {wordHighlighting ? (
                <Trans>Preview: Per-Word</Trans>
              ) : (
                <Trans>Preview: Per-Sentence</Trans>
              )}
            </span>
          </div>
          <p className="text-[13px] leading-[1.9] text-[#525252]">
            {sentences.map((sentenceWords, sIdx) => {
              const sentenceIsActive = sIdx === activeSentence
              const sentenceIsPast = sIdx < activeSentence
              return (
                <span key={sIdx}>
                  <span
                    className={cn(
                      "transition-colors duration-200",
                      !wordHighlighting && sentenceIsActive &&
                        "rounded-md px-1.5 py-0.5 ring-1 ring-rose-400 text-[#0a0a0a]",
                      !wordHighlighting && sentenceIsPast && "text-[#0a0a0a]",
                    )}
                  >
                    {sentenceWords.map((w, wIdx) => {
                      const wordIsActive =
                        wordHighlighting && sentenceIsActive && wIdx === activeWord
                      const wordIsPast =
                        wordHighlighting &&
                        (sentenceIsPast ||
                          (sentenceIsActive && wIdx < activeWord))
                      return (
                        <span key={wIdx}>
                          <span
                            className={cn(
                              "transition-colors duration-200",
                              wordIsActive &&
                                "rounded-sm bg-rose-200/70 px-0.5 font-semibold text-rose-900",
                              wordIsPast && "text-[#0a0a0a]",
                            )}
                          >
                            {w}
                          </span>
                          {wIdx < sentenceWords.length - 1 && " "}
                        </span>
                      )
                    })}
                  </span>
                  {sIdx < sentences.length - 1 && " "}
                </span>
              )
            })}
          </p>
        </div>

        {/* Audio control strip */}
        <div className="flex shrink-0 items-center gap-3 rounded-lg border border-[#e5e5e5] bg-white px-3 py-2.5 shadow-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-white">
            <Play className="h-3.5 w-3.5 ml-0.5" strokeWidth={2.5} aria-hidden />
          </span>
          <div className="flex flex-1 flex-col gap-1">
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-rose-100">
              <span
                className="absolute left-0 top-0 h-full rounded-full bg-rose-600"
                style={{ width: "38%" }}
              />
            </div>
            <div className="flex items-center justify-between text-[9px] font-medium tabular-nums text-[#737373]">
              <span>0:18</span>
              <span>0:47</span>
            </div>
          </div>
          <AudioLines
            className="h-4 w-4 text-rose-400 motion-safe:animate-pulse"
            strokeWidth={2}
            aria-hidden
          />
        </div>

      </div>
    </div>
  )
}
