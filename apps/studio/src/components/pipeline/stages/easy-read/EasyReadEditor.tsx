import { useEffect, useMemo, useRef, useState } from "react"
import { Check, FileText, Loader2, RotateCcw, Search, Sparkles, X } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Trans, useLingui } from "@lingui/react/macro"
import { api } from "@/api/client"
import type { EasyReadSectionBlock } from "@/api/client"
import { useStepHeader } from "../../components/StepViewRouter"
import { StageEmptyState } from "../../components/StageEmptyState"

export function EasyReadEditor({
  bookLabel,
  selectedPageId,
  onSelectPage,
  isRunning,
  hasApiKey,
  onRegenerate,
}: {
  bookLabel: string
  selectedPageId?: string
  onSelectPage?: (pageId: string | null) => void
  isRunning: boolean
  hasApiKey: boolean
  onRegenerate: () => void
}) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const { setExtra } = useStepHeader()
  const { data } = useQuery({
    queryKey: ["books", bookLabel, "easy-read"],
    queryFn: () => api.getEasyRead(bookLabel),
    enabled: !!bookLabel,
  })
  const [draftBlocks, setDraftBlocks] = useState<EasyReadSectionBlock[] | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const blocks = draftBlocks ?? data?.blocks ?? []
  const dirty = draftBlocks !== null

  const pageScopedBlocks = useMemo(
    () => (selectedPageId ? blocks.filter((block) => block.pageId === selectedPageId) : blocks),
    [blocks, selectedPageId],
  )

  const sectionTypes = useMemo(() => {
    const counts = new Map<string, number>()
    for (const block of pageScopedBlocks) {
      counts.set(block.sectionType, (counts.get(block.sectionType) ?? 0) + 1)
    }
    return Array.from(counts, ([value, count]) => ({ value, count }))
  }, [pageScopedBlocks])

  const activeTypeFilter = sectionTypes.some((s) => s.value === typeFilter) ? typeFilter : "all"

  const filteredBlocks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return pageScopedBlocks.filter((block) => {
      if (activeTypeFilter !== "all" && block.sectionType !== activeTypeFilter) return false
      if (!query) return true
      if (block.sectionType.toLowerCase().includes(query)) return true
      return block.entries.some(
        (entry) =>
          entry.originalText.toLowerCase().includes(query) ||
          entry.text.toLowerCase().includes(query),
      )
    })
  }, [pageScopedBlocks, activeTypeFilter, searchQuery])

  const filtersActive = activeTypeFilter !== "all" || searchQuery.trim().length > 0
  const clearFilters = () => {
    setSearchQuery("")
    setTypeFilter("all")
  }

  useEffect(() => {
    setDraftBlocks(null)
  }, [data?.version])

  const invalidateEasyReadDependents = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "easy-read"] }),
      queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "text-catalog"] }),
      queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "tts"] }),
      queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "step-status"] }),
      queryClient.invalidateQueries({ queryKey: ["package-adt-status", bookLabel] }),
      queryClient.invalidateQueries({ queryKey: ["debug", "accessibility", bookLabel] }),
      queryClient.invalidateQueries({ queryKey: ["debug", "versions", bookLabel, "accessibility-assessment", "book"] }),
    ])
  }

  const saveMutation = useMutation({
    mutationFn: async (nextBlocks: EasyReadSectionBlock[]) =>
      api.updateEasyRead(bookLabel, {
        blocks: nextBlocks,
        generatedAt: data?.generatedAt ?? new Date().toISOString(),
      }),
    onSuccess: async () => {
      setDraftBlocks(null)
      await invalidateEasyReadDependents()
    },
  })

  const mutationError = getErrorMessage(saveMutation.error)

  const updateEntry = (
    blockKey: { pageId: string; sectionId: string; sectionIndex: number },
    easyReadId: string,
    text: string,
  ) => {
    const base = draftBlocks ?? data?.blocks ?? []
    setDraftBlocks(base.map((block) => {
      if (
        block.pageId !== blockKey.pageId ||
        block.sectionId !== blockKey.sectionId ||
        block.sectionIndex !== blockKey.sectionIndex
      ) {
        return block
      }
      return {
        ...block,
        entries: block.entries.map((entry) =>
          entry.easyReadId === easyReadId ? { ...entry, text } : entry
        ),
      }
    }))
  }

  // Header controls live in the colored step header (same pattern as Quizzes /
  // Captions). Refs keep the handlers fresh without re-running the effect on
  // every render.
  const actions = useRef({ save: () => {}, discard: () => {}, regenerate: () => {} })
  actions.current = {
    save: () => saveMutation.mutate(blocks),
    discard: () => setDraftBlocks(null),
    regenerate: onRegenerate,
  }

  const version = data?.version
  const saving = saveMutation.isPending
  const blockCount = filteredBlocks.length
  const regenerateDisabled = !hasApiKey || isRunning || dirty

  useEffect(() => {
    setExtra(
      <div className="ml-auto flex items-center gap-1.5">
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] tabular-nums">
          {selectedPageId
            ? t`${String(blockCount)} on page`
            : t`${String(blockCount)} blocks`}
        </span>
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
        ) : dirty ? (
          <>
            <button
              type="button"
              onClick={() => actions.current.discard()}
              className="rounded bg-black/15 px-2 py-0.5 text-[10px] font-medium text-white transition-colors hover:bg-black/25 cursor-pointer"
            >
              {t`Discard`}
            </button>
            <button
              type="button"
              onClick={() => actions.current.save()}
              className="flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[10px] font-medium text-fuchsia-800 transition-colors hover:bg-white/80 cursor-pointer"
            >
              <Check className="h-3 w-3" />
              {t`Save`}
            </button>
          </>
        ) : (
          <>
            {version != null && (
              <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] tabular-nums text-white">
                v{version}
              </span>
            )}
            <button
              type="button"
              onClick={() => actions.current.regenerate()}
              disabled={regenerateDisabled}
              title={dirty ? t`Save or discard edits before regenerating` : t`Regenerate Easy Read`}
              className="flex items-center gap-1 rounded bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white transition-colors hover:bg-white/30 disabled:cursor-default disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              {t`Regenerate`}
            </button>
          </>
        )}
      </div>,
    )
    return () => setExtra(null)
  }, [setExtra, t, selectedPageId, blockCount, saving, dirty, version, regenerateDisabled])

  if (selectedPageId && pageScopedBlocks.length === 0) {
    return (
      <StageEmptyState
        icon={FileText}
        color="fuchsia"
        title={t`No Easy Read for this page`}
        subtitle={t`This page has no simplified text blocks`}
        cta={
          onSelectPage ? (
            <button
              type="button"
              onClick={() => onSelectPage(null)}
              className="text-xs font-medium text-fuchsia-600 transition-colors hover:text-fuchsia-700 hover:underline cursor-pointer"
            >
              {t`Show all pages`}
            </button>
          ) : undefined
        }
      />
    )
  }

  const chipBase =
    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-all duration-200 cursor-pointer"

  return (
    <div className="flex flex-1 flex-col">
      <EasyReadHintBanner />

      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-background/95 px-4 py-2.5 backdrop-blur-md">
        {sectionTypes.length > 1 && (
          <div className="inline-flex items-center rounded-lg border border-border/70 bg-muted/40 p-0.5">
            {[{ value: "all", count: pageScopedBlocks.length }, ...sectionTypes].map((opt) => {
              const active = activeTypeFilter === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTypeFilter(opt.value)}
                  aria-pressed={active}
                  className={`${chipBase} ${
                    active
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="capitalize">
                    {opt.value === "all" ? t`All` : opt.value.replace(/_/g, " ")}
                  </span>
                  <span
                    className={`tabular-nums text-[11px] ${
                      active ? "text-fuchsia-700" : "text-muted-foreground/60"
                    }`}
                  >
                    {opt.count}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t`Search original or Easy Read text…`}
            className="h-8 w-full rounded-md border border-border/70 bg-background pl-8 pr-8 text-[12px] transition-colors placeholder:text-muted-foreground/60 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-200"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label={t`Clear search`}
              className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {selectedPageId && onSelectPage && (
          <button
            type="button"
            onClick={() => onSelectPage(null)}
            className="ml-auto text-[12px] font-medium text-fuchsia-600 transition-colors hover:text-fuchsia-700 hover:underline cursor-pointer"
          >
            {t`Show all pages`}
          </button>
        )}
      </div>

      {mutationError && (
        <div className="mx-4 mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {mutationError}
        </div>
      )}

      {filteredBlocks.length === 0 ? (
        <div className="flex flex-1 flex-col py-12">
          <StageEmptyState
            icon={Search}
            color="fuchsia"
            title={t`No matching blocks`}
            subtitle={t`Try a different search or filter`}
            cta={
              filtersActive ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs font-medium text-fuchsia-600 transition-colors hover:text-fuchsia-700 hover:underline cursor-pointer"
                >
                  {t`Clear filters`}
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4 pb-12 pt-3">
          {filteredBlocks.map((block) => (
            <div
              key={`${block.pageId}:${block.sectionId}:${block.sectionIndex}`}
              className="overflow-hidden rounded-md border bg-card transition-shadow duration-200 hover:shadow-sm"
            >
              <div className="flex items-center justify-between gap-2 border-b bg-muted/20 px-4 py-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {t`Page ${String(block.pageNumber)} · Section ${String(block.sectionIndex + 1)}`}
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">
                  {block.sectionType.replace(/_/g, " ")}
                </span>
              </div>
              <div className="divide-y">
                {block.entries.map((entry) => (
                  <div key={entry.easyReadId} className="grid gap-3 px-4 py-3 md:grid-cols-2">
                    <div>
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                        <Trans>Original</Trans>
                      </p>
                      <p className="text-[13px] leading-relaxed text-muted-foreground">
                        {entry.originalText}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-fuchsia-600">
                        <Trans>Easy Read</Trans>
                      </p>
                      <textarea
                        value={entry.text}
                        onChange={(event) => updateEntry(block, entry.easyReadId, event.target.value)}
                        disabled={isRunning}
                        rows={Math.max(2, Math.min(6, Math.ceil((entry.text.length || 1) / 60)))}
                        className="w-full resize-y rounded-md border border-transparent bg-transparent p-1.5 text-[13px] leading-relaxed transition-colors hover:border-border hover:bg-muted/30 focus:border-fuchsia-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-fuchsia-200 disabled:opacity-60"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EasyReadHintBanner() {
  return (
    <div className="mx-4 mt-3 flex items-start gap-3 rounded-lg border border-fuchsia-200/70 bg-fuchsia-50/60 px-4 py-3">
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-fuchsia-100 text-fuchsia-700">
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-fuchsia-900">
          <Trans>How Easy Read works</Trans>
        </span>
        <p className="text-[12px] leading-relaxed text-fuchsia-800/80">
          <Trans>
            Each block was simplified by AI. Edit any Easy Read text to refine it
            against the original, then Save. Changes are stored as a new version,
            so you can always roll back or regenerate.
          </Trans>
        </p>
      </div>
    </div>
  )
}

function getErrorMessage(error: unknown): string | null {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return null
}
