import { useState, useEffect, useRef } from "react"
import { flushSync } from "react-dom"
import { AlertCircle, ArrowRight, Images, Languages, Pencil, X } from "lucide-react"
import { SettingExplainer } from "@/components/pipeline/components/SettingExplainer"
import { Trans, useLingui } from "@lingui/react/macro"
import { LandingPageShell } from "@/components/pipeline/components/LandingPageShell"
import { PrereqGuard } from "@/components/pipeline/components/PrereqGuard"
import {
  SettingsCard,
  SettingsField,
} from "@/components/pipeline/components/SettingsCard"
import { LanguagePicker } from "@/components/LanguagePicker"
import { useActiveConfig } from "@/hooks/use-debug"
import { useStageStatus } from "@/hooks/use-stage-status"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { useBookConfig } from "@/hooks/use-book-config"
import { usePersistConfig } from "@/hooks/use-persist-config"
import { useBook } from "@/hooks/use-books"
import { displayLang } from "./lib/display-lang"
import { SelectImagesDialog } from "./components/SelectImagesDialog"
import { cn } from "@/lib/utils"

const viewTransitionNameFor = (code: string) => `lang-chip-${code.replace(/[^a-zA-Z0-9_-]/g, "_")}`

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
  const captionsStatus = useStageStatus("captions")
  const captionsReady = captionsStatus.isCompleted

  const [outputLanguages, setOutputLanguages] = useState<Set<string>>(new Set())
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([])
  const [imageDialogOpen, setImageDialogOpen] = useState(false)
  const seededRef = useRef(false)

  const baseLanguage =
    typeof activeConfigData?.merged?.editing_language === "string"
      ? (activeConfigData.merged.editing_language as string)
      : book?.languageCode ?? "en"

  useEffect(() => {
    if (!activeConfigData || !book) return
    const m = activeConfigData.merged as Record<string, unknown>
    const existing = Array.isArray(m.output_languages)
      ? (m.output_languages as string[])
      : []

    if (!seededRef.current && existing.length === 0 && baseLanguage) {
      seededRef.current = true
      const seeded = [baseLanguage]
      setOutputLanguages(new Set(seeded))
      persist({ output_languages: seeded })
    } else {
      seededRef.current = true
      setOutputLanguages(new Set(existing))
    }

    if (m.image_translation && typeof m.image_translation === "object") {
      const it = m.image_translation as Record<string, unknown>
      if (Array.isArray(it.selected_image_ids)) {
        setSelectedImageIds(it.selected_image_ids as string[])
      }
    }
  }, [activeConfigData, book, baseLanguage])

  const withChipTransition = (update: () => void) => {
    const reduceMotion =
      typeof window !== "undefined" &&
      // eslint-disable-next-line lingui/no-unlocalized-strings -- CSS media query, not user-visible
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const doc = typeof document !== "undefined" ? document : null
    if (!doc || typeof doc.startViewTransition !== "function" || reduceMotion) {
      update()
      return
    }
    doc.startViewTransition(() => {
      flushSync(update)
    })
  }

  const handleLanguageToggle = (code: string) => {
    withChipTransition(() => {
      const next = new Set(outputLanguages)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      setOutputLanguages(next)
      persist({ output_languages: Array.from(next) })
    })
  }

  const handleLanguageRemove = (code: string) => {
    withChipTransition(() => {
      const next = new Set(outputLanguages)
      next.delete(code)
      setOutputLanguages(next)
      persist({ output_languages: Array.from(next) })
    })
  }

  const persistImageTranslation = (patch: Record<string, unknown>) => {
    const existing = (bookConfigData?.config?.image_translation ?? {}) as Record<
      string,
      unknown
    >
    persist({ image_translation: { ...existing, ...patch } })
  }

  const handleImagesConfirm = (ids: string[]) => {
    setSelectedImageIds(ids)
    // Image translations are "enabled" iff at least one image is selected —
    // the selection itself is the on/off signal. Still persist both fields so
    // the pipeline's existing `enabled` check keeps working.
    persistImageTranslation({
      enabled: ids.length > 0,
      selected_image_ids: ids.length > 0 ? ids : undefined,
    })
    setImageDialogOpen(false)
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
          imageCount={selectedImageIds.length}
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
                  <li
                    key={code}
                    style={{ viewTransitionName: viewTransitionNameFor(code) }}
                  >
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-200 bg-pink-50 px-2.5 py-1 text-[12px] font-medium text-pink-700 transition-colors">
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
              renderBadges={false}
              label={t`Add language`}
            />
          </div>
        </SettingsField>
      </SettingsCard>

      <SettingsCard>
        <SettingsField
          label={<Trans>Image Translations</Trans>}
          labelAction={
            <SettingExplainer
              visual={<ImageTranslationVisual />}
              description={
                <Trans>
                  Sample shown for illustration. The actual languages used
                  come from your Output Languages list above.
                </Trans>
              }
            />
          }
          hint={
            <Trans>
              Optionally translate burned-in text inside images (signs, labels,
              callouts). Select the images to localize — leaving the list
              empty keeps images in the source language.
            </Trans>
          }
        >
            <div className="flex flex-col gap-2">
              {selectedImageIds.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setImageDialogOpen(true)}
                  disabled={!captionsReady}
                  className="group flex w-full items-center gap-3 rounded-md border border-[#e5e5e5] bg-white px-3 py-2.5 text-left transition-colors hover:border-[#d4d4d4] hover:bg-[#fafafa] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-pink-100 text-pink-700">
                    <Images className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  </span>
                  <span className="flex-1 text-[13px] font-medium text-[#0a0a0a]">
                    <Trans>
                      {selectedImageIds.length} image
                      {selectedImageIds.length === 1 ? "" : "s"} selected
                    </Trans>
                  </span>
                  <Pencil
                    className="h-3.5 w-3.5 text-[#a3a3a3] transition-colors group-hover:text-[#525252]"
                    strokeWidth={2}
                    aria-hidden
                  />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setImageDialogOpen(true)}
                  disabled={!captionsReady}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-[#e5e5e5] bg-[#fafafa] px-3 py-3 text-[12px] font-medium text-[#737373] transition-colors hover:border-[#d4d4d4] hover:bg-[#f5f5f5] hover:text-[#525252] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Images
                    className="h-3.5 w-3.5"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  <Trans>Choose images...</Trans>
                </button>
              )}

              {!captionsReady && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
                  <AlertCircle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span>
                    <Trans>
                      Run Image Captions first — only captioned images appear
                      in this list.
                    </Trans>
                  </span>
                </div>
              )}
            </div>
          </SettingsField>
        </SettingsCard>

      {imageDialogOpen && (
        <SelectImagesDialog
          bookLabel={bookLabel}
          initialSelected={selectedImageIds}
          onConfirm={handleImagesConfirm}
          onClose={() => setImageDialogOpen(false)}
        />
      )}
    </LandingPageShell>
  )
}

