import { STAGE_ORDER, type ProgressEvent } from "@adt/types"
import type { StageName } from "@adt/types"
import type { BookEventBus } from "./book-event-bus.js"

export type StageRunStatus = "idle" | "running" | "completed" | "failed" | "cancelled"

export interface StageRunJob {
  label: string
  status: StageRunStatus
  fromStage: string
  toStage: string
  error?: string
  startedAt?: number
  completedAt?: number
}

export interface QueuedStageRun {
  id: string
  fromStage: string
  toStage: string
  options: StageRunOptions
}

interface BookRunState {
  active: StageRunJob | null
  queue: QueuedStageRun[]
  /** AbortController for the active run, used to cancel it. */
  controller: AbortController | null
}

export interface BookRunStatus {
  active: StageRunJob | null
  queue: Array<{ id: string; fromStage: string; toStage: string }>
}

export interface StageRunOptions {
  booksDir: string
  apiKey: string
  promptsDir: string
  webAssetsDir?: string
  configPath?: string
  fromStage: string
  toStage: string
  /** When true, skip page-sectioning and only re-render from existing section data. */
  renderOnly?: boolean
  anthropicApiKey?: string
  googleApiKey?: string
  customBaseUrl?: string
  customApiKey?: string
  azureSpeechKey?: string
  azureSpeechRegion?: string
  geminiApiKey?: string
  beforeRun?: () => void
  /**
   * When aborted, the run is cancelled: stages stop scheduling new work, in-flight
   * work is allowed to settle, and any unfinished step is recorded as not-complete
   * so the next stage stays gated. Completed per-page work is already persisted.
   */
  signal?: AbortSignal
}

export interface StageRunProgress {
  emit(event: ProgressEvent): void
}

export interface StageRunner {
  run(
    label: string,
    options: StageRunOptions,
    progress: StageRunProgress
  ): Promise<void>
}

export interface StageService {
  getStatus(label: string): BookRunStatus
  /** Get stage names that are queued (waiting to run). */
  getQueuedStages(label: string): StageName[]
  startStageRun(
    label: string,
    options: StageRunOptions
  ): { status: "started" | "queued"; id: string }
  /** Cancel the active run (if any) and drop everything queued. */
  cancelStageRun(label: string): { cancelled: boolean }
}

let nextId = 1

export function createStageService(
  runner: StageRunner,
  eventBus: BookEventBus
): StageService {
  const books = new Map<string, BookRunState>()

  function getOrCreateState(label: string): BookRunState {
    let state = books.get(label)
    if (!state) {
      state = { active: null, queue: [], controller: null }
      books.set(label, state)
    }
    return state
  }

  async function executeJob(
    label: string,
    job: StageRunJob,
    options: StageRunOptions
  ): Promise<void> {
    const state = getOrCreateState(label)
    const controller = new AbortController()
    state.controller = controller

    const progress: StageRunProgress = {
      emit(event: ProgressEvent) {
        eventBus.emit(label, { type: "progress", data: event })
      },
    }

    try {
      options.beforeRun?.()
      await runner.run(label, { ...options, signal: controller.signal }, progress)
      if (controller.signal.aborted) {
        job.status = "cancelled"
        job.completedAt = Date.now()
        eventBus.emit(label, { type: "stage-run-cancelled", label })
      } else {
        job.status = "completed"
        job.completedAt = Date.now()
        eventBus.emit(label, { type: "stage-run-complete", label })
      }
    } catch (err) {
      if (controller.signal.aborted) {
        // A cancel can surface as a thrown error from an interrupted stage.
        // Treat any failure during an aborted run as a cancellation.
        job.status = "cancelled"
        job.completedAt = Date.now()
        eventBus.emit(label, { type: "stage-run-cancelled", label })
      } else {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[stage-run] ${label} failed:`, message)
        job.status = "failed"
        job.error = message
        job.completedAt = Date.now()
        eventBus.emit(label, { type: "stage-run-error", label, error: message })
      }
    } finally {
      if (state.controller === controller) state.controller = null
    }

    drainQueue(label)
  }

  function drainQueue(label: string): void {
    const state = books.get(label)
    if (!state) return
    if (state.queue.length === 0) {
      // Keep failed jobs so active?.error survives page refresh.
      // Only clear completed jobs — their state is fully captured in the DB.
      if (state.active?.status !== "failed") {
        state.active = null
      }
      return
    }

    const next = state.queue.shift()!
    const job: StageRunJob = {
      label,
      status: "running",
      fromStage: next.fromStage,
      toStage: next.toStage,
      startedAt: Date.now(),
    }
    state.active = job

    eventBus.emit(label, {
      type: "queue-next",
      label,
      fromStage: next.fromStage,
      toStage: next.toStage,
    })

    executeJob(label, job, next.options).catch(() => {})
  }

  return {
    getStatus(label: string): BookRunStatus {
      const state = books.get(label)
      if (!state) return { active: null, queue: [] }
      return {
        active: state.active,
        queue: state.queue.map((q) => ({
          id: q.id,
          fromStage: q.fromStage,
          toStage: q.toStage,
        })),
      }
    },

    getQueuedStages(label: string): StageName[] {
      const state = books.get(label)
      if (!state) return []
      const queued = new Set<StageName>()

      for (const q of state.queue) {
        const from = STAGE_ORDER.indexOf(q.fromStage as StageName)
        const to = STAGE_ORDER.indexOf(q.toStage as StageName)
        if (from !== -1 && to !== -1) {
          for (let i = from; i <= to; i++) {
            queued.add(STAGE_ORDER[i])
          }
        }
      }

      return [...queued]
    },

    startStageRun(
      label: string,
      options: StageRunOptions
    ): { status: "started" | "queued"; id: string } {
      const state = getOrCreateState(label)
      const id = String(nextId++)

      if (state.active?.status === "running") {
        // Queue behind the active run
        state.queue.push({
          id,
          fromStage: options.fromStage,
          toStage: options.toStage,
          options,
        })
        return { status: "queued", id }
      }

      // Start immediately
      const job: StageRunJob = {
        label,
        status: "running",
        fromStage: options.fromStage,
        toStage: options.toStage,
        startedAt: Date.now(),
      }
      state.active = job

      executeJob(label, job, options).catch(() => {})

      return { status: "started", id }
    },

    cancelStageRun(label: string): { cancelled: boolean } {
      const state = books.get(label)
      if (!state) return { cancelled: false }
      // Drop queued runs so "cancel" means stop — not "stop current, start next".
      state.queue = []
      if (state.active?.status === "running" && state.controller) {
        state.controller.abort()
        return { cancelled: true }
      }
      return { cancelled: false }
    },
  }
}
