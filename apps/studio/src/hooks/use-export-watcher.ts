import { useState, useEffect, useCallback, createContext, useContext } from "react"
import type { I18n } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { useLingui } from "@lingui/react"
import { api } from "@/api/client"
import { useBookTasks } from "./use-book-tasks"
import type { ExportFeatureToggles } from "./use-export-features"

type ExportFormat = "project" | "webpub" | "scorm" | "adt"

interface PendingExport {
  taskId: string
  format: ExportFormat
  features?: ExportFeatureToggles
}

interface ExportError {
  format: ExportFormat
  message: string
}

export interface ExportWatcherValue {
  startExport: (format: ExportFormat, features?: ExportFeatureToggles) => void
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
  const { i18n } = useLingui()
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
      triggerExportDownload(label, format, i18n).catch((err) => {
        setError({ format, message: err instanceof Error ? err.message : String(err) })
      })
    } else if (task.status === "failed") {
      setError({
        format: pendingExport.format,
        message: task.error ?? i18n._(msg`Export preparation failed`),
      })
      setPendingExport(null)
    }
  }, [pendingExport, getTask, i18n, label])

  const startExport = useCallback(
    (format: ExportFormat, features?: ExportFeatureToggles) => {
      setError(null)
      api.prepareExport(label, format, features).then(
        (result) => {
          if (result.taskId) {
            setPendingExport({ taskId: result.taskId, format, features })
          } else {
            // Sync fallback (no task system) — download immediately
            triggerExportDownload(label, format, i18n).catch((err) => {
              setError({ format, message: err instanceof Error ? err.message : String(err) })
            })
          }
        },
        (err) => {
          setError({ format, message: err instanceof Error ? err.message : String(err) })
        }
      )
    },
    [i18n, label]
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
  format: ExportFormat,
  i18n: I18n,
): Promise<void> {
  let blob: Blob | null
  if (format === "project") {
    blob = await api.exportProject(label)
  } else if (format === "webpub") {
    blob = await api.exportWebpub(label)
  } else if (format === "scorm") {
    blob = await api.exportScorm(label)
  } else {
    blob = await api.exportAdt(label)
  }

  if (!blob) return // Browser mode — direct download already triggered

  // Tauri mode: save via native OS dialog
  const { save } = await import("@tauri-apps/plugin-dialog")
  const { writeFile } = await import("@tauri-apps/plugin-fs")

  const ext = format === "webpub" ? "webpub" : "zip"
  const defaultPath =
    format === "scorm" ? `${label}-scorm.zip`
    : format === "adt" ? `${label}-adt.zip`
    : format === "project" ? `${label}-project.zip`
    : `${label}.${ext}`
  const filterName =
    format === "webpub"
      ? i18n._(msg`WebPub`)
      : format === "scorm"
        ? i18n._(msg`SCORM Package`)
        : format === "adt"
          ? i18n._(msg`ADT Package`)
          : format === "project"
            ? i18n._(msg`Project Archive`)
            : i18n._(msg`ZIP Archive`)

  const savePath = await save({
    defaultPath,
    filters: [{ name: filterName, extensions: [ext] }],
  })

  if (savePath) {
    const buf = await blob.arrayBuffer()
    await writeFile(savePath, new Uint8Array(buf))
  }
}