function ImageTranslationVisual() {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
        <SchoolPhoto label="School" variant="source" />
        <ArrowRight
          className="h-3.5 w-3.5 text-pink-500"
          strokeWidth={2.25}
          aria-hidden
        />
        <SchoolPhoto label="Escuela" variant="target" />
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2.5 text-center text-[9.5px] font-semibold uppercase tracking-[0.14em]">
        <span className="text-[#a3a3a3]">
          <Trans>English</Trans>
        </span>
        <span aria-hidden />
        <span className="text-pink-600">
          <Trans>Spanish</Trans>
        </span>
      </div>
    </div>
  )
}

function SchoolPhoto({
  label,
  variant,
}: {
  label: string
  variant: "source" | "target"
}) {
  const isTarget = variant === "target"
  return (
    <div className="relative h-[90px] overflow-hidden rounded-md border border-black/10 bg-gradient-to-b from-sky-300/80 via-sky-200/60 to-emerald-100/80 shadow-sm">
      {/* Sun */}
      <div className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-amber-300/90 shadow-[0_0_6px_rgba(252,211,77,0.6)]" />
      {/* Distant hills */}
      <div
        className="absolute inset-x-0 bottom-7 h-3 bg-emerald-300/40"
        style={{
          clipPath:
            "polygon(0 100%, 15% 30%, 35% 65%, 55% 20%, 80% 55%, 100% 35%, 100% 100%)",
        }}
        aria-hidden
      />
      {/* Ground */}
      <div
        className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-b from-emerald-400/70 to-emerald-500/80"
        aria-hidden
      />
      {/* Building */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center">
        <div
          className="h-0 w-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-b-[12px] border-b-rose-900"
          aria-hidden
        />
        <div className="flex h-7 w-10 flex-col items-center justify-end gap-0.5 bg-orange-200/95 pt-1 ring-1 ring-black/10">
          <div className="grid grid-cols-3 gap-[2px]">
            <span className="h-1 w-1.5 rounded-[1px] bg-sky-700/50" />
            <span className="h-1 w-1.5 rounded-[1px] bg-sky-700/50" />
            <span className="h-1 w-1.5 rounded-[1px] bg-sky-700/50" />
          </div>
          <div className="h-1.5 w-1.5 rounded-t-[1px] bg-[#3b2417]" />
        </div>
      </div>
      {/* Speech-bubble callout — burned-in text rendered as part of the image */}
      <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2">
        <div
          className={cn(
            "relative whitespace-nowrap rounded-[8px] border px-2 py-[3px] text-[9px] font-semibold uppercase tracking-wider shadow-sm transition-colors",
            isTarget
              ? "border-pink-300 bg-pink-500 text-white ring-1 ring-pink-200/70"
              : "border-black/15 bg-white/95 text-[#1a1a1a]",
          )}
        >
          {label}
          {/* Bubble tail (outer / border) */}
          <span
            className={cn(
              "absolute left-1/2 top-full -translate-x-1/2 -translate-y-[0.5px] h-0 w-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent",
              isTarget ? "border-t-pink-300" : "border-t-black/15",
            )}
            aria-hidden
          />
          {/* Bubble tail (inner / fill) */}
          <span
            className={cn(
              "absolute left-1/2 top-full -translate-x-1/2 -translate-y-[1.5px] h-0 w-0 border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent",
              isTarget ? "border-t-pink-500" : "border-t-white/95",
            )}
            aria-hidden
          />
        </div>
      </div>
      {/* Subtle photo grain */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.18),transparent_55%)]"
        aria-hidden
      />
    </div>
  )
}

function LanguagePreview({
  baseLanguage,
  outputLanguages,
  imageCount,
}: {
  baseLanguage: string
  outputLanguages: string[]
  imageCount: number
}) {
  const imagesEnabled = imageCount > 0
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
            imagesEnabled
              ? "bg-pink-50 text-pink-700"
              : "bg-[#f5f5f5] text-[#737373]",
          )}
        >
          <span
            className={cn(
              "inline-block h-1.5 w-1.5 rounded-full",
              imagesEnabled ? "bg-pink-500" : "bg-[#a3a3a3]",
            )}
            aria-hidden
          />
          {imagesEnabled ? (
            <Trans>
              {imageCount} image{imageCount === 1 ? "" : "s"} will be
              translated
            </Trans>
          ) : (
            <Trans>Images stay in the source language</Trans>
          )}
        </div>
      </div>
    </div>
  )
}
