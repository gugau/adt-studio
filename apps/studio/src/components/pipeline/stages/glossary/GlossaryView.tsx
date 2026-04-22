import { useState, useEffect, useRef, useCallback } from "react"
import { Check, ChevronDown, Loader2, Plus, Trash2 } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/api/client"
import type { GlossaryItem, GlossaryOutput, VersionEntry } from "@/api/client"
import { useGlossary } from "@/hooks/use-glossary"
import { useStepHeader } from "../../components/StepViewRouter"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { StageRunCard } from "../../components/StageRunCard"
import { useLingui } from "@lingui/react/macro"


type GlossaryData = Omit<GlossaryOutput, "version">

function createEmptyGlossary(): GlossaryData {
  return {
    items: [],
    pageCount: 0,
    generatedAt: new Date().toISOString(),
  }
}

function normalizeGlossaryWord(word: string): string {
  return word.trim().toLocaleLowerCase()
}

function createManualGlossaryId(): string {
  return `gl_manual_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function parseGlossaryList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function VersionPicker({
  currentVersion,
  saving,
  dirty,
  bookLabel,
  onPreview,
  onSave,
  onDiscard,
}: {
  currentVersion: number | null
  saving: boolean
  dirty: boolean
  bookLabel: string
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
          className="flex items-center gap-1 text-[10px] font-medium rounded px-2 py-0.5 bg-white text-green-800 hover:bg-white/80 cursor-pointer transition-colors"
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
        <div className="absolute right-0 top-full mt-1 z-20 bg-popover border rounded shadow-md min-w-[80px] py-1">
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
  const [newWord, setNewWord] = useState("")
  const [newDefinition, setNewDefinition] = useState("")
  const [newVariations, setNewVariations] = useState("")
  const [newEmojis, setNewEmojis] = useState("")
  const [addError, setAddError] = useState<string | null>(null)

  // Reset pending when data changes
  useEffect(() => {
    setPending(null)
  }, [data?.version])

  const effective = pending ?? data ?? null
  const items = effective?.items ?? []
  const dirty = pending != null
  const currentVersion = data?.version ?? null

  const openAddDialog = useCallback(() => {
    setNewWord("")
    setNewDefinition("")
    setNewVariations("")
    setNewEmojis("")
    setAddError(null)
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
        <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5">{t`${String(items.length)} terms`}</span>
        <Button
          size="sm"
          className="h-6 px-2 text-[10px] bg-white/10 text-white hover:bg-white/20"
          onClick={openAddDialog}
        >
          <Plus className="mr-1 h-3 w-3" />
          {t`Add Term`}
        </Button>
        <VersionPicker
          currentVersion={currentVersion}
          saving={saving}
          dirty={dirty}
          bookLabel={bookLabel}
          onPreview={(d) => setPending(d as GlossaryData)}
          onSave={() => saveRef.current()}
          onDiscard={() => setPending(null)}
        />
      </div>
    )
    return () => setExtra(null)
  }, [items.length, saving, dirty, bookLabel, currentVersion, openAddDialog, t, setExtra])

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

  const removeManualItem = (itemId: string) => {
    const base = pending ?? data ?? createEmptyGlossary()
    setPending({
      ...base,
      generatedAt: base.generatedAt || new Date().toISOString(),
      items: base.items.filter((item) => (item.id ?? item.word) !== itemId),
    })
  }

  const addManualItem = () => {
    const word = newWord.trim()
    const definition = newDefinition.trim()
    if (!word || !definition) {
      setAddError(t`Word and definition are required.`)
      return
    }

    const base = pending ?? data ?? createEmptyGlossary()
    if (base.items.some((item) => normalizeGlossaryWord(item.word) === normalizeGlossaryWord(word))) {
      setAddError(t`A glossary term with this word already exists.`)
      return
    }

    const manualItem: GlossaryItem = {
      id: createManualGlossaryId(),
      source: "manual",
      word,
      definition,
      variations: parseGlossaryList(newVariations),
      emojis: parseGlossaryList(newEmojis),
    }

    setPending({
      ...base,
      generatedAt: base.generatedAt || new Date().toISOString(),
      items: [...base.items, manualItem],
    })
    setShowAddDialog(false)
  }

  if (isLoading && !effective) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span className="text-sm">{t`Loading glossary...`}</span>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="p-4 space-y-4">
        <StageRunCard
          stageSlug="glossary"
          isRunning={glossaryRunning}
          completed={glossaryDone}
          onRun={handleRunGlossary}
          disabled={!hasApiKey || glossaryRunning}
        />
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t`Add Glossary Term`}</DialogTitle>
              <DialogDescription>
                {t`Create a manual glossary entry that stays in the book even if AI glossary generation is rerun.`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="glossary-word">{t`Word`}</Label>
                <Input
                  id="glossary-word"
                  value={newWord}
                  onChange={(e) => { setNewWord(e.target.value); setAddError(null) }}
                  placeholder={t`Photosynthesis`}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="glossary-definition">{t`Definition`}</Label>
                <Textarea
                  id="glossary-definition"
                  value={newDefinition}
                  onChange={(e) => { setNewDefinition(e.target.value); setAddError(null) }}
                  rows={4}
                  placeholder={t`Explain the term in simple language.`}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="glossary-variations">{t`Variations`}</Label>
                <Input
                  id="glossary-variations"
                  value={newVariations}
                  onChange={(e) => setNewVariations(e.target.value)}
                  placeholder={t`photosynthetic, photosynthesizing`}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="glossary-emojis">{t`Emoji`}</Label>
                <Input
                  id="glossary-emojis"
                  value={newEmojis}
                  onChange={(e) => setNewEmojis(e.target.value)}
                  placeholder={t`🌿`}
                />
              </div>
              {addError && (
                <p className="text-sm text-destructive">{addError}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                {t`Cancel`}
              </Button>
              <Button onClick={addManualItem}>
                {t`Add Term`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div
          key={item.id ?? item.word}
          className="flex items-start gap-3 px-3 py-2.5 rounded-md border bg-card"
        >
          <div className="shrink-0 w-32">
            <span className="text-sm font-medium">{item.word}</span>
            {item.source === "manual" && (
              <Badge variant="secondary" className="ml-2 text-[10px] h-4 px-1.5">
                {t`manual`}
              </Badge>
            )}
            {item.emojis.length > 0 && (
              <span className="ml-1.5">{item.emojis.join(" ")}</span>
            )}
          </div>
          <Textarea
            value={item.definition}
            onChange={(e) => updateDefinition(item.id ?? item.word, e.target.value)}
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
          {item.source === "manual" && (
            <button
              type="button"
              onClick={() => removeManualItem(item.id ?? item.word)}
              className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
              title={t`Remove manual glossary term`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t`Add Glossary Term`}</DialogTitle>
            <DialogDescription>
              {t`Create a manual glossary entry that stays in the book even if AI glossary generation is rerun.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="glossary-word">{t`Word`}</Label>
              <Input
                id="glossary-word"
                value={newWord}
                onChange={(e) => { setNewWord(e.target.value); setAddError(null) }}
                placeholder={t`Photosynthesis`}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="glossary-definition">{t`Definition`}</Label>
              <Textarea
                id="glossary-definition"
                value={newDefinition}
                onChange={(e) => { setNewDefinition(e.target.value); setAddError(null) }}
                rows={4}
                placeholder={t`Explain the term in simple language.`}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="glossary-variations">{t`Variations`}</Label>
              <Input
                id="glossary-variations"
                value={newVariations}
                onChange={(e) => setNewVariations(e.target.value)}
                placeholder={t`photosynthetic, photosynthesizing`}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="glossary-emojis">{t`Emoji`}</Label>
              <Input
                id="glossary-emojis"
                value={newEmojis}
                onChange={(e) => setNewEmojis(e.target.value)}
                placeholder={t`🌿`}
              />
            </div>
            {addError && (
              <p className="text-sm text-destructive">{addError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              {t`Cancel`}
            </Button>
            <Button onClick={addManualItem}>
              {t`Add Term`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
