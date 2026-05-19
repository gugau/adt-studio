import { useCallback } from "react"
import { RotateCcw } from "lucide-react"
import { useLingui } from "@lingui/react/macro"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useApiKey } from "@/hooks/use-api-key"
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
  const status = stageState("easy-read")
  const isStageRunning = status === "running" || status === "queued"

  const handleRun = useCallback(() => {
    if (!hasApiKey || isRunning) return
    queueRun({ fromStage: "easy-read", toStage: "easy-read", apiKey })
  }, [apiKey, hasApiKey, isRunning, queueRun])

  return (
    <div className="space-y-4 p-4">
      <StageRunCard
        stageSlug="easy-read"
        isRunning={isStageRunning}
        onRun={handleRun}
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

      <EasyReadEditor
        bookLabel={bookLabel}
        selectedPageId={selectedPageId}
        isRunning={isRunning}
        hasApiKey={hasApiKey}
        apiKey={apiKey}
      />
    </div>
  )
}
