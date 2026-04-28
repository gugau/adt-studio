import { useState, useEffect, useRef, useMemo } from "react"
import { Trans } from "@lingui/react/macro"
import { useLingui } from "@lingui/react/macro"
import { Trash2, ChevronsDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn, isElectron } from "@/lib/utils"

const MAX_ENTRIES = 2000

interface ApiLogsTabProps {
  label: string
}

export function ApiLogsTab({ label: _label }: ApiLogsTabProps) {
  const { t } = useLingui()
  const [entries, setEntries] = useState<ElectronApiLogEntry[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isElectronApp = isElectron()
  const debugMode = true;

  useEffect(() => {
    if (!isElectronApp || debugMode !== true) return
    const unsubscribe = window.api.onApiLog((entry: ElectronApiLogEntry) => {
      setEntries((prev) => {
        const next = [...prev, entry]
        return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next
      })
    })
    return unsubscribe
  }, [debugMode])

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" })
    }
  }, [entries, autoScroll])

  if (!isElectronApp) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        <Trans>API logs are only available in the desktop app.</Trans>
      </div>
    )
  }

  if (!debugMode) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground space-y-2">
        <p>
          <Trans>Debug mode is not enabled.</Trans>
        </p>
        <p className="text-xs">
          <Trans>Launch the app with</Trans>{" "}
          <code className="font-mono bg-muted px-1 py-0.5 rounded">ADT_DEBUG=1</code>{" "}
          <Trans>to stream API logs here.</Trans>
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border sticky top-0 bg-background z-20">
        <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium shrink-0">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          <Trans>Live</Trans>
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {entries.length.toLocaleString()} {t`lines`}
          {entries.length >= MAX_ENTRIES && (
            <span className="ml-1 text-yellow-500">
              ({t`capped at ${String(MAX_ENTRIES)}`})
            </span>
          )}
        </span>
        <div className="flex-1" />
        <Button
          variant={autoScroll ? "secondary" : "ghost"}
          size="sm"
          className="h-6 text-xs gap-1"
          onClick={() => setAutoScroll((v) => !v)}
        >
          <ChevronsDown className="h-3 w-3" />
          <Trans>Auto-scroll</Trans>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setEntries([])}
          title={t`Clear`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <div className="font-mono text-[11px] bg-secondary text-foreground min-h-[calc(100vh-10rem)] p-3 leading-relaxed">
        {entries.length === 0 && (
          <span className="text-muted-foreground">
            <Trans>Waiting for API output…</Trans>
          </span>
        )}
        {entries.map((entry, i) => (
          <div
            key={i}
            className={cn(
              "whitespace-pre-wrap",
              entry.stream === "stderr" && "text-red-400",
            )}
          >
            <span className="text-muted-foreground select-none mr-2 tabular-nums">
              {new Date(entry.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
            {entry.line}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
