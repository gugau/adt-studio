import { useState, useEffect, useCallback, useMemo } from "react"
import type { ComponentType, SVGProps } from "react"
import {
  BookOpen,
  Check,
  Layers,
  Library,
  Pencil,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AddGlossaryDialog } from "./AddGlossaryDialog"
import type { GlossaryItem } from "@/api/client"
import { Trans, useLingui } from "@lingui/react/macro"
import { msg } from "@lingui/core/macro"
import { i18n as linguiI18n } from "@lingui/core"
import type { MessageDescriptor } from "@lingui/core"
import { LandingPageShell } from "@/components/pipeline/components/LandingPageShell"
import { LandingPageWarning } from "@/components/pipeline/components/LandingPageWarning"
import {
  SettingsCard,
  SettingsField,
} from "@/components/pipeline/components/SettingsCard"
import { Textarea } from "@/components/ui/textarea"
import { useBookConfig, useUpdateBookConfig } from "@/hooks/use-book-config"
import { useActiveConfig } from "@/hooks/use-debug"
import { useStageStatus } from "@/hooks/use-stage-status"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { useBook } from "@/hooks/use-books"
import { cn } from "@/lib/utils"

// eslint-disable-next-line lingui/no-unlocalized-strings -- CSS var, not user-visible
const ACCENT_VAR = `var(--accent-color, #65a30d)`
// eslint-disable-next-line lingui/no-unlocalized-strings -- CSS var, not user-visible
const ACCENT_VAR_SOFT = `var(--accent-color-soft, #ecfccb)`

type AmountKey = "concise" | "standard" | "comprehensive"

type AmountOption = {
  value: AmountKey
  label: MessageDescriptor
  description: MessageDescriptor
  Icon: ComponentType<SVGProps<SVGSVGElement> & { className?: string }>
}

const AMOUNT_OPTIONS: AmountOption[] = [
  {
    value: "concise",
    label: msg`Concise`,
    description: msg`Only the most central vocabulary.`,
    Icon: BookOpen,
  },
  {
    value: "standard",
    label: msg`Standard`,
    description: msg`A balanced glossary for most books.`,
    Icon: Layers,
  },
  {
    value: "comprehensive",
    label: msg`Comprehensive`,
    description: msg`Every notable concept and named entity.`,
    Icon: Library,
  },
]

type GlossarySample = {
  word: MessageDescriptor
  definition: MessageDescriptor
  emojis: string
}

// Sample entries mirror what readers see inside the rendered book's glossary
// panel: word + emoji pair + short definition.
const GLOSSARY_SAMPLES: GlossarySample[] = [
  {
    word: msg`Allegory`,
    definition: msg`A story with characters and events that stand for a deeper, often moral, meaning.`,
    emojis: "📚 🔍",
  },
  {
    word: msg`Ecosystem`,
    definition: msg`The community of living organisms in a place and the way they interact with each other and their environment.`,
    emojis: "🌿 🦊",
  },
  {
    word: msg`Metaphor`,
    definition: msg`A figure of speech that describes one thing as if it were another to draw a comparison.`,
    emojis: "📝 ✨",
  },
  {
    word: msg`Photosynthesis`,
    definition: msg`The process plants use to turn sunlight, water, and carbon dioxide into food.`,
    emojis: "🌱 ☀️",
  },
  {
    word: msg`Symbiosis`,
    definition: msg`A close, long-term relationship between two different species, often benefiting both.`,
    emojis: "🐠 🐡",
  },
]

const AMOUNT_VISIBLE: Record<AmountKey, number> = {
  concise: 3,
  standard: 4,
  comprehensive: 5,
}

