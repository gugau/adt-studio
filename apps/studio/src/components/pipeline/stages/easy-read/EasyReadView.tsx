import { useCallback } from "react"
import { Loader2, RotateCcw } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { useLingui } from "@lingui/react/macro"
import { api } from "@/api/client"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useApiKey } from "@/hooks/use-api-key"
import { useBookConfig, useUpdateBookConfig } from "@/hooks/use-book-config"
import { useBookRun } from "@/hooks/use-book-run"
import { StageRunCard } from "../../components/StageRunCard"
import { EasyReadEditor } from "./EasyReadEditor"

export function EasyReadView({
  bookLabel,
  selectedPageId,
}: {
  bookLabel: string
  selectedPageId?: string
}) {
  const { t } = useLingui()
  const { apiKey, hasApiKey } = useApiKey()
  const { isRunning, queueRun, stageState } = useBookRun()
  const { data: bookConfigData } = useBookConfig(bookLabel)
  const updateConfig = useUpdateBookConfig()
  const status = stageState("easy-read")
  const isStageRunning = status === "running" || status === "queued"

  const { data, isLoading } = useQuery({
    queryKey: ["books", bookLabel, "easy-read"],
    queryFn: () => api.getEasyRead(bookLabel),
    enabled: !!bookLabel,
  })
  const hasBlocks = (data?.blocks?.length ?? 0) > 0

  // Generate/regenerate through the normal stage runner so the run shows up in
  // the bottom-left progress like every other stage. The easy-read stage is
  // gated on `easy_read.enabled`, so make sure it is on before queueing.
  const runEasyRead = useCallback(async () => {
    if (!hasApiKey || isRunning) return
    const current = (bookConfigData?.config ?? {}) as Record<string, unknown>
    const easyReadCfg = (current.easy_read ?? {}) as Record<string, unknown>
    if (easyReadCfg.enabled !== true) {
      await updateConfig.mutateAsync({
        label: bookLabel,
        config: { easy_read: { ...easyReadCfg, enabled: true } },
      })
    }
    queueRun({ fromStage: "easy-read", toStage: "easy-read", apiKey })
  }, [apiKey, hasApiKey, isRunning, bookConfigData?.config, bookLabel, updateConfig, queueRun])

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        <span className="text-sm">{t`Loading Easy Read...`}</span>
      </div>
    )
  }

  // Before the stage has produced any blocks, show only the run card — same
  // pattern as the other stages (e.g. GlossaryView): the card disappears
  // once the step has data and the editor takes over.
  if (!hasBlocks) {
    return (
      <div className="space-y-4 p-4">
        <StageRunCard
          stageSlug="easy-read"
          isRunning={isStageRunning}
          completed={status === "done"}
          onRun={() => void runEasyRead()}
          disabled={!hasApiKey || isRunning}
        />

        {!hasApiKey && (
          <Alert className="max-w-xl rounded-md">
            <AlertDescription className="flex items-center justify-between gap-3 text-xs">
              <span>{t`Add an API key to generate Easy Read content.`}</span>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled>
                <RotateCcw className="mr-1 h-3 w-3" />
                {t`Generate`}
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <EasyReadEditor
        bookLabel={bookLabel}
        selectedPageId={selectedPageId}
        isRunning={isRunning || isStageRunning}
        hasApiKey={hasApiKey}
        onRegenerate={() => void runEasyRead()}
      />
    </div>
  )
}
