import { useCallback, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "@tanstack/react-router"
import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useUpdateBookConfig } from "@/hooks/use-book-config"
import { useApiKey } from "@/hooks/use-api-key"
import { useBookRun } from "@/hooks/use-book-run"
import { useLingui } from "@lingui/react/macro"

export interface DirtyConfig {
  /** The dirty-field map (field → true once touched). */
  dirty: Record<string, boolean>
  /** Mark a config field as edited. */
  markDirty: (field: string) => void
  /** Whether any field has been touched. */
  isDirty: boolean
  /**
   * Whether a field should be written to overrides: it was edited this session,
   * or the book already has an explicit override for it.
   */
  shouldWrite: (field: string) => boolean
  /** Clear all dirty flags (after a successful save). */
  reset: () => void
}

/**
 * Tracks which config fields a Settings page has touched. Centralizes the
 * dirty-map + shouldWrite rule shared by every stage's settings so the
 * "write if edited OR already overridden" semantics can't drift per stage.
 */
export function useDirtyConfig(
  savedConfig: Record<string, unknown> | null | undefined,
): DirtyConfig {
  const [dirty, setDirty] = useState<Record<string, boolean>>({})
  const markDirty = useCallback(
    (field: string) =>
      setDirty((prev) => (prev[field] ? prev : { ...prev, [field]: true })),
    [],
  )
  const reset = useCallback(() => setDirty({}), [])
  const isDirty = Object.values(dirty).some(Boolean)
  const shouldWrite = (field: string) =>
    !!dirty[field] || (savedConfig != null && field in savedConfig)
  return { dirty, markDirty, isDirty, shouldWrite, reset }
}

export interface SaveAndRerunOptions {
  bookLabel: string
  /** Pipeline stage slug — used for queueRun and post-save navigation. */
  stage: string
  /** True when there are unsaved settings (dirty config and/or prompt drafts). */
  hasPendingChanges: boolean
  /** Build the full book-config overrides object to persist. */
  buildOverrides: () => Record<string, unknown>
  /** Optional prompt persistence run before the config save. */
  savePrompts?: () => Promise<void>
  /** Storyboard: re-render from existing sections instead of a full rerun. */
  renderOnly?: boolean
  /** Reset local dirty / draft state after a successful save. */
  onSaved?: () => void
  dialogTitle: ReactNode
  dialogDescription: ReactNode
}

export interface SaveAndRerunController {
  hasPendingChanges: boolean
  canRun: boolean
  isSaving: boolean
  showDialog: boolean
  openDialog: () => void
  setShowDialog: (open: boolean) => void
  confirm: () => Promise<void>
  dialogTitle: ReactNode
  dialogDescription: ReactNode
}

/**
 * Owns the shared "save settings → re-run stage" machinery: the config
 * mutation, prompt persistence, queueRun, post-save navigation, and the
 * confirm-dialog state. Stages pass their variations (overrides, prompts,
 * renderOnly) as options.
 */
export function useSaveAndRerun(opts: SaveAndRerunOptions): SaveAndRerunController {
  const {
    bookLabel,
    stage,
    hasPendingChanges,
    buildOverrides,
    savePrompts,
    renderOnly,
    onSaved,
    dialogTitle,
    dialogDescription,
  } = opts
  const updateConfig = useUpdateBookConfig()
  const { apiKey, hasApiKey } = useApiKey()
  const { queueRun } = useBookRun()
  const navigate = useNavigate()
  const [showDialog, setShowDialog] = useState(false)

  const confirm = async () => {
    if (savePrompts) await savePrompts()
    updateConfig.mutate(
      { label: bookLabel, config: buildOverrides() },
      {
        onSuccess: () => {
          onSaved?.()
          setShowDialog(false)
          queueRun({ fromStage: stage, toStage: stage, apiKey, renderOnly })
          navigate({
            to: "/books/$label/$step",
            params: { label: bookLabel, step: stage },
          })
        },
      },
    )
  }

  return {
    hasPendingChanges,
    canRun: hasApiKey,
    isSaving: updateConfig.isPending,
    showDialog,
    openDialog: () => setShowDialog(true),
    setShowDialog,
    confirm,
    dialogTitle,
    dialogDescription,
  }
}

/**
 * Full-width bar docked to the bottom of the viewport when a stage's Settings
 * page has unsaved config/prompt changes, carrying the Save & Rerun action.
 * Deliberately a different shape from the entity FloatingSaveBar (a small
 * centered pill) so users read them as different things: this saves settings
 * AND re-runs the stage (overwriting output), so it also routes through a
 * confirmation dialog. The two never co-occur — this lives on settings pages,
 * the save bar on stage views.
 */
export function StageRerunBar({ controller }: { controller: SaveAndRerunController }) {
  const { t } = useLingui()
  const c = controller

  return (
    <>
      {c.hasPendingChanges &&
        createPortal(
          // left-[220px] clears the book layout's fixed-width stage sidebar so
          // the bar spans only the content column, not the whole viewport.
          <div className="fixed bottom-0 left-[220px] right-0 z-50 animate-in slide-in-from-bottom-2 fade-in duration-300 ease-out">
            <div className="flex items-center gap-3 border-t bg-background/95 px-4 py-2.5 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur">
              <span className="relative inline-flex h-2 w-2 shrink-0" aria-hidden>
                <span className="absolute inset-0 rounded-full bg-amber-500/40 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
              <span className="text-[13px] font-medium text-foreground">
                {t`Unsaved settings`}
              </span>
              <Button
                size="sm"
                className="ml-auto h-8 px-3 text-xs"
                onClick={c.openDialog}
                disabled={!c.canRun || c.isSaving}
                title={!c.canRun ? t`Add an API key to re-run` : undefined}
              >
                <Play className="mr-1.5 h-3.5 w-3.5" />
                {t`Save & Rerun`}
              </Button>
            </div>
          </div>,
          document.body,
        )}

      <Dialog open={c.showDialog} onOpenChange={c.setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{c.dialogTitle}</DialogTitle>
            <DialogDescription>{c.dialogDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => c.setShowDialog(false)}>
              {t`Cancel`}
            </Button>
            <Button onClick={c.confirm} disabled={c.isSaving}>
              {c.isSaving ? t`Saving...` : t`Confirm Rerun`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
