import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { EyeOff, Loader2, Plus, RotateCcw, Search, Trash2 } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/api/client"
import type { GlossaryItem, GlossaryOutput } from "@/api/client"
import { useGlossary } from "@/hooks/use-glossary"
import { useStepHeader } from "../../components/StepViewRouter"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { StageRunCard } from "../../components/StageRunCard"
import { VersionPicker } from "../../components/VersionPicker"
import { StageContentGuard } from "../../components/StageContentGuard"
import { usePendingChanges } from "../../components/change-summary"
import { useLingui } from "@lingui/react/macro"
import { AddGlossaryDialog } from "./AddGlossaryDialog"


type GlossaryData = Omit<GlossaryOutput, "version">

function createEmptyGlossary(): GlossaryData {
  return {
    items: [],
    pageCount: 0,
    generatedAt: new Date().toISOString(),
  }
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
  const [showPruned, setShowPruned] = useState(false)

  // Reset pending when data changes
  useEffect(() => {
    setPending(null)
  }, [data?.version])

  const effective = pending ?? data ?? null
  const items = effective?.items ?? []
  const currentVersion = data?.version ?? null
  const prunedCount = useMemo(() => items.filter((item) => item.pruned).length, [items])
  const visibleCount = items.length - prunedCount

  const {
    label: pendingLabel,
    labelKey: pendingLabelKey,
    hasChanges: dirty,
  } = usePendingChanges({
    prev: data?.items ?? [],
    next: pending?.items,
    keyOf: (i) => i.id ?? i.word,
    isEqual: (a, b) =>
      a.word === b.word &&
      a.definition === b.definition &&
      a.emojis.join("|") === b.emojis.join("|") &&
      a.variations.join("|") === b.variations.join("|") &&
      !!a.pruned === !!b.pruned,
    classifyChanged: (before, after) =>
      !!after.pruned && !before.pruned ? "pruned" : "edited",
    noun: { one: t`term`, other: t`terms` },
  })

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase()
    return items.filter((item) => {
      if (!showPruned && item.pruned) return false
      if (!q) return true
      const haystack = [item.word, item.definition, ...item.variations]
        .join(" ")
        .toLocaleLowerCase()
      return haystack.includes(q)
    })
  }, [items, searchQuery, showPruned])

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
        <Button
          size="sm"
          className="h-6 px-2 text-[10px] bg-white/10 text-white hover:bg-white/20"
          onClick={openAddDialog}
          disabled={glossaryRunning}
          title={glossaryRunning ? t`Wait for glossary generation to finish` : undefined}
        >
          <Plus className="mr-1 h-3 w-3" />
          {t`Add Term`}
        </Button>
        <VersionPicker
          step="glossary"
          itemId="book"
          currentVersion={currentVersion}
          saving={saving}
          dirty={dirty}
          bookLabel={bookLabel}
          saveDisabledReason={glossaryRunning ? t`Wait for glossary generation to finish` : undefined}
          pendingLabel={pendingLabel}
          pendingLabelKey={pendingLabelKey}
          onPreview={(d) => setPending(d as GlossaryData)}
          onSave={() => saveRef.current()}
          onDiscard={() => setPending(null)}
        />
      </div>
    )
    return () => setExtra(null)
  }, [visibleCount, saving, dirty, bookLabel, currentVersion, openAddDialog, glossaryRunning, t, setExtra, pendingLabel, pendingLabelKey])

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
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t`Filter terms…`}
            className="w-full text-sm rounded border border-input bg-background pl-7 pr-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        {prunedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowPruned((v) => !v)}
            className={`shrink-0 flex items-center gap-1 text-xs rounded border px-2 py-1 transition-colors ${
              showPruned
                ? "bg-accent text-accent-foreground border-accent"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
            title={showPruned ? t`Hide pruned terms` : t`Show pruned terms`}
          >
            <EyeOff className="h-3.5 w-3.5" />
            {t`Pruned (${String(prunedCount)})`}
          </button>
        )}
      </div>
      <div className="space-y-1">
        {filteredItems.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            {searchQuery
              ? t`No terms match your filter.`
              : t`No terms to show.`}
          </div>
        ) : (
          filteredItems.map((item) => {
            const itemId = item.id ?? item.word
            const isPruned = item.pruned === true
            const isManual = item.source === "manual"
            return (
              <div
                key={itemId}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-md border bg-card transition-opacity ${
                  isPruned ? "opacity-50" : ""
                }`}
              >
                <div className="shrink-0 w-32">
                  <span className={`text-sm font-medium ${isPruned ? "line-through" : ""}`}>{item.word}</span>
                  {isManual && (
                    <Badge variant="secondary" className="ml-2 text-[10px] h-4 px-1.5">
                      {t`manual`}
                    </Badge>
                  )}
                  {isPruned && (
                    <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1.5">
                      {t`pruned`}
                    </Badge>
                  )}
                </div>
                <EmojiInput
                  value={item.emojis}
                  onChange={(next) => updateEmojis(itemId, next)}
                  placeholder={t`Add emojis`}
                />
                <Textarea
                  value={item.definition}
                  onChange={(e) => updateDefinition(itemId, e.target.value)}
                  className="flex-1 min-w-0 text-sm text-foreground leading-relaxed resize-none rounded border border-transparent bg-transparent p-1.5 -ml-1.5 hover:border-border hover:bg-muted/30 focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                  rows={1}
                />
                {item.variations.length > 0 && (
                  <div className="flex gap-1 shrink-0 flex-wrap">
                    {item.variations.map((v) => (
                      <Badge key={v} variant="outline" className="text-[10px] h-4 px-1.5">
                        {v}
                      </Badge>
                    ))}
                  </div>
                )}
                {isManual ? (
                  <button
                    type="button"
                    onClick={() => removeManualItem(itemId)}
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    title={t`Remove manual glossary term`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : isPruned ? (
                  <button
                    type="button"
                    onClick={() => togglePruned(itemId, false)}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    title={t`Restore this term — it will be eligible again on the next regeneration.`}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => togglePruned(itemId, true)}
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    title={t`Prune this term — it will be hidden from output and excluded from future regenerations.`}
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )
          })
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
      className="shrink-0 w-24 text-sm rounded border border-transparent bg-transparent p-1.5 hover:border-border hover:bg-muted/30 focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
    />
  )
}
