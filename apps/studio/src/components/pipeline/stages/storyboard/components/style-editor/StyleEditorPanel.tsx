import { useCallback, useMemo } from "react"
import { X } from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import { cn } from "@/lib/utils"
import { RawClassChips } from "./RawClassChips"
import { ElementActions, type ElementActionsProps } from "./ElementActions"
import {
  type ElementType,
  type SectionKey,
  getVisibleSections,
  inferElementType,
} from "./element-types"

type StyleEditorElementProps = Omit<ElementActionsProps, "dataId">

interface StyleEditorPanelProps {
  open: boolean
  onClose: () => void
  selectedDataId: string | null
  selectedTagName: string | null
  elementClasses: string[] | null
  elementProps: StyleEditorElementProps | null
  onClassesChange: (dataId: string, classes: string[]) => void
}

export function StyleEditorPanel({
  open,
  onClose,
  selectedDataId,
  selectedTagName,
  elementClasses,
  elementProps,
  onClassesChange,
}: StyleEditorPanelProps) {
  const { t } = useLingui()

  const elementType = useMemo<ElementType | null>(() => {
    if (!elementProps) return null
    return inferElementType({
      isImage: elementProps.isImage,
      isContainer: elementProps.isContainer,
      tagName: selectedTagName ?? undefined,
    })
  }, [elementProps, selectedTagName])

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
          {elementType ? <ElementTypeBadge type={elementType} /> : null}
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
          <StyleEditorBody
            dataId={selectedDataId}
            classes={elementClasses ?? []}
            elementProps={elementProps}
            elementType={elementType}
            onClassesChange={onClassesChange}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </aside>
  )
}

function ElementTypeBadge({ type }: { type: ElementType }) {
  const { t } = useLingui()
  const labels: Record<ElementType, string> = {
    text: t`text`,
    image: t`image`,
    container: t`container`,
    interactive: t`interactive`,
    list: t`list`,
    media: t`media`,
  }
  return (
    <span className="text-[9px] font-semibold uppercase tracking-wider text-blue-700 bg-blue-50 rounded px-1.5 py-0.5 shrink-0">
      {labels[type]}
    </span>
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

interface StyleEditorBodyProps {
  dataId: string
  classes: string[]
  elementProps: StyleEditorElementProps | null
  elementType: ElementType | null
  onClassesChange: (dataId: string, classes: string[]) => void
}

function StyleEditorBody({
  dataId,
  classes,
  elementProps,
  elementType,
  onClassesChange,
}: StyleEditorBodyProps) {
  const handleAdd = useCallback(
    (cls: string) => {
      if (classes.includes(cls)) return
      onClassesChange(dataId, [...classes, cls])
    },
    [dataId, classes, onClassesChange]
  )

  const handleRemove = useCallback(
    (cls: string) => {
      onClassesChange(dataId, classes.filter((c) => c !== cls))
    },
    [dataId, classes, onClassesChange]
  )

  const handleSwap = useCallback(
    (oldCls: string, newCls: string) => {
      if (oldCls === newCls) return
      onClassesChange(dataId, classes.map((c) => (c === oldCls ? newCls : c)))
    },
    [dataId, classes, onClassesChange]
  )

  const visibleSections = useMemo(
    () => (elementType ? getVisibleSections(elementType) : []),
    [elementType]
  )

  return (
    <div className="p-4 space-y-4">
      {elementProps && !elementProps.isContainer && (
        <section className="space-y-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Trans>Element</Trans>
          </h3>
          <ElementActions dataId={dataId} {...elementProps} />
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Trans>Classes</Trans>
        </h3>
        <RawClassChips
          classes={classes}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onSwap={handleSwap}
        />
      </section>

      {visibleSections.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Trans>Properties</Trans>
          </h3>
          <div className="rounded border divide-y bg-muted/10">
            {visibleSections.map((key) => (
              <SectionPlaceholder key={key} sectionKey={key} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function SectionPlaceholder({ sectionKey }: { sectionKey: SectionKey }) {
  const { t } = useLingui()
  const labels: Record<SectionKey, string> = {
    typography: t`Typography`,
    color: t`Color`,
    spacing: t`Spacing`,
    sizing: t`Sizing`,
    layout: t`Layout`,
    borders: t`Borders`,
    imageFit: t`Image fit`,
    effects: t`Effects`,
  }
  return (
    <div className="px-3 py-2 flex items-center justify-between">
      <span className="text-[11px] font-medium text-foreground/80">
        {labels[sectionKey]}
      </span>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">
        <Trans>coming next</Trans>
      </span>
    </div>
  )
}
