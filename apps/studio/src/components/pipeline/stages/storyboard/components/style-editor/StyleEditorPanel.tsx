import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  Box,
  Crop,
  Eye,
  EyeOff,
  Film,
  Image as ImageIcon,
  List,
  MousePointerClick,
  Scissors,
  Sparkles,
  Trash2,
  Type,
  Upload,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import { cn } from "@/lib/utils"
import type { ElementActionsProps } from "./ElementActions"
import {
  type ElementType,
  getDefaultOpenSections,
  getVisibleSections,
  inferElementType,
} from "./element-types"
import { SECTION_COMPONENTS } from "./sections"
import { Section } from "./controls/Section"
import { ElementProvider } from "./element-context"
import { Accordion } from "@/components/ui/accordion"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type StyleEditorElementProps = Omit<ElementActionsProps, "dataId">

// eslint-disable-next-line lingui/no-unlocalized-strings -- HTML attribute identifier shown verbatim
const DATA_ID_PREFIX = `data-id="`
const DATA_ID_SUFFIX = `"`

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

  // Retain the last selection while sliding out, so content doesn't blank
  // during the closing animation.
  const [retained, setRetained] = useState({
    dataId: selectedDataId,
    tagName: selectedTagName,
    classes: elementClasses,
    elementProps,
  })

  useEffect(() => {
    if (selectedDataId) {
      setRetained({
        dataId: selectedDataId,
        tagName: selectedTagName,
        classes: elementClasses,
        elementProps,
      })
    }
  }, [selectedDataId, selectedTagName, elementClasses, elementProps])

  const displayDataId = selectedDataId ?? retained.dataId
  const displayTagName = selectedDataId ? selectedTagName : retained.tagName
  const displayClasses = selectedDataId ? elementClasses : retained.classes
  const displayElementProps = selectedDataId ? elementProps : retained.elementProps

  const elementType = useMemo<ElementType | null>(() => {
    if (!displayElementProps) return null
    return inferElementType({
      isImage: displayElementProps.isImage,
      isContainer: displayElementProps.isContainer,
      tagName: displayTagName ?? undefined,
    })
  }, [displayElementProps, displayTagName])

  return (
    <aside
      aria-label={t`Element style editor`}
      aria-hidden={!open}
      className={cn(
        "h-full shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out",
        open ? "w-[360px]" : "w-0"
      )}
    >
      <div className="w-[360px] h-full flex flex-col bg-background border-l">
      <header className="flex items-center gap-3 px-3 py-3 border-b">
        <ElementIconBadge elementType={elementType} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate leading-tight">
            <ElementLabel elementType={elementType} tagName={displayTagName} />
          </div>
          {displayDataId ? (
            <div className="text-[11px] font-mono text-muted-foreground/80 truncate leading-tight mt-0.5">
              {DATA_ID_PREFIX}
              {displayDataId}
              {DATA_ID_SUFFIX}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {displayElementProps?.onTogglePrune && displayDataId ? (
            <button
              type="button"
              onClick={() => displayElementProps.onTogglePrune?.(displayDataId)}
              className="p-1.5 rounded hover:bg-accent transition-colors cursor-pointer"
              aria-label={displayElementProps.isPruned ? t`Restore element` : t`Prune element`}
              title={displayElementProps.isPruned ? t`Restore element` : t`Prune element`}
              tabIndex={open ? 0 : -1}
            >
              {displayElementProps.isPruned ? (
                <EyeOff className="h-3.5 w-3.5 text-destructive" />
              ) : (
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          ) : null}
          {displayElementProps?.onDelete && displayDataId ? (
            <button
              type="button"
              onClick={() => displayElementProps.onDelete?.(displayDataId)}
              className="p-1.5 rounded hover:bg-red-50 transition-colors cursor-pointer group"
              aria-label={t`Delete element`}
              title={t`Delete element`}
              tabIndex={open ? 0 : -1}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-red-600" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-accent transition-colors cursor-pointer"
            aria-label={t`Close style editor`}
            tabIndex={open ? 0 : -1}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {displayDataId ? (
          <StyleEditorBody
            dataId={displayDataId}
            classes={displayClasses ?? []}
            elementType={elementType}
            elementProps={displayElementProps}
            onClassesChange={onClassesChange}
          />
        ) : null}
      </div>
      </div>
    </aside>
  )
}

const ELEMENT_ICONS: Record<ElementType, LucideIcon> = {
  text: Type,
  image: ImageIcon,
  container: Box,
  interactive: MousePointerClick,
  list: List,
  media: Film,
}

function ElementIconBadge({ elementType }: { elementType: ElementType | null }) {
  const Icon = elementType ? ELEMENT_ICONS[elementType] : Box
  return (
    <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
      <Icon className="h-[18px] w-[18px] text-violet-600" />
    </div>
  )
}

function ElementLabel({
  elementType,
  tagName,
}: {
  elementType: ElementType | null
  tagName: string | null
}): ReactNode {
  if (elementType === "image") return <Trans>Image</Trans>
  if (elementType === "list") return <Trans>List</Trans>
  if (elementType === "media") return <Trans>Media</Trans>
  if (elementType === "interactive") {
    if (tagName === "a") return <Trans>Link</Trans>
    if (tagName === "button") return <Trans>Button</Trans>
    if (tagName === "input" || tagName === "textarea") return <Trans>Input</Trans>
    return <Trans>Interactive</Trans>
  }
  if (elementType === "container") {
    if (tagName === "section") return <Trans>Section</Trans>
    if (tagName === "article") return <Trans>Article</Trans>
    if (tagName === "aside") return <Trans>Aside</Trans>
    if (tagName === "nav") return <Trans>Nav</Trans>
    return <Trans>Container</Trans>
  }
  // text
  if (tagName) {
    if (/^h[1-6]$/.test(tagName)) return <Trans>Heading</Trans>
    if (tagName === "p") return <Trans>Paragraph</Trans>
    if (tagName === "blockquote") return <Trans>Quote</Trans>
    if (tagName === "figcaption") return <Trans>Caption</Trans>
  }
  return <Trans>Text</Trans>
}

interface StyleEditorBodyProps {
  dataId: string
  classes: string[]
  elementType: ElementType | null
  elementProps: StyleEditorElementProps | null
  onClassesChange: (dataId: string, classes: string[]) => void
}

function StyleEditorBody({
  dataId,
  classes,
  elementType,
  elementProps,
  onClassesChange,
}: StyleEditorBodyProps) {
  const visibleSections = useMemo(
    () => (elementType ? getVisibleSections(elementType) : []),
    [elementType]
  )

  // Open keys for the Accordion. Reset to element-type-specific defaults
  // whenever the element type changes (so e.g. selecting an image opens "Image
  // fit" without affecting toggles made while editing a text element).
  const [openKeys, setOpenKeys] = useState<string[]>(() =>
    elementType ? getDefaultOpenSections(elementType) : []
  )
  useEffect(() => {
    if (elementType) setOpenKeys(getDefaultOpenSections(elementType))
  }, [elementType])

  return (
    <ElementProvider value={{ dataId, classes }}>
      <div className="flex flex-col">
        {elementProps?.isImage ? (
          <ImageActionsSection dataId={dataId} elementProps={elementProps} />
        ) : null}

        <Accordion type="multiple" value={openKeys} onValueChange={setOpenKeys}>
          {visibleSections.map((key) => {
            const SectionComponent = SECTION_COMPONENTS[key]
            return <SectionComponent key={key} />
          })}
          <AdvancedSection
            dataId={dataId}
            classes={classes}
            onClassesChange={onClassesChange}
          />
        </Accordion>
      </div>
    </ElementProvider>
  )
}

function ImageActionsSection({
  dataId,
  elementProps,
}: {
  dataId: string
  elementProps: StyleEditorElementProps
}) {
  const { t } = useLingui()
  const {
    imageSrc,
    onCrop,
    onRecropFromPage,
    onReplace,
    onReplaceFromBook,
    onAiImage,
    onSegment,
    segmenting,
  } = elementProps

  if (!imageSrc) return null

  const hasAnyAction =
    onCrop ||
    onRecropFromPage ||
    onReplace ||
    onReplaceFromBook ||
    onAiImage ||
    onSegment

  return (
    <section className="border-b px-3 pt-3 pb-3">
      <div className="relative rounded-md overflow-hidden border bg-muted/30 group">
        <img src={imageSrc} alt={dataId} className="w-full h-32 object-cover" />
        {hasAnyAction ? (
          <TooltipProvider delayDuration={0}>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 p-1.5 bg-gradient-to-t from-black/70 via-black/40 to-transparent">
              {onCrop ? (
                <OverlayIconButton
                  icon={Crop}
                  label={t`Crop`}
                  onClick={() => onCrop(dataId)}
                />
              ) : null}
              {onRecropFromPage ? (
                <OverlayIconButton
                  icon={ImageIcon}
                  label={t`Recrop from page`}
                  onClick={() => onRecropFromPage(dataId)}
                />
              ) : null}
              {onReplace ? (
                <OverlayIconButton
                  icon={Upload}
                  label={t`Replace`}
                  onClick={() => onReplace(dataId)}
                />
              ) : null}
              {onReplaceFromBook ? (
                <OverlayIconButton
                  icon={ImageIcon}
                  label={t`Replace from book`}
                  onClick={() => onReplaceFromBook(dataId)}
                />
              ) : null}
              {onAiImage ? (
                <OverlayIconButton
                  icon={Sparkles}
                  label={t`AI`}
                  onClick={() => onAiImage(dataId)}
                  accent="purple"
                />
              ) : null}
              {onSegment ? (
                <OverlayIconButton
                  icon={Scissors}
                  label={segmenting ? t`Segmenting…` : t`Segment`}
                  onClick={() => onSegment(dataId)}
                  disabled={segmenting}
                  accent="orange"
                />
              ) : null}
            </div>
          </TooltipProvider>
        ) : null}
      </div>
    </section>
  )
}

function OverlayIconButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  accent = "default",
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
  accent?: "default" | "purple" | "orange"
}) {
  const palette: Record<typeof accent, string> = {
    default: "text-white hover:bg-white/20",
    purple: "text-purple-200 hover:bg-purple-400/30",
    orange: "text-orange-200 hover:bg-orange-400/30",
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={cn(
            "h-7 w-7 rounded flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
            palette[accent]
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} variant="light">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function AdvancedSection({
  dataId,
  classes,
  onClassesChange,
}: {
  dataId: string
  classes: string[]
  onClassesChange: (dataId: string, classes: string[]) => void
}) {
  const [draft, setDraft] = useState(classes.join(" "))

  useEffect(() => {
    setDraft(classes.join(" "))
  }, [classes])

  const commit = useCallback(() => {
    const parsed = draft.split(/\s+/).filter(Boolean)
    if (parsed.length === classes.length && parsed.every((c, i) => c === classes[i])) return
    onClassesChange(dataId, parsed)
  }, [draft, classes, dataId, onClassesChange])

  return (
    <Section value="advanced" title={<Trans>Advanced</Trans>} icon={Wrench}>
      <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <Trans>Tailwind classes</Trans>
      </label>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        spellCheck={false}
        rows={4}
        className="w-full bg-muted/30 border border-input rounded-md px-2 py-1.5 text-[11px] font-mono leading-relaxed resize-y outline-none focus:ring-2 focus:ring-ring focus:border-ring"
      />
      <p className="text-[10px] text-muted-foreground/70">
        <Trans>Space-separated. Saves on blur.</Trans>
      </p>
    </Section>
  )
}
