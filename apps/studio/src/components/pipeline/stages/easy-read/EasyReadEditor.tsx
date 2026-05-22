import { useEffect, useState } from "react"
import { Loader2, RotateCcw, Save, WandSparkles } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useLingui } from "@lingui/react/macro"
import { api } from "@/api/client"
import type { EasyReadSectionBlock } from "@/api/client"
import { Button } from "@/components/ui/button"

export function EasyReadEditor({
  bookLabel,
  selectedPageId,
  isRunning,
  hasApiKey,
  apiKey,
}: {
  bookLabel: string
  selectedPageId?: string
  isRunning: boolean
  hasApiKey: boolean
  apiKey: string
}) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["books", bookLabel, "easy-read"],
    queryFn: () => api.getEasyRead(bookLabel),
    enabled: !!bookLabel,
  })
  const [draftBlocks, setDraftBlocks] = useState<EasyReadSectionBlock[] | null>(null)
  const blocks = draftBlocks ?? data?.blocks ?? []
  const visibleBlocks = selectedPageId
    ? blocks.filter((block) => block.pageId === selectedPageId)
    : blocks
  const dirty = draftBlocks !== null

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

  const regenerateMutation = useMutation({
    mutationFn: () => api.regenerateEasyRead(bookLabel, apiKey),
    onSuccess: async () => {
      setDraftBlocks(null)
      await invalidateEasyReadDependents()
    },
  })
  const mutationError =
    getErrorMessage(regenerateMutation.error) ?? getErrorMessage(saveMutation.error)

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

  if (isLoading) {
    return (
      <div className="rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" />
        {t`Loading Easy Read...`}
      </div>
    )
  }

  if (!data || data.blocks.length === 0) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2">
        <div>
          <p className="text-xs font-medium">{t`Easy Read`}</p>
          <p className="text-xs text-muted-foreground">{t`Generate editable Easy Read blocks for the ADT toggle.`}</p>
          {mutationError && <p className="mt-1 text-xs text-destructive">{mutationError}</p>}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          disabled={!hasApiKey || isRunning || regenerateMutation.isPending}
          onClick={() => regenerateMutation.mutate()}
        >
          {regenerateMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <WandSparkles className="mr-1 h-3 w-3" />}
          {t`Generate`}
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
        <div>
          <p className="text-xs font-medium">
            {t`Easy Read`}
            {data.version && <span className="ml-1.5 text-[10px] text-muted-foreground">v{data.version}</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            {selectedPageId
              ? t`${String(visibleBlocks.length)} section block(s) on this page`
              : t`${String(blocks.length)} section block(s)`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {dirty && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setDraftBlocks(null)}
              disabled={saveMutation.isPending}
            >
              {t`Discard`}
            </Button>
          )}
          {dirty && (
            <Button
              type="button"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => saveMutation.mutate(blocks)}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
              {t`Save`}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={!hasApiKey || isRunning || regenerateMutation.isPending || dirty}
            onClick={() => regenerateMutation.mutate()}
            title={dirty ? t`Save or discard edits before regenerating` : t`Regenerate Easy Read`}
          >
            {regenerateMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RotateCcw className="mr-1 h-3 w-3" />}
            {t`Regenerate`}
          </Button>
        </div>
      </div>

      {mutationError && (
        <div className="border-b px-3 py-2 text-xs text-destructive">
          {mutationError}
        </div>
      )}

      {visibleBlocks.length === 0 ? (
        <div className="px-3 py-3 text-xs text-muted-foreground">
          {t`No Easy Read block is available for this page.`}
        </div>
      ) : (
        <div className="max-h-72 overflow-auto divide-y">
          {visibleBlocks.map((block) => (
            <div key={`${block.pageId}:${block.sectionId}:${block.sectionIndex}`} className="px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {t`Page ${String(block.pageNumber)} - Section ${String(block.sectionIndex + 1)}`}
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {block.sectionType.replace(/_/g, " ")}
                </span>
              </div>
              <div className="space-y-2">
                {block.entries.map((entry) => (
                  <div key={entry.easyReadId} className="grid gap-2 md:grid-cols-2">
                    <div className="rounded border bg-muted/30 px-2 py-1.5">
                      <p className="mb-1 text-[10px] text-muted-foreground">{entry.sourceId}</p>
                      <p className="text-xs leading-relaxed">{entry.originalText}</p>
                    </div>
                    <textarea
                      value={entry.text}
                      onChange={(event) => updateEntry(block, entry.easyReadId, event.target.value)}
                      disabled={isRunning}
                      rows={Math.max(2, Math.min(5, Math.ceil(entry.text.length / 70)))}
                      className="min-h-16 resize-y rounded border bg-background px-2 py-1.5 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
                    />
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

function getErrorMessage(error: unknown): string | null {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return null
}
