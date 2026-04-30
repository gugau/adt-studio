import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { isElectron } from "@/lib/utils"
import { Trans } from "@lingui/react/macro"


interface DebugTabsNavProps {
  isRunning: boolean
}

export function DebugTabsNav({ isRunning }: DebugTabsNavProps) {
  return (
    <TabsList className="h-auto min-w-0 flex-wrap justify-start gap-1 rounded-lg border border-border/60 bg-muted/80 p-1 text-foreground shadow-sm">
      <TabsTrigger value="stats" className="text-xs px-2 py-1">
        <Trans>
          Stats
        </Trans>
      </TabsTrigger>
      <TabsTrigger value="logs" className="text-xs px-2 py-1">
        <Trans>
          Logs
        </Trans>
        {isRunning ? (
          <span className="ml-1 inline-flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        ) : null}
      </TabsTrigger>
      <TabsTrigger value="config" className="text-xs px-2 py-1">
        <Trans>
          Config
        </Trans>
      </TabsTrigger>
      <TabsTrigger value="versions" className="text-xs px-2 py-1">
        <Trans>
          Versions
        </Trans>
      </TabsTrigger>
      {isElectron() && (
        <TabsTrigger value="api-logs" className="text-xs px-2 py-1">
          <Trans>
            API Logs
          </Trans>
        </TabsTrigger>
      )}
    </TabsList>
  )
}
