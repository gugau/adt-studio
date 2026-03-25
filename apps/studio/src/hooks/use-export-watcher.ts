import { useState, useEffect, useCallback, createContext, useContext } from "react"
import { api } from "@/api/client"
import { useBookTasks } from "./use-book-tasks"

type ExportFormat = "book" | "webpub" | "scorm"

interface PendingExport {
  taskId: string
  format: ExportFormat
}

interface ExportError {
  format: ExportFormat
  message: string
}

export interface ExportWatcherValue {
  startExport: (format: ExportFormat) => void
  isPreparing: boolean
  preparingFormat: ExportFormat | null
  error: ExportError | null
}

const ExportWatcherCtx = createContext<ExportWatcherValue | null>(null)
export const ExportWatcherProvider = ExportWatcherCtx.Provider

export function useExportWatcher(): ExportWatcherValue {
  const ctx = useContext(ExportWatcherCtx)
  if (!ctx) throw new Error("useExportWatcher must be used within ExportWatcherProvider")
  return ctx
}

export function useExportWatcherSetup(label: string): ExportWatcherValue {
  const [pendingExport, setPendingExport] = useState<PendingExport | null>(null)
  const [error, setError] = useState<ExportError | null>(null)
  const { getTask } = useBookTasks(label)

  // Watch for task completion via the tasks cache (updated by SSE)
  useEffect(() => {
    if (!pendingExport) return
    const task = getTask(pendingExport.taskId)
    if (!task) return
    if (task.status === "completed") {
      const format = pendingExport.format
      setPendingExport(null)
      triggerExportDownload(label, format).catch((err) => {
        setError({ format, message: err instanceof Error ? err.message : String(err) })
      })
    } else if (task.status === "failed") {
      setError({
        format: pendingExport.format,
        message: task.error ?? "Export preparation failed",
      })
      setPendingExport(null)
    }
  }, [pendingExport, getTask, label])

  const startExport = useCallback(
    (format: ExportFormat) => {
      setError(null)
      api.prepareExport(label, format).then(
        (result) => {
          if (result.taskId) {
            setPendingExport({ taskId: result.taskId, format })
          } else {
            // Sync fallback (no task system) — download immediately
            triggerExportDownload(label, format).catch((err) => {
              setError({ format, message: err instanceof Error ? err.message : String(err) })
            })
          }
        },
        (err) => {
          setError({ format, message: err instanceof Error ? err.message : String(err) })
        }
      )
    },
    [label]
  )

  return {
    startExport,
    isPreparing: pendingExport !== null,
    preparingFormat: pendingExport?.format ?? null,
    error,
  }
}

async function triggerExportDownload(
  label: string,
  format: ExportFormat
): Promise<void> {
  let blob: Blob | null
  if (format === "book") {
    blob = await api.exportBook(label)
  } else if (format === "webpub") {
    blob = await api.exportWebpub(label)
  } else {
    blob = await api.exportScorm(label)
  }

  if (!blob) return // Browser mode — direct download already triggered

  // Tauri mode: save via native OS dialog
  const { save } = await import("@tauri-apps/plugin-dialog")
  const { writeFile } = await import("@tauri-apps/plugin-fs")

  const ext = format === "webpub" ? "webpub" : "zip"
  const defaultPath = format === "scorm" ? `${label}-scorm.zip` : `${label}.${ext}`
  const filterName =
    format === "webpub" ? "WebPub" : format === "scorm" ? "SCORM Package" : "ZIP Archive"

  const savePath = await save({
    defaultPath,
    filters: [{ name: filterName, extensions: [ext] }],
  })

  if (savePath) {
    const buf = await blob.arrayBuffer()
    await writeFile(savePath, new Uint8Array(buf))
  }
}
