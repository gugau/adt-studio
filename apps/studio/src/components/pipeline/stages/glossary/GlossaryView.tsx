import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { BookOpen, Check, ChevronDown, EyeOff, Loader2, Plus, RotateCcw, Search, Trash2, X } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { api } from "@/api/client"
import type { GlossaryItem, GlossaryOutput, VersionEntry } from "@/api/client"
import { useGlossary } from "@/hooks/use-glossary"
import { useStepHeader } from "../../components/StepViewRouter"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { StageRunCard } from "../../components/StageRunCard"
import { StageContentGuard } from "../../components/StageContentGuard"
import { StageEmptyState } from "../../components/StageEmptyState"
import { useLingui } from "@lingui/react/macro"
import { AddGlossaryDialog } from "./AddGlossaryDialog"
import { GlossaryHintBanner } from "./components/GlossaryHintBanner"


type GlossaryData = Omit<GlossaryOutput, "version">
type GlossaryFilter = "all" | "active" | "pruned"

const TOOLBAR_HEIGHT = 64

function createEmptyGlossary(): GlossaryData {
  return {
    items: [],
    pageCount: 0,
    generatedAt: new Date().toISOString(),
  }
}

function VersionPicker({
  currentVersion,
  saving,
  dirty,
  bookLabel,
  disableSave = false,
  onPreview,
  onSave,
  onDiscard,
}: {
  currentVersion: number | null
  saving: boolean
  dirty: boolean
  bookLabel: string
  disableSave?: boolean
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
    const res = await api.getVersionHistory(bookLabel, "glossary", "book", true)
    setVersions(res.versions)
    setLoading(false)
  }

  const handlePick = (v: VersionEntry) => {
    if (v.version === currentVersion && !dirty) {
      setOpen(false)
      return
    }
    setOpen(false)
    onPreview(v.data)
  }

  if (saving) {
    return <Loader2 className="h-3 w-3 animate-spin" />
  }

  if (dirty) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onDiscard}
          className="text-[10px] font-medium rounded px-2 py-0.5 bg-black/15 text-black hover:bg-black/25 cursor-pointer transition-colors"
        >
          {t`Discard`}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={disableSave}
          title={disableSave ? t`Wait for glossary generation to finish` : undefined}
          className="flex items-center gap-1 text-[10px] font-medium rounded px-2 py-0.5 bg-white text-green-800 hover:bg-white/80 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="h-3 w-3" />
          {t`Save`}
        </button>
      </div>
    )
  }

  if (currentVersion == null) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-0.5 text-[10px] font-normal normal-case tracking-normal bg-white/20 text-white hover:bg-white/30 rounded px-1.5 py-0.5 transition-colors"
      >
        v{currentVersion}
        <ChevronDown className="h-2.5 w-2.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-popover border rounded shadow-md min-w-[80px] py-1 animate-in fade-in zoom-in-95 duration-150">
          {loading ? (
            <div className="flex items-center justify-center py-2 px-3">
              <Loader2 className="h-3 w-3 animate-spin" />
            </div>
          ) : versions && versions.length > 0 ? (
            versions.map((v) => (
              <button
                key={v.version}
                type="button"
                onClick={() => handlePick(v)}
                className={`w-full text-left px-3 py-1 text-xs hover:bg-accent transition-colors ${
                  v.version === currentVersion ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
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

export function GlossaryView({ bookLabel }: { bookLabel: string }) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const { data, isLoading } = useGlossary(bookLabel)
  const { setExtra } = useStepHeader()
  const { stageState, queueRun } = useBookRun()
  const { apiKey, hasApiKey } = useApiKey()
  const glossaryState = stageState("glossary")
  const glossaryDone = glossaryState === "done"
  const glossaryRunning = glossaryState === "running" || glossaryState === "queued"

  const handleRunGlossary = useCallback(() => {
    if (!hasApiKey || glossaryRunning) return
    queueRun({ fromStage: "glossary", toStage: "glossary", apiKey })
  }, [hasApiKey, glossaryRunning, apiKey, queueRun])

  const [pending, setPending] = useState<GlossaryData | null>(null)
  const [saving, setSaving] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState<GlossaryFilter>("active")

  // Reset pending when data changes
  useEffect(() => {
    setPending(null)
  }, [data?.version])

  const effective = pending ?? data ?? null
  const items = effective?.items ?? []
  const dirty = pending != null
  const currentVersion = data?.version ?? null
  const prunedCount = useMemo(() => items.filter((item) => item.pruned).length, [items])
  const visibleCount = items.length - prunedCount

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase()
    return items.filter((item) => {
      if (filter === "active" && item.pruned) return false
      if (filter === "pruned" && !item.pruned) return false
      if (!q) return true
      const haystack = [item.word, item.definition, ...item.variations]
        .join(" ")
        .toLocaleLowerCase()
      return haystack.includes(q)
    })
  }, [items, searchQuery, filter])

  const openAddDialog = useCallback(() => {
    setShowAddDialog(true)
  }, [])

  const saveGlossary = useCallback(async () => {
    if (!pending) return
    setSaving(true)
    const minDelay = new Promise((r) => setTimeout(r, 400))
    await api.updateGlossary(bookLabel, pending)
    setPending(null)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "glossary"] }),
      queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "text-catalog"] }),
    ])
    await minDelay
    setSaving(false)
  }, [pending, bookLabel, queryClient])

  // Use ref so the header always calls the latest save
  const saveRef = useRef(saveGlossary)
  saveRef.current = saveGlossary

  useEffect(() => {
    setExtra(
      <div className="flex items-center gap-1.5 ml-auto">
        <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5">{t`${String(visibleCount)} terms`}</span>
        <VersionPicker
          currentVersion={currentVersion}
          saving={saving}
          dirty={dirty}
          bookLabel={bookLabel}
          disableSave={glossaryRunning}
          onPreview={(d) => setPending(d as GlossaryData)}
          onSave={() => saveRef.current()}
          onDiscard={() => setPending(null)}
        />
      </div>
    )
    return () => setExtra(null)
  }, [visibleCount, saving, dirty, bookLabel, currentVersion, glossaryRunning, t, setExtra])

  const updateDefinition = (itemId: string, newDefinition: string) => {
    const base = pending ?? data ?? createEmptyGlossary()
    if (!base) return
    setPending({
      ...base,
      generatedAt: base.generatedAt || new Date().toISOString(),
      items: base.items.map((item) =>
        (item.id ?? item.word) === itemId ? { ...item, definition: newDefinition } : item
      ),
    })
  }

  const updateEmojis = (itemId: string, newEmojis: string[]) => {
    const base = pending ?? data ?? createEmptyGlossary()
    if (!base) return
    setPending({
      ...base,
      generatedAt: base.generatedAt || new Date().toISOString(),
      items: base.items.map((item) =>
        (item.id ?? item.word) === itemId ? { ...item, emojis: newEmojis } : item
      ),
    })
  }

  const removeManualItem = (itemId: string) => {
    const base = pending ?? data ?? createEmptyGlossary()
    setPending({
      ...base,
      generatedAt: base.generatedAt || new Date().toISOString(),
      items: base.items.filter((item) => (item.id ?? item.word) !== itemId),
    })
  }

  const togglePruned = (itemId: string, pruned: boolean) => {
    const base = pending ?? data ?? createEmptyGlossary()
    setPending({
      ...base,
      generatedAt: base.generatedAt || new Date().toISOString(),
      items: base.items.map((item) =>
        (item.id ?? item.word) === itemId ? { ...item, pruned } : item
      ),
    })
  }

  const addManualItem = (manualItem: GlossaryItem) => {
    const base = pending ?? data ?? createEmptyGlossary()
    setPending({
      ...base,
      generatedAt: base.generatedAt || new Date().toISOString(),
      items: [...base.items, manualItem],
    })
  }

  const chipBase =
    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-all duration-200 cursor-pointer"

  return (
    <StageContentGuard
      stageSlug="glossary"
      isLoading={isLoading && !effective}
      loadingLabel={t`Loading glossary...`}
      showRunCard={items.length === 0}
      runCard={
        <>
          <StageRunCard
            stageSlug="glossary"
            isRunning={glossaryRunning}
            completed={glossaryDone}
            onRun={handleRunGlossary}
            disabled={!hasApiKey || glossaryRunning}
          />
          <AddGlossaryDialog
            open={showAddDialog}
            onOpenChange={setShowAddDialog}
            bookLabel={bookLabel}
            existingItems={items}
            onAdd={addManualItem}
          />
        </>
      }
    >
      <div className="flex flex-1 flex-col overflow-y-auto">
        <GlossaryHintBanner />
        <div
          className="sticky top-0 z-20 flex items-center gap-3 px-6 py-3 bg-background/95 backdrop-blur-md border-b border-border/60"
          style={{ height: TOOLBAR_HEIGHT }}
        >
          <div className="inline-flex items-center rounded-lg border border-border/70 bg-muted/40 p-0.5">
            {([
              { value: "all", label: t`All`, count: items.length },
              { value: "active", label: t`Active`, count: visibleCount },
              { value: "pruned", label: t`Pruned`, count: prunedCount },
            ] as const).map((opt) => {
              const active = filter === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilter(opt.value)}
                  aria-pressed={active}
                  className={`${chipBase} ${
                    active
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>{opt.label}</span>
                  <span
                    className={`tabular-nums text-[11px] ${
                      active
                        ? opt.value === "pruned"
                          ? "text-muted-foreground"
                          : "text-lime-700"
                        : "text-muted-foreground/60"
                    }`}
                  >
                    {opt.count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t`Search terms or definitions…`}
              className="w-full h-8 rounded-md border border-border/70 bg-background pl-8 pr-8 text-[12px] placeholder:text-muted-foreground/60 focus:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-200 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label={t`Clear search`}
                className="absolute right-1 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={openAddDialog}
              disabled={glossaryRunning}
              title={glossaryRunning ? t`Wait for glossary generation to finish` : undefined}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-lime-600 px-3 text-[12px] font-medium text-white shadow-sm transition-colors hover:bg-lime-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              {t`Add Term`}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 px-4 pb-12 pt-4">
          {filteredItems.length === 0 ? (
            <StageEmptyState
              icon={BookOpen}
              color="lime"
              title={
                searchQuery
                  ? t`No terms match your search`
                  : filter === "pruned"
                    ? t`No pruned terms`
                    : t`No terms to show`
              }
            />
          ) : (
            filteredItems.map((item) => (
              <GlossaryItemCard
                key={item.id ?? item.word}
                item={item}
                onDefinitionChange={updateDefinition}
                onEmojisChange={updateEmojis}
                onRemoveManual={removeManualItem}
                onTogglePruned={togglePruned}
              />
            ))
          )}
        </div>

        <AddGlossaryDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          bookLabel={bookLabel}
          existingItems={items}
          onAdd={addManualItem}
        />
      </div>
    </StageContentGuard>
  )
}

function GlossaryItemCard({
  item,
  onDefinitionChange,
  onEmojisChange,
  onRemoveManual,
  onTogglePruned,
}: {
  item: GlossaryItem
  onDefinitionChange: (itemId: string, definition: string) => void
  onEmojisChange: (itemId: string, emojis: string[]) => void
  onRemoveManual: (itemId: string) => void
  onTogglePruned: (itemId: string, pruned: boolean) => void
}) {
  const { t } = useLingui()
  const itemId = item.id ?? item.word
  const isPruned = item.pruned === true
  const isManual = item.source === "manual"

  return (
    <div
      className={`group/card relative flex flex-col gap-2.5 rounded-xl border p-3.5 transition-all duration-200 ${
        isPruned
          ? "border-border/50 bg-muted/20 opacity-70 hover:opacity-100"
          : "border-border/70 bg-card hover:shadow-md hover:border-lime-300/70"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${isManual ? "bg-emerald-500" : "bg-violet-400"}`}
              title={isManual ? t`Added manually` : t`Generated by AI`}
            />
            <span
              className={`text-[14px] font-semibold leading-tight ${
                isPruned ? "text-muted-foreground line-through" : "text-foreground"
              }`}
            >
              {item.word}
            </span>
          </span>
          <EmojiInput
            value={item.emojis}
            onChange={(next) => onEmojisChange(itemId, next)}
            placeholder={t`emoji`}
          />
          {isManual && (
            <span className="inline-flex items-center rounded-full bg-lime-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-lime-700">
              {t`Manual`}
            </span>
          )}
          {isPruned && (
            <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t`Pruned`}
            </span>
          )}
          {item.variations.map((v) => (
            <span
              key={v}
              className="inline-flex items-center rounded-md bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              {v}
            </span>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-200 group-hover/card:opacity-100 focus-within:opacity-100">
          {isManual ? (
            <button
              type="button"
              onClick={() => onRemoveManual(itemId)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive cursor-pointer"
              title={t`Remove manual glossary term`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : isPruned ? (
            <button
              type="button"
              onClick={() => onTogglePruned(itemId, false)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
              title={t`Restore this term — it will be eligible again on the next regeneration.`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onTogglePruned(itemId, true)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive cursor-pointer"
              title={t`Prune this term — it will be hidden from output and excluded from future regenerations.`}
            >
              <EyeOff className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <AutoTextarea
        value={item.definition}
        onChange={(val) => onDefinitionChange(itemId, val)}
        placeholder={t`Add a definition…`}
        ariaLabel={t`Definition for ${item.word}`}
      />
    </div>
  )
}

/** Textarea that grows to fit its content and matches the inline-edit affordance
 * used across the gallery: dashed resting border, lime focus ring. */
function AutoTextarea({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      rows={1}
      className="w-full resize-none overflow-hidden rounded-md border border-dashed border-border/60 bg-background/40 p-2.5 text-[13px] leading-relaxed text-foreground transition-colors duration-150 hover:border-lime-300 hover:bg-lime-50/40 focus:border-solid focus:border-lime-400 focus:bg-background focus:outline-none focus:ring-2 focus:ring-lime-200"
    />
  )
}

/** Inline editor for an emoji list. Stores a draft string while the field is
 * focused so spaces can be typed naturally; commits to a deduped, whitespace-
 * split array on blur or Enter. */
function EmojiInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const display = draft ?? value.join(" ")

  const commit = () => {
    if (draft === null) return
    const parsed = Array.from(new Set(draft.split(/\s+/).filter(Boolean)))
    if (parsed.length !== value.length || parsed.some((e, i) => e !== value[i])) {
      onChange(parsed)
    }
    setDraft(null)
  }

  return (
    <input
      type="text"
      value={display}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          e.currentTarget.blur()
        } else if (e.key === "Escape") {
          e.preventDefault()
          setDraft(null)
          e.currentTarget.blur()
        }
      }}
      className="w-20 shrink-0 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-[14px] transition-colors hover:border-border hover:bg-muted/40 focus:border-lime-400 focus:bg-background focus:outline-none focus:ring-2 focus:ring-lime-200"
    />
  )
}
