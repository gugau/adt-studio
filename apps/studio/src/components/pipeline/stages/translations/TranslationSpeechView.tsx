import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Check, ChevronDown, Languages, Loader2, Volume2, Play, Pause, WandSparkles, Trash2, Settings, RefreshCw } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { api, getAudioUrl, BASE_URL } from "@/api/client"
import type { TextCatalogEntry, VersionEntry } from "@/api/client"
import { useActiveConfig } from "@/hooks/use-debug"
import { useBook } from "@/hooks/use-books"
import { useStepHeader } from "../../components/StepViewRouter"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { StageRunCard } from "../../components/StageRunCard"
import { useVirtualizer } from "@tanstack/react-virtual"
import { cn } from "@/lib/utils"
import { normalizeLocale } from "@/lib/languages"
import { languageUsesSpeechProvider } from "@/lib/speech-routing"
import { resolveTranslationLanguageState } from "./lib/translations-view-state"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { getCacheResourcesForStageClear } from "@adt/types"
import type { StageName } from "@adt/types"
import { msg } from "@lingui/core/macro"
import { useLingui } from "@lingui/react/macro"

const IMAGE_ID_RE = /_im\d{3}/
function isImageEntry(id: string): boolean {
  return IMAGE_ID_RE.test(id)
}

const ANSWER_ID_RE = /_ans_/
function isAnswerEntry(id: string): boolean {
  return ANSWER_ID_RE.test(id)
}

type CatalogFilter = "all" | "text" | "captions" | "activities" | "answers" | "glossary" | "quizzes"

function getEntryType(id: string): CatalogFilter {
  if (id.startsWith("gl")) return "glossary"
  if (id.startsWith("qz")) return "quizzes"
  if (ANSWER_ID_RE.test(id)) return "answers"
  if (IMAGE_ID_RE.test(id)) return "captions"
  if (/_ac\d{3}/.test(id)) return "activities"
  return "text"
}

const langNames = new Intl.DisplayNames(["en"], { type: "language" })
function displayLang(code: string): string {
  try { return langNames.of(code) ?? code } catch { return code }
}

function LanguageSummary({ bookLanguage, outputLanguages }: { bookLanguage: string | null; outputLanguages: string[] }) {
  const { t } = useLingui()
  return (
    <>
      <div>
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{t`Book Language`}</div>
        <p className="text-sm">
          {bookLanguage ? (
            <>{displayLang(bookLanguage)} <span className="text-muted-foreground text-xs">({bookLanguage})</span></>
          ) : (
            <span className="text-muted-foreground italic">{t`Not detected`}</span>
          )}
        </p>
      </div>
      <div>
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">{t`Output Languages`}</div>
        {outputLanguages.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {outputLanguages.map((lang) => (
              <span key={lang} className="text-xs bg-muted rounded-full px-2.5 py-0.5 font-medium">
                {displayLang(lang)} <span className="text-muted-foreground font-normal">({lang})</span>
              </span>
            ))}
          </div>
        ) : bookLanguage ? (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs bg-muted rounded-full px-2.5 py-0.5 font-medium">
              {displayLang(bookLanguage)} <span className="text-muted-foreground font-normal">({bookLanguage})</span>
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">{t`Not detected`}</p>
        )}
      </div>
    </>
  )
}