export function GlossaryLandingPage({ bookLabel }: { bookLabel: string }) {
  const { t, i18n } = useLingui()
  const { data: bookConfigData } = useBookConfig(bookLabel)
  const { data: activeConfigData } = useActiveConfig(bookLabel)
  const { data: book } = useBook(bookLabel)
  const updateConfig = useUpdateBookConfig()
  const { apiKey, hasApiKey } = useApiKey()
  const { queueRun } = useBookRun()
  const status = useStageStatus("glossary")
  const storyboardStatus = useStageStatus("storyboard")
  const storyboardReady = storyboardStatus.isCompleted

  const [amount, setAmount] = useState<AmountKey>("standard")
  const [userPrompt, setUserPrompt] = useState("")
  const [seedTerms, setSeedTerms] = useState<GlossaryItem[]>([])
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorDraft, setEditorDraft] = useState("")

  useEffect(() => {
    if (!activeConfigData) return
    const m = activeConfigData.merged as Record<string, unknown>
    if (
      m.glossary_amount === "concise" ||
      m.glossary_amount === "standard" ||
      m.glossary_amount === "comprehensive"
    ) {
      setAmount(m.glossary_amount)
    }
    if (typeof m.glossary_user_prompt === "string") {
      setUserPrompt(m.glossary_user_prompt)
    }
    if (Array.isArray(m.glossary_seed_terms)) {
      setSeedTerms(m.glossary_seed_terms as GlossaryItem[])
    }
  }, [activeConfigData])

  const persist = useCallback(
    (patch: Record<string, unknown>) => {
      const base = bookConfigData?.config ?? {}
      updateConfig.mutate({ label: bookLabel, config: { ...base, ...patch } })
    },
    [bookConfigData, bookLabel, updateConfig],
  )

  const handleAmountChange = (value: AmountKey) => {
    setAmount(value)
    persist({ glossary_amount: value })
  }

  const handleSeedTermAdd = (item: GlossaryItem) => {
    const next = [...seedTerms, item]
    setSeedTerms(next)
    persist({ glossary_seed_terms: next })
  }

  const handleSeedTermRemove = (id: string) => {
    const next = seedTerms.filter((t) => t.id !== id)
    setSeedTerms(next)
    persist({ glossary_seed_terms: next })
  }

  const composeBookContext = useCallback((): string => {
    if (!book) return ""
    const parts: string[] = []
    const summary = book.bookSummary?.summary?.trim()
    if (summary) {
      parts.push(summary)
    } else if (book.title) {
      parts.push(t`This book is titled "${book.title}".`)
    }
    if (book.languageCode) {
      try {
        const langName = new Intl.DisplayNames([i18n.locale], {
          type: "language",
        }).of(book.languageCode)
        if (langName) parts.push(t`The book is written in ${langName}.`)
      } catch {
        // ignore invalid locale codes
      }
    }
    parts.push(
      t`Prefer terms central to the book's subject matter. Skip generic vocabulary and proper nouns that don't carry meaning beyond the page.`,
    )
    return parts.join(" ")
  }, [book, i18n, t])

  const handleEditorAutoFill = () => {
    const composed = composeBookContext()
    if (!composed) return
    setEditorDraft(composed)
  }

  const openEditor = () => {
    setEditorDraft(userPrompt)
    setEditorOpen(true)
  }

  const cancelEditor = () => {
    setEditorOpen(false)
  }

  const saveEditor = () => {
    setUserPrompt(editorDraft)
    persist({ glossary_user_prompt: editorDraft })
    setEditorOpen(false)
  }

  const canAutoFill = Boolean(book)

  const handleRun = () => {
    if (!hasApiKey || !storyboardReady || status.isRunning) return
    queueRun({ fromStage: "glossary", toStage: "glossary", apiKey })
  }

  const disabledReason = !hasApiKey ? (
    <Trans>Add an API key in Book settings to run the glossary.</Trans>
  ) : !storyboardReady ? (
    <Trans>Run Storyboard first — the glossary is built from the typed sections placed by Storyboard.</Trans>
  ) : undefined

  return (
    <LandingPageShell
      bookLabel={bookLabel}
      stageSlug="glossary"
      settingsTab="general"
      colorClass="bg-lime-600 hover:bg-lime-700"
      accentColor="#65a30d"
      accentColorSoft="#ecfccb"
      isRunning={status.isRunning}
      isCompleted={status.isCompleted}
      hasError={status.hasError}
      canRun={true}
      extraDisabled={!hasApiKey || !storyboardReady}
      disabledReason={disabledReason}
      runLabel={<Trans>Run Glossary</Trans>}
      rerunLabel={<Trans>Re-run</Trans>}
      previewLabel={t`Glossary Preview`}
      onRun={handleRun}
      preview={<GlossaryPreview amount={amount} />}
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
          <Trans>Glossary</Trans>
        </h1>
        <p className="text-[14px] text-[#737373] leading-relaxed">
          <Trans>
            Build a glossary of key terms found in the book. Choose how much
            ground to cover, and add custom instructions to steer term
            selection toward what your audience needs.
          </Trans>
        </p>
      </div>

      <LandingPageWarning
        show={!storyboardReady}
        variant="prereq"
        title={<Trans>Run Storyboard first</Trans>}
        description={
          <Trans>
            The glossary scans the typed sections that Storyboard places into
            pages. Finish Storyboard before running this stage.
          </Trans>
        }
      />

      <SettingsCard>
        <SettingsField label={<Trans>Amount</Trans>}>
          <div role="radiogroup" className="flex flex-col gap-2">
            {AMOUNT_OPTIONS.map((opt) => (
              <AmountRow
                key={opt.value}
                option={opt}
                checked={amount === opt.value}
                onSelect={() => handleAmountChange(opt.value)}
              />
            ))}
          </div>
        </SettingsField>
      </SettingsCard>

      <SettingsCard>
        <SettingsField
          label={<Trans>Pre-defined Terms</Trans>}
          labelAction={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAddDialog(true)}
              className="h-7 gap-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-[#737373] hover:text-[var(--accent-color,#525252)]"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              <Trans>Add term</Trans>
            </Button>
          }
          hint={
            <Trans>
              Optional. Terms added here are pinned to the glossary so they
              always appear, even after re-running AI generation.
            </Trans>
          }
        >
          {seedTerms.length === 0 ? (
            <button
              type="button"
              onClick={() => setShowAddDialog(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-[#e5e5e5] bg-[#fafafa] px-3 py-3 text-[12px] font-medium text-[#737373] transition-colors hover:border-[#d4d4d4] hover:bg-[#f5f5f5] hover:text-[#525252] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
              <Trans>Add your first term</Trans>
            </button>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {seedTerms.map((term) => (
                <SeedTermRow
                  key={term.id}
                  term={term}
                  onRemove={() => handleSeedTermRemove(term.id ?? "")}
                />
              ))}
            </ul>
          )}
        </SettingsField>
      </SettingsCard>

      <SettingsCard>
        <SettingsField
          label={<Trans>Custom Instructions</Trans>}
          hint={
            <Trans>
              Optional. Tell the model what kinds of terms to focus on or
              avoid (e.g. "skip proper nouns", "include scientific names").
            </Trans>
          }
        >
          {userPrompt.trim() ? (
            <button
              type="button"
              onClick={openEditor}
              className="group flex w-full items-start gap-3 rounded-md border border-[#e5e5e5] bg-white px-3 py-2.5 text-left transition-colors hover:border-[#d4d4d4] hover:bg-[#fafafa] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-ring/40"
            >
              <p className="line-clamp-3 flex-1 text-[12.5px] leading-relaxed text-[#525252]">
                {userPrompt}
              </p>
              <Pencil
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#a3a3a3] transition-colors group-hover:text-[#525252]"
                strokeWidth={2}
                aria-hidden
              />
            </button>
          ) : (
            <button
              type="button"
              onClick={openEditor}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-[#e5e5e5] bg-[#fafafa] px-3 py-3 text-[12px] font-medium text-[#737373] transition-colors hover:border-[#d4d4d4] hover:bg-[#f5f5f5] hover:text-[#525252] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-ring/40"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
              <Trans>Add custom instructions</Trans>
            </button>
          )}
        </SettingsField>
      </SettingsCard>

      <AddGlossaryDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        bookLabel={bookLabel}
        existingItems={seedTerms}
        onAdd={handleSeedTermAdd}
      />

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent
          style={
            {
              "--accent-color": "#65a30d",
              "--ring": "#65a30d",
            } as React.CSSProperties
          }
        >
          <DialogHeader>
            <DialogTitle>{t`Custom Instructions`}</DialogTitle>
            <DialogDescription>
              {t`Optional notes to steer how the glossary is generated. Use Auto-fill to start from the book's title, language, and summary.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2">
            <Textarea
              value={editorDraft}
              onChange={(e) => setEditorDraft(e.target.value)}
              rows={12}
              placeholder={t`e.g. focus on scientific vocabulary, skip place names, define every italicized word…`}
              className="flex-1 resize-none text-[13px] leading-relaxed"
              autoFocus
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={!canAutoFill}
              onClick={handleEditorAutoFill}
              title={t`Auto-fill from book context`}
              aria-label={t`Auto-fill from book context`}
              className="shrink-0 text-muted-foreground hover:text-[var(--accent-color,#525252)]"
            >
              <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden />
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelEditor}>
              {t`Cancel`}
            </Button>
            <Button
              onClick={saveEditor}
              className="bg-lime-600 text-white hover:bg-lime-700 border-0"
            >
              {t`Save`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LandingPageShell>
  )
}

function SeedTermRow({
  term,
  onRemove,
}: {
  term: GlossaryItem
  onRemove: () => void
}) {
  const { t } = useLingui()
  return (
    <li className="group flex items-start gap-2.5 rounded-md border border-[#e5e5e5] bg-white px-3 py-2 transition-colors hover:border-[#d4d4d4] hover:bg-[#fafafa]">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[13px] font-semibold text-[#0a0a0a] truncate">
            {term.word}
          </span>
          {term.emojis.length > 0 && (
            <span className="text-[11px] leading-none">
              {term.emojis.join(" ")}
            </span>
          )}
        </div>
        <p className="line-clamp-2 text-[11.5px] leading-snug text-[#737373]">
          {term.definition}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        title={t`Remove term`}
        aria-label={t`Remove ${term.word}`}
        className="-mr-1 -mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#a3a3a3] opacity-0 transition-opacity duration-150 hover:bg-[#f5f5f5] hover:text-[#525252] focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/40 group-hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>
    </li>
  )
}

function AmountRow({
  option,
  checked,
  onSelect,
}: {
  option: AmountOption
  checked: boolean
  onSelect: () => void
}) {
  const Icon = option.Icon
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      style={
        checked
          ? { borderColor: ACCENT_VAR, background: ACCENT_VAR_SOFT }
          : undefined
      }
      className={cn(
        "flex w-full cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring/40",
        checked
          ? ""
          : "border-[#e5e5e5] bg-white hover:border-[#d4d4d4] hover:bg-[#fafafa]",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors",
          checked ? "text-white" : "bg-[#f5f5f5] text-[#737373]",
        )}
        style={checked ? { background: ACCENT_VAR } : undefined}
        aria-hidden
      >
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            "text-[13.5px] font-semibold leading-tight",
            checked ? "" : "text-[#0a0a0a]",
          )}
          style={checked ? { color: ACCENT_VAR } : undefined}
        >
          {linguiI18n._(option.label)}
        </span>
        <p className="text-[12px] leading-snug text-[#737373]">
          {linguiI18n._(option.description)}
        </p>
      </div>
      <span
        className={cn(
          "ml-2 mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
          checked ? "text-white" : "border-[#d4d4d4] bg-white",
        )}
        style={
          checked
            ? { background: ACCENT_VAR, borderColor: ACCENT_VAR }
            : undefined
        }
        aria-hidden
      >
        {checked && <Check className="h-3 w-3" strokeWidth={2.5} />}
      </span>
    </button>
  )
}

function GlossaryPreview({ amount }: { amount: AmountKey }) {
  const visibleCount = AMOUNT_VISIBLE[amount]
  const visible = GLOSSARY_SAMPLES.slice(0, visibleCount)

  return (
    <div className="relative flex flex-1 min-h-0 overflow-hidden bg-gradient-to-b from-lime-50/40 via-white to-white">
      {/* "Sample" tag — top-right corner so users know this is illustrative,
          not their actual generated glossary. */}
      <span className="absolute right-4 top-4 z-10 rounded-full border border-lime-200 bg-lime-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-lime-700">
        <Trans>Sample</Trans>
      </span>

      <div className="flex w-full h-full items-center justify-center p-4 min-h-0">
        {/* Reader's glossary panel — mirrors what end-readers see inside the
            rendered book at runtime. */}
        <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)]">
          {/* Panel header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[#f1f1f1] px-4 py-3">
            <h2 className="text-[14px] font-semibold text-[#0a0a0a]">
              <Trans>Glossary</Trans>
            </h2>
            <X
              className="h-3.5 w-3.5 text-[#a3a3a3]"
              strokeWidth={2}
              aria-hidden
            />
          </div>

          {/* Highlight toggle */}
          <div className="flex shrink-0 items-center justify-between px-4 pt-3.5">
            <span className="text-[12px] font-medium text-[#0a0a0a]">
              <Trans>Highlight words</Trans>
            </span>
            <span
              className="flex h-4 w-7 items-center rounded-full bg-neutral-200 px-0.5"
              aria-hidden
            >
              <span className="h-3 w-3 rounded-full bg-white shadow-sm" />
            </span>
          </div>

          {/* Search input (decorative) */}
          <div className="shrink-0 px-4 pt-3">
            <div className="flex items-center gap-2 rounded-full bg-[#f5f5f5] px-3 py-1.5">
              <Search
                className="h-3 w-3 text-[#a3a3a3]"
                strokeWidth={2}
                aria-hidden
              />
              <span className="text-[11px] text-[#a3a3a3]">
                <Trans>Search...</Trans>
              </span>
            </div>
          </div>

          {/* Entries */}
          <div className="flex flex-1 min-h-0 flex-col gap-3.5 overflow-hidden px-4 pt-3.5 pb-2">
            {visible.map((sample, i) => (
              <GlossaryReaderEntry
                key={`${amount}-${i}`}
                word={linguiI18n._(sample.word)}
                definition={linguiI18n._(sample.definition)}
                emojis={sample.emojis}
                delay={i * 40}
              />
            ))}
            <p
              key={`more-${amount}`}
              aria-hidden
              className="mt-auto pt-1 text-center tracking-[0.4em] text-lime-400/70 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300"
            >
              ···
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function GlossaryReaderEntry({
  word,
  definition,
  emojis,
  delay,
}: {
  word: string
  definition: string
  emojis: string
  delay: number
}) {
  return (
    <div
      className="flex flex-col gap-1 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300 motion-safe:ease-out"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      <div className="flex items-baseline gap-1.5">
        <span className="text-[12.5px] font-semibold text-[#0a0a0a]">
          {word}
        </span>
        <span className="text-[12px] leading-none">{emojis}</span>
      </div>
      <p className="line-clamp-2 text-[11px] leading-snug text-[#737373]">
        {definition}
      </p>
    </div>
  )
}
