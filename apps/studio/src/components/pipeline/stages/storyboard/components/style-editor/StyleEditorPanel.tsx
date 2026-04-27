import { X } from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import { cn } from "@/lib/utils"

interface StyleEditorPanelProps {
  open: boolean
  onClose: () => void
  selectedDataId: string | null
  selectedTagName: string | null
  elementClasses: string[] | null
  onClassesChange: (dataId: string, classes: string[]) => void
}

export function StyleEditorPanel({
  open,
  onClose,
  selectedDataId,
  selectedTagName,
  elementClasses,
  onClassesChange: _onClassesChange,
}: StyleEditorPanelProps) {
  const { t } = useLingui()
  void _onClassesChange
  return (
    <aside
      aria-label={t`Element style editor`}
      className={cn(
        "absolute top-0 right-0 h-full w-[360px] flex flex-col bg-background border-l shadow-lg z-30",
        "transition-transform duration-200 ease-in-out",
        open ? "translate-x-0" : "translate-x-full"
      )}
    >
      <header className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Trans>Styles</Trans>
          </span>
          {selectedTagName ? (
            <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5 shrink-0">
              &lt;{selectedTagName}&gt;
            </span>
          ) : null}
          {selectedDataId ? (
            <span className="text-[10px] font-mono text-muted-foreground/70 truncate">
              {selectedDataId}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-accent transition-colors cursor-pointer shrink-0"
          aria-label={t`Close style editor`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {selectedDataId ? (
          <StyleEditorBody classes={elementClasses ?? []} />
        ) : (
          <EmptyState />
        )}
      </div>
    </aside>
  )
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center px-6 text-center">
      <p className="text-xs text-muted-foreground">
        <Trans>Select an element in the preview to edit its styles.</Trans>
      </p>
    </div>
  )
}

function StyleEditorBody({ classes }: { classes: string[] }) {
  return (
    <div className="p-4 space-y-4">
      <section className="space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Trans>Classes</Trans>
        </h3>
        <div className="rounded border bg-muted/30 px-2 py-1.5 text-[11px] font-mono break-all min-h-[28px]">
          {classes.length > 0 ? (
            classes.join(" ")
          ) : (
            <span className="text-muted-foreground/60">
              <Trans>No classes</Trans>
            </span>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Trans>Property groups</Trans>
        </h3>
        <p className="text-[11px] text-muted-foreground/70">
          <Trans>Layout, spacing, sizing, typography, colors — coming next.</Trans>
        </p>
      </section>
    </div>
  )
}