function VersionPicker({
  currentVersion,
  saving,
  dirty,
  bookLabel,
  language,
  onPreview,
  onSave,
  onDiscard,
}: {
  currentVersion: number | null
  saving: boolean
  dirty: boolean
  bookLabel: string
  language: string
  onPreview: (data: unknown) => void
  onSave: () => void
  onDiscard: () => void
}) {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  const [versions, setVersions] = useState<VersionEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const handleOpen = async () => {
    if (saving || currentVersion == null) return
    setOpen(true)
    setLoading(true)
    const res = await api.getVersionHistory(bookLabel, "text-catalog-translation", language, true)
    setVersions(res.versions)
    setLoading(false)
  }

  const handlePick = (v: VersionEntry) => {
    if (v.version === currentVersion && !dirty) { setOpen(false); return }
    setOpen(false)
    onPreview(v.data)
  }

  if (saving) return <Loader2 className="h-3 w-3 animate-spin" />
  if (currentVersion == null) return null

  if (dirty) {
    return (
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={onDiscard}
          className="text-[10px] font-medium rounded px-2 py-0.5 bg-black/15 text-black hover:bg-black/25 cursor-pointer transition-colors">
          {t`Discard`}
        </button>
        <button type="button" onClick={onSave}
          className="flex items-center gap-1 text-[10px] font-medium rounded px-2 py-0.5 bg-white text-green-800 hover:bg-white/80 cursor-pointer transition-colors">
          <Check className="h-3 w-3" />
          {t`Save`}
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={handleOpen}
        className="flex items-center gap-0.5 text-[10px] font-normal normal-case tracking-normal bg-white/20 text-white hover:bg-white/30 rounded px-1.5 py-0.5 transition-colors">
        v{currentVersion}
        <ChevronDown className="h-2.5 w-2.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-popover border rounded shadow-md min-w-[80px] py-1">
          {loading ? (
            <div className="flex items-center justify-center py-2 px-3">
              <Loader2 className="h-3 w-3 animate-spin" />
            </div>
          ) : versions && versions.length > 0 ? (
            versions.map((v) => (
              <button key={v.version} type="button" onClick={() => handlePick(v)}
                className={`w-full text-left px-3 py-1 text-xs hover:bg-accent transition-colors ${
                  v.version === currentVersion ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}>
                v{v.version}
              </button>
            ))
          ) : (
            <div className="px-3 py-1 text-xs text-muted-foreground">{t`No versions`}</div>
          )}
        </div>
      )}
    </div>
  )
}

export function TranslationSpeechView({ bookLabel, selectedPageId, onSelectPage }: { bookLabel: string; selectedPageId?: string; onSelectPage?: (pageId: string | null) => void }) {
  const { t, i18n } = useLingui()
  const { setExtra } = useStepHeader()
  const { data: activeConfigData } = useActiveConfig(bookLabel)
  const { data: book, isLoading: isBookLoading } = useBook(bookLabel)
  const queryClient = useQueryClient()
  const { stageState, queueRun, error: runError } = useBookRun()
  const { apiKey, hasApiKey, azureKey, azureRegion, geminiKey } = useApiKey()

  // === Translation state ===
  const translationState = stageState("translation")
  const translationDone = translationState === "done"
  const isTranslationRunning = translationState === "running" || translationState === "queued"

  // === Speech state ===
  const speechState = stageState("speech")
  const speechDone = speechState === "done"
  const hasSpeechError = speechState === "error"
  const isSpeechRunning = speechState === "running" || speechState === "queued"

  const handleRunTranslations = useCallback(() => {
    if (!hasApiKey || isTranslationRunning) return
    queueRun({
      fromStage: "translation",
      toStage: "translation",
      apiKey,
      providerCredentials: {
        azure: { key: azureKey, region: azureRegion },
        geminiApiKey: geminiKey,
      },
    })
  }, [hasApiKey, isTranslationRunning, apiKey, azureKey, azureRegion, geminiKey, queueRun])

  const handleRunSpeech = useCallback(() => {
    if (!hasApiKey || isSpeechRunning) return
    queueRun({
      fromStage: "speech",
      toStage: "speech",
      apiKey,
      providerCredentials: {
        azure: { key: azureKey, region: azureRegion },
        geminiApiKey: geminiKey,
      },
    })
  }, [hasApiKey, isSpeechRunning, apiKey, azureKey, azureRegion, geminiKey, queueRun])

  const handleRunTranslationAndSpeech = useCallback(() => {
    if (!hasApiKey || isTranslationRunning) return
    queueRun({
      fromStage: "translation",
      toStage: "speech",
      apiKey,
      providerCredentials: {
        azure: { key: azureKey, region: azureRegion },
        geminiApiKey: geminiKey,
      },
    })
  }, [hasApiKey, isTranslationRunning, apiKey, azureKey, azureRegion, geminiKey, queueRun])

  // === Queries ===
  const { data: catalog, isLoading } = useQuery({
    queryKey: ["books", bookLabel, "text-catalog"],
    queryFn: () => api.getTextCatalog(bookLabel),
    enabled: !!bookLabel,
  })

  const { data: ttsData } = useQuery({
    queryKey: ["books", bookLabel, "tts"],
    queryFn: () => api.getTTS(bookLabel),
    enabled: !!bookLabel && (speechDone || hasSpeechError),
  })

  const { data: voiceMappings } = useQuery({
    queryKey: ["voice-mappings"],
    queryFn: () => api.getVoiceMappings(),
  })

  // === Config ===
  const merged = activeConfigData?.merged as Record<string, unknown> | undefined
  const speechConfig = merged?.speech
  const outputLanguages = Array.from(
    new Set(((merged?.output_languages as string[] | undefined) ?? []).map((code) => normalizeLocale(code)))
  )
  const bookLanguage = book?.languageCode ?? book?.metadata?.language_code ?? null
  const configuredEditingLanguage = merged?.editing_language as string | undefined
  const hasExplicitOutputLanguages = outputLanguages.length > 0

  // === Language selection ===
  const [selectedLang, setSelectedLang] = useState<string | null>(null)
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>("all")

  useEffect(() => {
    if (hasExplicitOutputLanguages && outputLanguages.length > 0 && !selectedLang) {
      setSelectedLang(outputLanguages[0])
    }
  }, [outputLanguages.length, hasExplicitOutputLanguages])

  const entries = catalog?.entries ?? []
  const filteredByPage = selectedPageId
    ? entries.filter((e) => e.id.startsWith(selectedPageId + "_"))
    : entries
  const displayEntries = catalogFilter === "all"
    ? filteredByPage
    : filteredByPage.filter((e) => getEntryType(e.id) === catalogFilter)

  // Count entries per type for filter badges
  const typeCounts = useMemo(() => {
    const counts: Record<CatalogFilter, number> = { all: 0, text: 0, captions: 0, activities: 0, answers: 0, glossary: 0, quizzes: 0 }
    for (const e of filteredByPage) {
      counts[getEntryType(e.id)]++
      counts.all++
    }
    return counts
  }, [filteredByPage])

  const { editingLanguage, isSourceLang: isSelectedSourceLang, isSourceLanguagePending } = resolveTranslationLanguageState({
    selectedLang,
    configuredEditingLanguage,
    bookLanguage,
    isBookLoading,
  })
  const isSourceLang = !hasExplicitOutputLanguages || isSelectedSourceLang

  // === Translation editing ===
  const [pendingEntries, setPendingEntries] = useState<TextCatalogEntry[] | null>(null)
  const [saving, setSaving] = useState(false)

  const translationData = selectedLang ? catalog?.translations?.[selectedLang] : undefined
  const translatedEntries = isSourceLang ? entries : (translationData?.entries ?? [])
  const translationVersion = isSourceLang ? (catalog?.version ?? null) : (translationData?.version ?? null)

  useEffect(() => { setPendingEntries(null) }, [translationVersion, selectedLang])

  const effectiveEntries = pendingEntries ?? translatedEntries
  const translatedMap = new Map(effectiveEntries.map((e) => [e.id, e.text]))
  const dirty = pendingEntries != null

  const saveTranslation = useCallback(async () => {
    if (!pendingEntries || !selectedLang) return
    setSaving(true)
    const minDelay = new Promise((r) => setTimeout(r, 400))
    await api.updateTranslation(bookLabel, selectedLang, { entries: pendingEntries })
    setPendingEntries(null)
    await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "text-catalog"] })
    await minDelay
    setSaving(false)
  }, [pendingEntries, selectedLang, bookLabel, queryClient])

  const saveRef = useRef(saveTranslation)
  saveRef.current = saveTranslation

  const updateEntry = (entryId: string, newText: string) => {
    const base = pendingEntries ?? translatedEntries
    const exists = base.some((e) => e.id === entryId)
    if (exists) {
      setPendingEntries(base.map((e) => (e.id === entryId ? { ...e, text: newText } : e)))
    } else {
      setPendingEntries([...base, { id: entryId, text: newText }])
    }
  }

  // === Speech / Audio ===
  const [generateErrorById, setGenerateErrorById] = useState<Record<string, string>>({})

  const audioLang = selectedLang ??
    (hasExplicitOutputLanguages ? (outputLanguages[0] ?? editingLanguage) : editingLanguage)
  const currentLanguageUsesGemini =
    !!audioLang && languageUsesSpeechProvider(audioLang, "gemini", speechConfig)
  const geminiRoutedLanguages = (
    outputLanguages.length > 0 ? outputLanguages : editingLanguage ? [editingLanguage] : []
  ).filter((language, index, array) =>
    languageUsesSpeechProvider(language, "gemini", speechConfig) && array.indexOf(language) === index
  )
  const allowGeminiPartialView = hasSpeechError && geminiRoutedLanguages.length > 0

  const audioMap = new Map<string, { fileName: string; voice: string }>()
  if (ttsData && audioLang && ttsData.languages[audioLang]) {
    for (const e of ttsData.languages[audioLang].entries) {
      audioMap.set(e.textId, { fileName: e.fileName, voice: e.voice })
    }
  }
  const totalAudioFiles = ttsData
    ? Object.values(ttsData.languages).reduce((sum, lang) => sum + lang.entries.length, 0)
    : 0
  const generatedAudioCount = displayEntries.filter((entry) => audioMap.has(entry.id)).length
  const missingAudioCount = Math.max(displayEntries.length - generatedAudioCount, 0)

  const generateAudioMutation = useMutation({
    mutationFn: async (variables: { textId: string; language: string }) => {
      if (!geminiKey) throw new Error(i18n._(msg`Gemini API key is required to generate audio.`))
      return api.generateGeminiTTSForItem(bookLabel, variables.textId, variables.language, {
        geminiApiKey: geminiKey,
        openaiApiKey: apiKey || undefined,
        azure: azureKey && azureRegion ? { key: azureKey, region: azureRegion } : undefined,
      })
    },
    onMutate: (variables) => {
      setGenerateErrorById((prev) => {
        if (!(variables.textId in prev)) return prev
        const next = { ...prev }
        delete next[variables.textId]
        return next
      })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "tts"] }),
        queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "step-status"] }),
      ])
    },
    onError: (error, variables) => {
      setGenerateErrorById((prev) => ({
        ...prev,
        [variables.textId]: error instanceof Error ? error.message : String(error),
      }))
      queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "step-status"] })
    },
  })

  const handleGenerateAudio = useCallback(
    (textId: string) => {
      if (!audioLang || !currentLanguageUsesGemini) return
      generateAudioMutation.mutate({ textId, language: audioLang })
    },
    [audioLang, currentLanguageUsesGemini, generateAudioMutation]
  )

  const clearSpeechMutation = useMutation({
    mutationFn: () => api.clearStage(bookLabel, "speech"),
    onSuccess: async () => {
      const resources = getCacheResourcesForStageClear("speech" as StageName)
      await Promise.all(
        resources.map((r) => queryClient.invalidateQueries({ queryKey: ["books", bookLabel, r] }))
      )
      setGenerateErrorById({})
    },
  })

  // === Display logic ===
  const showTranslationRunCard = !translationDone || isTranslationRunning
  const showSpeechSection = translationDone && !showTranslationRunCard
  const showSpeechRunBanner = showSpeechSection && (!speechDone || isSpeechRunning) && !allowGeminiPartialView
  const showAudioControls = speechDone || allowGeminiPartialView

  // === Virtualizer ===
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: displayEntries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 60,
    overscan: 5,
  })

  // Reset scroll position when filters or language change to avoid stale virtualizer measurements
  useEffect(() => {
    virtualizer.scrollToOffset(0)
  }, [catalogFilter, selectedLang, selectedPageId])

  // === Header extras ===
  useEffect(() => {
    if (!catalog) return
    setExtra(
      <div className="flex items-center gap-1.5 ml-auto">
        <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5">{t`${String(displayEntries.length)} texts`}</span>
        {outputLanguages.length > 1 && (
          <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5">{t`${String(outputLanguages.length)} languages`}</span>
        )}
        {showAudioControls && currentLanguageUsesGemini ? (
          <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5">
            {t`${String(generatedAudioCount)}/${String(displayEntries.length)} audio`}
          </span>
        ) : showAudioControls && totalAudioFiles > 0 ? (
          <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5">{t`${String(totalAudioFiles)} audio`}</span>
        ) : null}
        {showAudioControls && currentLanguageUsesGemini && missingAudioCount > 0 && (
          <span className="text-[10px] bg-amber-100 text-amber-900 rounded-full px-2 py-0.5">
            {t`${missingAudioCount} missing`}
          </span>
        )}
        {selectedLang && translationVersion != null && !isSourceLang && (
          <VersionPicker
            currentVersion={translationVersion}
            saving={saving}
            dirty={dirty}
            bookLabel={bookLabel}
            language={selectedLang}
            onPreview={(d) => {
              const data = d as { entries?: TextCatalogEntry[] }
              setPendingEntries(data?.entries ?? [])
            }}
            onSave={() => saveRef.current()}
            onDiscard={() => setPendingEntries(null)}
          />
        )}
      </div>
    )
    return () => setExtra(null)
  }, [catalog, t, displayEntries.length, outputLanguages.length, selectedLang, translationVersion, saving, dirty, bookLabel, isSourceLang, selectedPageId, showAudioControls, totalAudioFiles, currentLanguageUsesGemini, generatedAudioCount, missingAudioCount])

  // === Speech config details ===
  const speechCfg = speechConfig as { default_provider?: string; voice?: string; model?: string } | undefined
  const defaultProvider = speechCfg?.default_provider ?? "openai"
  const defaultVoice = speechCfg?.voice ?? "alloy"
  const defaultModel = speechCfg?.model ?? (defaultProvider === "openai" ? "gpt-4o-mini-tts" : undefined)
  const providerLabel = defaultProvider.charAt(0).toUpperCase() + defaultProvider.slice(1)

  // === Early returns ===

  if (!showTranslationRunCard && isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span className="text-sm">{t`Loading text catalog...`}</span>
      </div>
    )
  }

  // Translation running — show progress card
  if (isTranslationRunning) {
    return (
      <div className="p-4">
        <StageRunCard
          stageSlug="translation"
          isRunning={true}
          onRun={handleRunTranslations}
          disabled={true}
        />
      </div>
    )
  }

  // Translation idle — show info cards for both stages
  if (!translationDone || !catalog || entries.length === 0) {
    const resolvedBookLang = editingLanguage || bookLanguage
    return (
      <div className="p-4 space-y-4">
        {/* Translation Card */}
        <Card className="overflow-hidden max-w-xl shadow-none border-pink-600">
          <CardHeader className="flex-row items-center gap-2.5 space-y-0 px-4 py-2 text-white bg-pink-600">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20">
              <Languages className="w-3 h-3" />
            </div>
            <CardTitle className="text-sm leading-normal tracking-normal">{t`Translation`} <span className="font-normal text-white/60">({t`optional`})</span></CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-4 space-y-3">
            <LanguageSummary
              bookLanguage={resolvedBookLang}
              outputLanguages={outputLanguages}
            />
            <div className="flex items-center gap-3 pt-1">
              <Link
                to="/books/$label/$step/settings"
                params={{ label: bookLabel, step: "translation" }}
                search={{ tab: "general" }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-pink-600 hover:text-pink-700 transition-colors"
              >
                <Settings className="w-3 h-3" />
                {t`Add Translations`}
              </Link>
              <div className="flex-1" />
              <Button
                size="sm"
                className="h-8 bg-pink-600 hover:bg-pink-700 text-white text-xs"
                onClick={handleRunTranslations}
                disabled={!hasApiKey}
              >
                <Play className="mr-1 h-3 w-3" />
                {translationState === "error" ? t`Retry Translation` : t`Run Translation`}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Speech Card */}
        <Card className="overflow-hidden max-w-xl shadow-none border-rose-600">
          <CardHeader className="flex-row items-center gap-2.5 space-y-0 px-4 py-2 text-white bg-rose-600">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20">
              <Volume2 className="w-3 h-3" />
            </div>
            <CardTitle className="text-sm leading-normal tracking-normal">{t`Speech`} <span className="font-normal text-white/60">({t`optional`})</span></CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-4 space-y-3">
            <div>
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">{t`Voice`}</div>
              <p className="text-sm font-medium">{providerLabel} <span className="font-normal text-muted-foreground">·</span> {defaultVoice}</p>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Link
                to="/books/$label/$step/settings"
                params={{ label: bookLabel, step: "translation" }}
                search={{ tab: "speech" }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 transition-colors"
              >
                <Settings className="w-3 h-3" />
                {t`Choose Provider`}
              </Link>
              <div className="flex-1" />
              <Button
                size="sm"
                className="h-8 bg-rose-600 hover:bg-rose-700 text-white text-xs"
                onClick={handleRunTranslationAndSpeech}
                disabled={!hasApiKey}
              >
                <Play className="mr-1 h-3 w-3" />
                {t`Run Speech`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const showAllButton = selectedPageId ? (
    <div className="flex justify-center pt-2 pb-4">
      <button
        type="button"
        onClick={() => onSelectPage?.(null)}
        className="text-xs font-medium text-pink-600 hover:text-pink-700 hover:underline transition-colors"
      >
        {t`Show all translations`}
      </button>
    </div>
  ) : null

  return (
    <div className="flex flex-col h-full">
      {/* Fixed header area */}
      <div className="shrink-0 px-4 pt-4 space-y-3">
        {/* Gemini partial-view error alert */}
        {allowGeminiPartialView && runError && (
          <Alert variant="destructive" className="rounded-md">
            <AlertDescription className="text-xs whitespace-pre-wrap break-words">
              {runError}
            </AlertDescription>
          </Alert>
        )}

        {/* Language tabs */}
        {outputLanguages.length > 1 && (
          <div className="flex gap-1.5">
            {outputLanguages.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setSelectedLang(lang)}
                className={cn(
                  "text-xs h-7 px-3 rounded-md font-medium transition-colors cursor-pointer",
                  selectedLang === lang
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                {displayLang(lang)}
                <span className={cn(
                  "ml-1 text-[10px]",
                  selectedLang === lang ? "opacity-60" : "opacity-50"
                )}>
                  ({lang})
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Catalog type filters */}
        {filteredByPage.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {([
              ["all", t`All`],
              ["text", t`Text`],
              ["captions", t`Captions`],
              ["activities", t`Activities`],
              ["answers", t`Answers`],
              ["glossary", t`Glossary`],
              ["quizzes", t`Quizzes`],
            ] as const).map(([key, label]) => {
              const count = typeCounts[key]
              if (key !== "all" && count === 0) return null
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCatalogFilter(key)}
                  className={cn(
                    "text-[11px] h-6 px-2.5 rounded-full font-medium transition-colors cursor-pointer",
                    catalogFilter === key
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  )}
                >
                  {label}
                  <span className={cn(
                    "ml-1 text-[10px]",
                    catalogFilter === key ? "opacity-60" : "opacity-50"
                  )}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Translation & Speech control panels */}
        <div className="grid grid-cols-2 gap-3">
          {/* Translation panel */}
          <div className="rounded-lg border border-pink-200 bg-pink-50/30 px-4 py-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <Languages className="w-3.5 h-3.5 text-pink-500 shrink-0" />
              <p className="flex-1 text-xs font-medium text-pink-900">{t`Translation`}</p>
              {isTranslationRunning ? (
                <Loader2 className="w-4 h-4 animate-spin text-pink-500 shrink-0" />
              ) : (
                <button
                  type="button"
                  onClick={handleRunTranslations}
                  disabled={!hasApiKey}
                  className="flex items-center justify-center w-6 h-6 rounded text-pink-600 hover:bg-pink-100 transition-colors cursor-pointer disabled:opacity-50"
                  title={t`Rerun translation`}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="text-[11px] text-pink-800/70">
              {bookLanguage && <span>{displayLang(bookLanguage)}</span>}
              {outputLanguages.length > 0 && (
                <span>
                  {bookLanguage && <span className="text-pink-300"> → </span>}
                  {outputLanguages.map((l) => displayLang(l)).join(", ")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/books/$label/$step/settings"
                params={{ label: bookLabel, step: "translation" }}
                search={{ tab: "general" }}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-pink-600 hover:text-pink-700 transition-colors"
              >
                <Settings className="w-2.5 h-2.5" />
                {t`Add Translations`}
              </Link>
              <Link
                to="/books/$label/$step/settings"
                params={{ label: bookLabel, step: "translation" }}
                search={{ tab: "prompt" }}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-pink-600 hover:text-pink-700 transition-colors"
              >
                <Settings className="w-2.5 h-2.5" />
                {t`Prompt`}
              </Link>
            </div>
          </div>

          {/* Speech panel */}
          <div className={cn(
            "rounded-lg border px-4 py-2.5 space-y-2",
            showAudioControls && !showSpeechRunBanner
              ? "border-rose-200 bg-rose-50/30"
              : "border-rose-200 bg-rose-50/50"
          )}>
            <div className="flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <p className="flex-1 text-xs font-medium text-rose-900">
                {t`Speech`}
                {showAudioControls && !showSpeechRunBanner && (
                  <span className="font-normal text-rose-600 ml-1.5">
                    {currentLanguageUsesGemini
                      ? t`${String(generatedAudioCount)}/${String(displayEntries.length)}`
                      : t`${String(totalAudioFiles)} files`}
                  </span>
                )}
              </p>
              {isSpeechRunning ? (
                <Loader2 className="w-4 h-4 animate-spin text-rose-500 shrink-0" />
              ) : showAudioControls && !showSpeechRunBanner ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleRunSpeech}
                    disabled={!hasApiKey}
                    className="flex items-center justify-center w-6 h-6 rounded text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer disabled:opacity-50"
                    title={t`Regenerate speech`}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => clearSpeechMutation.mutate()}
                    disabled={clearSpeechMutation.isPending}
                    className="flex items-center justify-center w-6 h-6 rounded text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer disabled:opacity-50"
                    title={t`Clear speech data`}
                  >
                    {clearSpeechMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              ) : (
                <Button
                  size="sm"
                  className="h-6 px-2 bg-rose-600 hover:bg-rose-700 text-white text-[10px] shrink-0"
                  onClick={handleRunSpeech}
                  disabled={!hasApiKey}
                >
                  <Play className="mr-1 h-2.5 w-2.5" />
                  {speechState === "error" ? t`Retry` : t`Run Speech`}
                </Button>
              )}
            </div>
            <div className="text-[11px] text-rose-800/70">
              {providerLabel} <span className="text-rose-300">·</span> {defaultVoice}
              {defaultModel && <>{" "}<span className="text-rose-300">·</span> {defaultModel}</>}
            </div>
            <Link
              to="/books/$label/$step/settings"
              params={{ label: bookLabel, step: "translation" }}
              search={{ tab: "speech" }}
              className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-600 hover:text-rose-700 transition-colors"
            >
              <Settings className="w-2.5 h-2.5" />
              {t`Choose Provider`}
            </Link>
          </div>
        </div>

        {/* Column headers for translation mode */}
        {!isSourceLang && !isSourceLanguagePending && displayEntries.length > 0 && (
          <div className="flex px-3 py-1.5">
            <div className="grid grid-cols-2 gap-3 flex-1 min-w-0">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {displayLang(editingLanguage)}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {selectedLang ? displayLang(selectedLang) : selectedLang}
              </span>
            </div>
            {showAudioControls && <div className="shrink-0 w-28 ml-3" />}
          </div>
        )}
      </div>

      {/* Entries */}
      {isSourceLanguagePending ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          <span className="text-sm">{t`Resolving source language...`}</span>
        </div>
      ) : selectedPageId && displayEntries.length === 0 && entries.length > 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <div className="w-12 h-12 rounded-full bg-pink-50 flex items-center justify-center mb-3">
            <Languages className="w-6 h-6 text-pink-300" />
          </div>
          <p className="text-sm font-medium">{t`No translations for this page`}</p>
          <p className="text-xs mt-1">{t`This page has no translatable text entries`}</p>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
          <div style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const entry = displayEntries[virtualRow.index]
              const translated = translatedMap.get(entry.id)
              const audio = audioMap.get(entry.id)
              const isImg = isImageEntry(entry.id)
              const isAnswer = isAnswerEntry(entry.id)

              return (
                <div
                  key={entry.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="pb-1">
                    {isSourceLang ? (
                      /* Source language: single column + fixed-width audio column */
                      <div className={cn("flex items-start px-3 py-2.5 rounded-md border", isAnswer ? "bg-amber-50/60" : "bg-card")}>
                        {isImg && (
                          <img
                            src={`${BASE_URL}/books/${bookLabel}/images/${entry.id}`}
                            alt=""
                            className="shrink-0 w-16 h-12 rounded object-cover ring-1 ring-border mr-3"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] text-muted-foreground">
                            {entry.id}
                            {isAnswer && <span className="ml-1.5 text-[9px] font-medium text-amber-700 bg-amber-100 rounded px-1 py-0.5">{t`Answer`}</span>}
                          </span>
                          <p className="text-sm leading-relaxed mt-0.5">{entry.text}</p>
                        </div>
                        {showAudioControls && !isAnswer && (
                          <div className="shrink-0 w-28 ml-3">
                            <AudioAction
                              audio={audio}
                              audioLang={audioLang}
                              bookLabel={bookLabel}
                              textId={entry.id}
                              canGenerate={currentLanguageUsesGemini}
                              hasGeminiKey={geminiKey.length > 0}
                              onGenerate={handleGenerateAudio}
                              isGenerating={
                                generateAudioMutation.isPending &&
                                generateAudioMutation.variables?.textId === entry.id &&
                                generateAudioMutation.variables?.language === audioLang
                              }
                              errorMessage={generateErrorById[entry.id]}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Translation mode: source | translation | fixed-width audio column */
                      <div className={cn("flex items-start px-3 py-2.5 rounded-md border", isAnswer ? "bg-amber-50/60" : "bg-card")}>
                        <div className="grid grid-cols-2 gap-3 flex-1 min-w-0">
                          <div className="flex items-start gap-3">
                            {isImg && (
                              <img
                                src={`${BASE_URL}/books/${bookLabel}/images/${entry.id}`}
                                alt=""
                                className="shrink-0 w-16 h-12 rounded object-cover ring-1 ring-border"
                              />
                            )}
                            <div className="min-w-0">
                              <span className="text-[10px] text-muted-foreground">
                                {entry.id}
                                {isAnswer && <span className="ml-1.5 text-[9px] font-medium text-amber-700 bg-amber-100 rounded px-1 py-0.5">{t`Answer`}</span>}
                              </span>
                              <p className="text-sm leading-relaxed mt-0.5">{entry.text}</p>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] text-muted-foreground">&nbsp;</span>
                            <textarea
                              value={translated ?? ""}
                              onChange={(e) => updateEntry(entry.id, e.target.value)}
                              placeholder={t`Pending...`}
                              className="w-full text-sm leading-relaxed mt-0.5 resize-none rounded border border-transparent bg-transparent p-1.5 -ml-1.5 hover:border-border hover:bg-muted/30 focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors placeholder:text-muted-foreground placeholder:italic"
                              style={{ fieldSizing: "content" } as React.CSSProperties}
                              rows={1}
                            />
                          </div>
                        </div>
                        {showAudioControls && !isAnswer && (
                          <div className="shrink-0 w-28 ml-3">
                            <AudioAction
                              audio={audio}
                              audioLang={audioLang}
                              bookLabel={bookLabel}
                              textId={entry.id}
                              canGenerate={currentLanguageUsesGemini}
                              hasGeminiKey={geminiKey.length > 0}
                              onGenerate={handleGenerateAudio}
                              isGenerating={
                                generateAudioMutation.isPending &&
                                generateAudioMutation.variables?.textId === entry.id &&
                                generateAudioMutation.variables?.language === audioLang
                              }
                              errorMessage={generateErrorById[entry.id]}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {showAllButton}
        </div>
      )}
    </div>
  )
}

/* ---------- Audio components ---------- */

/** Module-level ref so only one PlayButton plays at a time. */
let activePlayer: { stop: () => void } | null = null

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, "0")}`
}

/** Downsample audio buffer to a fixed number of peak amplitude bars. */
function computePeaks(buffer: AudioBuffer, barCount: number): number[] {
  const data = buffer.getChannelData(0)
  const step = Math.max(1, Math.floor(data.length / barCount))
  const peaks: number[] = []
  for (let i = 0; i < barCount; i++) {
    let max = 0
    const start = i * step
    const end = Math.min(start + step, data.length)
    for (let j = start; j < end; j++) {
      const v = Math.abs(data[j])
      if (v > max) max = v
    }
    peaks.push(max)
  }
  // Normalize to 0-1
  const maxPeak = Math.max(...peaks, 0.01)
  return peaks.map((p) => p / maxPeak)
}

const BAR_COUNT = 40

function PlayButton({ audioUrl }: { audioUrl: string }) {
  const [playing, setPlaying] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [peaks, setPeaks] = useState<number[] | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef<number>(0)
  const fetchedRef = useRef(false)

  // Fetch waveform data on first expand
  useEffect(() => {
    if (!expanded || fetchedRef.current) return
    fetchedRef.current = true
    fetch(audioUrl)
      .then((r) => r.arrayBuffer())
      .then((buf) => new AudioContext().decodeAudioData(buf))
      .then((decoded) => setPeaks(computePeaks(decoded, BAR_COUNT)))
      .catch(() => {})
  }, [expanded, audioUrl])

  const tick = useCallback(() => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    cancelAnimationFrame(rafRef.current)
    setPlaying(false)
    setProgress(0)
  }, [])

  const toggle = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl)
      audioRef.current.addEventListener("loadedmetadata", () => {
        setDuration(audioRef.current!.duration)
      })
      audioRef.current.addEventListener("ended", () => {
        activePlayer = null
        setPlaying(false)
        setProgress(0)
        cancelAnimationFrame(rafRef.current)
      })
    }
    if (playing) {
      activePlayer = null
      audioRef.current.pause()
      cancelAnimationFrame(rafRef.current)
      setPlaying(false)
    } else {
      // Stop any other playing audio first
      if (activePlayer) activePlayer.stop()
      activePlayer = { stop }
      audioRef.current.play()
      setPlaying(true)
      setExpanded(true)
      rafRef.current = requestAnimationFrame(tick)
    }
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audioRef.current.currentTime = pct * duration
    setProgress(pct * duration)
  }

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (activePlayer?.stop === stop) activePlayer = null
    }
  }, [stop])

  const pct = duration > 0 ? (progress / duration) * 100 : 0

  return (
    <div className="shrink-0 mt-3 flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "shrink-0 flex items-center justify-center w-6 h-6 rounded-full transition-all cursor-pointer",
          playing ? "bg-rose-500 text-white hover:bg-rose-600 scale-110" : "bg-muted text-muted-foreground hover:bg-rose-100 hover:text-rose-600 hover:scale-110"
        )}
      >
        {playing ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5 ml-0.5" />}
      </button>
      {expanded && (
        <div className="flex items-center gap-1 w-full">
          <div
            className="relative h-5 flex-1 min-w-[80px] cursor-pointer rounded overflow-hidden"
            onClick={seek}
          >
            {peaks ? (
              <div className="flex items-end h-full gap-px">
                {peaks.map((p, i) => {
                  const barPct = ((i + 0.5) / BAR_COUNT) * 100
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-sm transition-colors"
                      style={{
                        height: `${Math.max(8, p * 100)}%`,
                        backgroundColor: barPct <= pct ? "rgb(244 63 94)" : "rgb(228 228 231)",
                      }}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="h-full bg-muted rounded relative">
                <div className="absolute inset-y-0 left-0 bg-rose-400 rounded" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
          <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">
            {duration > 0 ? formatTime(duration - progress) : "—"}
          </span>
        </div>
      )}
    </div>
  )
}

function AudioAction({
  audio,
  audioLang,
  bookLabel,
  textId,
  canGenerate,
  hasGeminiKey,
  onGenerate,
  isGenerating,
  errorMessage,
}: {
  audio?: { fileName: string; voice: string }
  audioLang: string | null
  bookLabel: string
  textId: string
  canGenerate: boolean
  hasGeminiKey: boolean
  onGenerate: (textId: string) => void
  isGenerating: boolean
  errorMessage?: string
}) {
  const { t } = useLingui()

  if (audio && audioLang) {
    return (
      <PlayButton
        key={audioLang}
        audioUrl={getAudioUrl(bookLabel, audioLang, audio.fileName)}
      />
    )
  }

  if (!canGenerate) return null

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2 text-[10px]"
        disabled={isGenerating || !hasGeminiKey}
        onClick={() => onGenerate(textId)}
        title={
          hasGeminiKey
            ? t`Generate missing Gemini audio`
            : t`Set a Gemini API key to generate audio`
        }
      >
        {isGenerating ? (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        ) : (
          <WandSparkles className="mr-1 h-3 w-3" />
        )}
        {t`Generate`}
      </Button>
      {errorMessage && (
        <p className="max-w-44 text-[10px] leading-tight text-red-500 text-right">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
