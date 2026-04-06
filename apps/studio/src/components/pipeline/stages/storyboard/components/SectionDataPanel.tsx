import { useState, useRef, useCallback, useEffect, useMemo, type ReactNode } from "react"
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  FolderOpen,
  GripVertical,
  Image,
  ImagePlus,
  Layers,
  Loader2,
  Minus,
  PanelTop,
  Plus,
  RefreshCw,
  Trash2,
  Type,
  X,
} from "lucide-react"
import { SectionActionsDropdown } from "./SectionActionsDropdown"
import { BASE_URL } from "@/api/client"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { PageSection } from "@adt/types"
import { useLingui } from "@lingui/react/macro"
import { cn } from "@/lib/utils"
import { getSectionTypeLabel, getSectionTypeDescription } from "@/lib/section-constants"

function getSectionTypeDisplayLabel(value: string): string {
  return getSectionTypeLabel(value) || value.replace(/_/g, " ")
}

function getSectionTypeDisplayDescription(value: string, configDesc: string): string {
  return getSectionTypeDescription(value) ?? configDesc
}

// -- Types --

interface SectionDataPanelProps {
  open: boolean
  onClose: () => void
  section: PageSection
  sectionIndex: number
  sectionCount: number
  bookLabel: string
  sectionTypes?: Record<string, string>
  textTypes?: Record<string, string>
  groupTypes?: Record<string, string>
  activityAnswers?: Record<string, string | boolean | number>
  onChangeSectionType: (type: string) => void
  onToggleSectionPruned: () => void
  onTogglePartPruned: (partIndex: number) => void
  onChangeGroupType: (partIndex: number, type: string) => void
  onChangeTextType: (partIndex: number, textIndex: number, type: string) => void
  onToggleTextPruned: (partIndex: number, textIndex: number) => void
  onDeleteTextEntry: (partIndex: number, textIndex: number) => void
  onDuplicateTextEntry: (partIndex: number, textIndex: number) => void
  onAddGroup: () => void
  onDuplicateGroup: (partIndex: number) => void
  onDeleteGroup: (partIndex: number) => void
  onReorderParts: (fromIndex: number, toIndex: number) => void
  onEditText: (partIndex: number, textIndex: number, newText: string) => void
  onMoveText: (
    fromPartIndex: number,
    textIndex: number,
    toPartIndex: number,
    toTextIndex: number
  ) => void
  onMergeSection: (dir: "prev" | "next") => void
  onMergeCrossPage?: (dir: "prev" | "next") => void
  hasPrevPage?: boolean
  hasNextPage?: boolean
  onCloneSection: () => void
  onDeleteSection: () => void
  onRerender: (prompt?: string) => void
  onAddImage: () => void
  onUpdateAnswer: (itemKey: string, value: string) => void
  // Version picker
  versionPickerNode: ReactNode
  // Disabled states
  pipelineRunning?: boolean
  merging: boolean
  cloning: boolean
  deleting: boolean
  saving: boolean
  rerendering: boolean
  dirty: boolean
  renderingDirty: boolean
  hasApiKey: boolean
  showPrunedImages: boolean
  onToggleShowPrunedImages: () => void
  // Layers panel
  sectionHtml?: string
  selectedDataId?: string
  onSelectElement?: (dataId: string) => void
  onMoveElement?: (dataId: string, direction: "up" | "down") => void
  onReorderElement?: (dragSelector: string, dropSelector: string, position: "before" | "after" | "inside") => void
  /** Set of data-ids that are pruned (hidden from output) */
  prunedDataIds?: string[]
}

// -- ImageCard (inline) --

function ImageCard({
  imageId,
  bookLabel,
  isPruned,
  reason,
}: {
  imageId: string
  bookLabel: string
  isPruned?: boolean
  reason?: string
}) {
  const { t } = useLingui()
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(
    null
  )

  return (
    <div
      className={`relative rounded border overflow-hidden bg-card flex flex-col items-center min-h-[80px] transition-opacity duration-300 ${isPruned ? "opacity-40" : ""}`}
      title={isPruned ? t`Pruned: ${reason ?? ""}` : undefined}
    >
      <img
        src={`${BASE_URL}/books/${bookLabel}/images/${imageId}`}
        alt={imageId}
        className={`max-w-full h-auto block my-auto ${isPruned ? "grayscale" : ""}`}
        onLoad={(e) => {
          const img = e.target as HTMLImageElement
          setDimensions({ w: img.naturalWidth, h: img.naturalHeight })
        }}
        onError={(e) => {
          const target = e.target as HTMLImageElement
          target.style.display = "none"
        }}
      />
      <div className="px-2 py-1 flex items-center justify-between border-t bg-muted/30 w-full mt-auto">
        <span className="text-[10px] text-muted-foreground truncate">
          {imageId}
        </span>
        {dimensions && (
          <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
            {dimensions.w}&times;{dimensions.h}
          </span>
        )}
      </div>
    </div>
  )
}

// -- Inline editable text --

function EditableText({
  value,
  onCommit,
  disabled,
}: {
  value: string
  onCommit: (newText: string) => void
  disabled?: boolean
}) {
  const { t } = useLingui()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  // Guard against double-commit (Enter triggers blur when textarea is removed)
  // and against committing on Escape (blur fires when editing is cancelled).
  const cancelRef = useRef(false)

  // Sync draft when value changes externally while not editing
  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  const commit = useCallback(() => {
    if (cancelRef.current) {
      cancelRef.current = false
      return
    }
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) {
      onCommit(trimmed)
    } else {
      setDraft(value)
    }
  }, [draft, value, onCommit])

  if (!editing) {
    return (
      <span
        className={cn("leading-relaxed flex-1 min-w-0 text-xs rounded px-0.5 -mx-0.5 transition-colors", disabled ? "cursor-default opacity-60" : "cursor-text hover:bg-accent/50")}
        onClick={() => {
          if (!disabled) setEditing(true)
        }}
        title={disabled ? undefined : t`Click to edit`}
      >
        {value}
      </span>
    )
  }

  return (
    <textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          // Let blur handler do the commit — prevents double-fire
          cancelRef.current = false
          e.currentTarget.blur()
        }
        if (e.key === "Escape") {
          // Discard edit — suppress the blur commit
          cancelRef.current = true
          setDraft(value)
          setEditing(false)
        }
      }}
      className="leading-relaxed flex-1 min-w-0 text-xs rounded border border-ring bg-background px-1 py-0.5 -mx-0.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
      rows={Math.max(2, Math.ceil(draft.length / 50))}
      autoFocus
    />
  )
}

// ---------------------------------------------------------------------------
// Layers panel — DOM tree view of the rendered section HTML
// ---------------------------------------------------------------------------

interface LayerNode {
  tag: string
  dataId: string | null
  /** Stable identifier for drag-and-drop — uses dataId when available, otherwise a positional key */
  layerKey: string
  /** CSS selector that uniquely identifies this element in the parsed DOM */
  cssSelector: string
  label: string
  textPreview: string
  isImage: boolean
  isContainer: boolean
  children: LayerNode[]
  hasPrevSibling: boolean
  hasNextSibling: boolean
  /** Index among visible siblings in this parent */
  siblingIndex: number
}

/** Tags that are interesting to show in the layer tree */
const LAYER_TAGS = new Set([
  "div", "section", "article", "main", "aside", "nav", "header", "footer",
  "p", "h1", "h2", "h3", "h4", "h5", "h6", "span", "a", "blockquote",
  "figure", "figcaption", "img", "picture", "video", "audio",
  "ul", "ol", "li", "table", "tr", "td", "th", "tbody", "thead",
  "button", "input", "label", "form", "textarea", "select",
])

function buildLayerTree(html: string): LayerNode[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")

  // Start from #content wrapper if present, otherwise body
  const root = doc.getElementById("content") ?? doc.body
  const rootSelector = root.id ? `#${root.id}` : "body"
  return buildChildren(root, rootSelector)
}

function buildChildren(parent: Element, parentSelector: string = ""): LayerNode[] {
  const nodes: LayerNode[] = []
  const childElements = Array.from(parent.children)

  let visibleIdx = 0
  for (let i = 0; i < childElements.length; i++) {
    const el = childElements[i]
    const tag = el.tagName.toLowerCase()

    // Skip non-visual elements
    if (tag === "script" || tag === "style" || tag === "link" || tag === "meta") continue

    const dataId = el.getAttribute("data-id")
    const isImg = tag === "img"
    const isContainer = !dataId && LAYER_TAGS.has(tag) && el.children.length > 0

    // Build a CSS selector: prefer data-id, fall back to nth-child
    // eslint-disable-next-line lingui/no-unlocalized-strings -- CSS selector, not user-visible
    const cssSelector = dataId ? `[data-id="${dataId}"]` : `${parentSelector} > :nth-child(${i + 1})`

    const layerKey = dataId ?? `${parentSelector}/${visibleIdx}:${tag}`
    const children = isContainer ? buildChildren(el, cssSelector) : []

    // Build label — data-id or image filename
    let label: string
    if (dataId) {
      label = dataId
    } else if (isImg) {
      const src = el.getAttribute("src") ?? ""
      const fileName = src.split("/").pop() ?? ""
      label = fileName || tag
    } else {
      label = tag
    }

    // Text preview — always show for any element with text content
    const ownText = getOwnTextContent(el)
    const textPreview = ownText.length > 50 ? ownText.slice(0, 50) + "…" : ownText

    // Only include if it has a data-id, is a container with children, or is a known tag
    if (dataId || children.length > 0 || LAYER_TAGS.has(tag)) {
      nodes.push({
        tag,
        dataId,
        layerKey,
        cssSelector,
        label,
        textPreview,
        isImage: isImg || (dataId?.includes("_im") ?? false),
        isContainer,
        children,
        hasPrevSibling: visibleIdx > 0,
        hasNextSibling: false, // patched below
        siblingIndex: visibleIdx,
      })
      visibleIdx++
    }
  }
  // Patch hasNextSibling
  for (let i = 0; i < nodes.length - 1; i++) {
    nodes[i].hasNextSibling = true
  }
  return nodes
}

/** Get the direct (non-child-element) text content of an element */
function getOwnTextContent(el: Element): string {
  let text = ""
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent ?? ""
    }
  }
  // Fallback: if no direct text nodes, use full textContent (for leaf elements)
  if (!text.trim() && el.children.length === 0) {
    text = el.textContent ?? ""
  }
  return text.trim()
}

const DRAG_TYPE_LAYER = "application/x-layer-key"

function LayerNodeRow({
  node,
  depth,
  selectedDataId,
  prunedDataIds,
  expandedPaths,
  toggleExpand,
  onSelect,
  onMove,
  dragState,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  disabled,
}: {
  node: LayerNode
  depth: number
  selectedDataId?: string
  prunedDataIds?: Set<string>
  expandedPaths: Set<string>
  toggleExpand: (path: string) => void
  onSelect?: (dataId: string) => void
  onMove?: (dataId: string, direction: "up" | "down") => void
  dragState: { dragKey: string | null; dropKey: string | null; dropPosition: "before" | "after" | "inside" | null }
  onDragStart: (layerKey: string) => void
  onDragEnd: () => void
  onDragOver: (e: React.DragEvent, layerKey: string) => void
  onDrop: (e: React.DragEvent, layerKey: string) => void
  disabled?: boolean
}) {
  const { t } = useLingui()
  const pathKey = node.layerKey
  const isExpanded = expandedPaths.has(pathKey)
  const isSelected = node.dataId != null && node.dataId === selectedDataId
  const isPruned = node.dataId != null && (prunedDataIds?.has(node.dataId) ?? false)
  const hasChildren = node.children.length > 0
  const canMove = node.dataId != null && onMove && !disabled
  const isDragging = dragState.dragKey === node.layerKey
  const isDropTarget = dragState.dropKey === node.layerKey
  const isDraggable = !disabled

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-1 py-0.5 pr-1 rounded text-[11px] transition-colors group/layer",
          isSelected && !isDropTarget ? "bg-blue-100 text-blue-900" : !isDropTarget && "hover:bg-accent/50",
          isDragging && "opacity-40",
          isPruned && !isDragging && "opacity-40",
          isDropTarget && dragState.dropPosition === "before" && "border-t-2 border-t-primary",
          isDropTarget && dragState.dropPosition === "after" && "border-b-2 border-b-primary",
          isDropTarget && dragState.dropPosition === "inside" && "bg-primary/10 ring-1 ring-primary rounded",
          isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        )}
        style={{ paddingLeft: depth * 16 + 4 }}
        draggable={isDraggable}
        onDragStart={(e) => {
          if (!isDraggable) { e.preventDefault(); return }
          e.dataTransfer.setData(DRAG_TYPE_LAYER, node.layerKey)
          e.dataTransfer.effectAllowed = "move"
          onDragStart(node.layerKey)
        }}
        onDragEnd={onDragEnd}
        onDragOver={(e) => onDragOver(e, node.layerKey)}
        onDrop={(e) => onDrop(e, node.layerKey)}
        onClick={() => {
          if (node.dataId && onSelect) onSelect(node.dataId)
        }}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleExpand(pathKey) }}
            className="p-0 shrink-0 cursor-pointer"
          >
            <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <span className="w-3 shrink-0">
            <Minus className="h-3 w-3 text-muted-foreground/30" />
          </span>
        )}

        {/* Icon */}
        {node.isImage ? (
          <Image className="h-3 w-3 text-green-600 shrink-0" />
        ) : hasChildren ? (
          <PanelTop className="h-3 w-3 text-orange-500 shrink-0" />
        ) : (
          <Type className="h-3 w-3 text-muted-foreground shrink-0" />
        )}

        {/* Tag name */}
        <span className="text-[10px] font-mono text-muted-foreground shrink-0">{node.tag}</span>

        {/* Label (data-id or tag) */}
        <span className="text-[10px] font-mono text-muted-foreground/70 shrink-0 max-w-[80px] truncate">{node.label !== node.tag ? node.label : ""}</span>

        {/* Text preview */}
        {node.textPreview && (
          <span className="truncate min-w-0 flex-1 text-[10px] text-muted-foreground/60 italic">{node.textPreview}</span>
        )}
        {!node.textPreview && <span className="flex-1" />}

        {/* Pruned indicator */}
        {isPruned && (
          <span className="shrink-0" title={t`Pruned`}>
            <EyeOff className="h-3 w-3 text-destructive" />
          </span>
        )}

        {/* Move buttons — visible on hover, keep as fallback alongside drag */}
        {canMove && (
          <span className="flex items-center gap-0 shrink-0 opacity-0 group-hover/layer:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMove(node.dataId!, "up") }}
              disabled={!node.hasPrevSibling}
              className="p-0.5 rounded hover:bg-accent transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-default"
              title={t`Move up`}
            >
              <ArrowUp className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMove(node.dataId!, "down") }}
              disabled={!node.hasNextSibling}
              className="p-0.5 rounded hover:bg-accent transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-default"
              title={t`Move down`}
            >
              <ArrowDown className="h-3 w-3" />
            </button>
          </span>
        )}
      </div>
      {/* Children */}
      {hasChildren && isExpanded && node.children.map((child, i) => (
        <LayerNodeRow
          key={child.layerKey}
          node={child}
          depth={depth + 1}
          selectedDataId={selectedDataId}
          prunedDataIds={prunedDataIds}
          expandedPaths={expandedPaths}
          toggleExpand={toggleExpand}
          onSelect={onSelect}
          onMove={onMove}
          dragState={dragState}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={onDragOver}
          onDrop={onDrop}
          disabled={disabled}
        />
      ))}
    </>
  )
}

function LayersPanel({
  html,
  selectedDataId,
  prunedDataIds,
  onSelect,
  onMove,
  onReorder,
  disabled,
}: {
  html: string
  selectedDataId?: string
  prunedDataIds?: Set<string>
  onSelect?: (dataId: string) => void
  onMove?: (dataId: string, direction: "up" | "down") => void
  /** Reorder: move drag element relative to drop element. "inside" appends into a container. */
  onReorder?: (dragSelector: string, dropSelector: string, position: "before" | "after" | "inside") => void
  disabled?: boolean
}) {
  const { t } = useLingui()
  const tree = useMemo(() => buildLayerTree(html), [html])
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    const paths = new Set<string>()
    for (const node of tree) {
      paths.add(node.layerKey)
    }
    return paths
  })

  type DropPosition = "before" | "after" | "inside"

  const [dragState, setDragState] = useState<{
    dragKey: string | null
    dropKey: string | null
    dropPosition: DropPosition | null
  }>({ dragKey: null, dropKey: null, dropPosition: null })

  // Build a lookup from layerKey -> node for resolving drag/drop
  const nodeByKey = useMemo(() => {
    const map = new Map<string, LayerNode>()
    function walk(nodes: LayerNode[]) {
      for (const n of nodes) {
        map.set(n.layerKey, n)
        walk(n.children)
      }
    }
    walk(tree)
    return map
  }, [tree])

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const handleDragStart = useCallback((layerKey: string) => {
    setDragState({ dragKey: layerKey, dropKey: null, dropPosition: null })
  }, [])

  const handleDragEnd = useCallback(() => {
    setDragState({ dragKey: null, dropKey: null, dropPosition: null })
  }, [])

  // Compute drop position from mouse Y:
  // - Container nodes: top 25% = before, middle 50% = inside, bottom 25% = after
  // - Leaf nodes: top 50% = before, bottom 50% = after
  const getDropPosition = useCallback((e: React.DragEvent, targetKey: string): DropPosition => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const relY = (e.clientY - rect.top) / rect.height
    const targetNode = nodeByKey.get(targetKey)
    if (targetNode?.isContainer) {
      if (relY < 0.25) return "before"
      if (relY > 0.75) return "after"
      return "inside"
    }
    return relY < 0.5 ? "before" : "after"
  }, [nodeByKey])

  const handleDragOver = useCallback((e: React.DragEvent, layerKey: string) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE_LAYER)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"

    const position = getDropPosition(e, layerKey)

    setDragState((prev) => {
      if (prev.dropKey === layerKey && prev.dropPosition === position) return prev
      return { ...prev, dropKey: layerKey, dropPosition: position }
    })
  }, [getDropPosition])

  const handleDrop = useCallback((e: React.DragEvent, dropLayerKey: string) => {
    e.preventDefault()
    const dragKey = e.dataTransfer.getData(DRAG_TYPE_LAYER)
    if (!dragKey || dragKey === dropLayerKey) {
      setDragState({ dragKey: null, dropKey: null, dropPosition: null })
      return
    }

    const dragNode = nodeByKey.get(dragKey)
    const dropNode = nodeByKey.get(dropLayerKey)
    if (!dragNode || !dropNode || !onReorder) {
      setDragState({ dragKey: null, dropKey: null, dropPosition: null })
      return
    }

    const position = getDropPosition(e, dropLayerKey)

    onReorder(dragNode.cssSelector, dropNode.cssSelector, position)
    setDragState({ dragKey: null, dropKey: null, dropPosition: null })
  }, [nodeByKey, onReorder, getDropPosition])

  if (tree.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-xs text-muted-foreground">
        {t`No rendered HTML for this section`}
      </div>
    )
  }

  return (
    <div className="px-2 py-2 space-y-0">
      {tree.map((node) => (
        <LayerNodeRow
          key={node.layerKey}
          node={node}
          depth={0}
          selectedDataId={selectedDataId}
          prunedDataIds={prunedDataIds}
          expandedPaths={expandedPaths}
          toggleExpand={toggleExpand}
          onSelect={onSelect}
          onMove={onMove}
          dragState={dragState}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          disabled={disabled}
        />
      ))}
    </div>
  )
}

// -- Drag types --

const DRAG_TYPE_GROUP = "application/x-group-index"
const DRAG_TYPE_TEXT = "application/x-text-entry"

// -- Nested group renderer --

function GroupPartView({
  group,
  partIndex,
  bookLabel,
  showPrunedImages,
  pipelineRunning,
  onTogglePartPruned,
  t,
  depth = 0,
}: {
  group: import("@adt/types").SectionGroupPartType
  partIndex: number
  bookLabel: string
  showPrunedImages: boolean
  pipelineRunning?: boolean
  onTogglePartPruned: (partIndex: number) => void
  t: ReturnType<typeof useLingui>["t"]
  depth?: number
}) {
  const [expanded, setExpanded] = useState(true)

  // Color accents by groupType
  const isOptionGroup = group.groupType === "option_group"
  const isOption = group.groupType === "option"
  const borderColor = isOptionGroup ? "border-violet-300" : isOption ? "border-amber-300" : "border-sky-300"
  const headerBg = isOptionGroup ? "bg-violet-50" : isOption ? "bg-amber-50" : "bg-sky-50"
  const iconColor = isOptionGroup ? "text-violet-500" : isOption ? "text-amber-500" : "text-sky-500"

  // Compact mode: option with a single text_group containing one entry → show text inline
  const compactText = isOption
    && group.parts.length === 1
    && group.parts[0].type === "text_group"
    && group.parts[0].texts.length === 1
    ? group.parts[0].texts[0]
    : null

  if (compactText) {
    return (
      <div className={cn("rounded border overflow-hidden flex items-center gap-1.5 px-3 py-1.5", borderColor, headerBg, group.isPruned && "opacity-40")}>
        <FolderOpen className={cn("h-3 w-3 shrink-0", iconColor)} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.groupType}</span>
        <span className={cn("text-xs flex-1 min-w-0 break-words", compactText.isPruned && "opacity-40")}>{compactText.text}</span>
        {group.answer && (
          <span className="shrink-0 text-[10px] font-medium text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">{group.answer}</span>
        )}
      </div>
    )
  }

  return (
    <div className={cn("rounded border overflow-hidden", borderColor, group.isPruned && "opacity-40")} style={{ marginLeft: depth > 0 ? 0 : undefined }}>
      {/* Group header */}
      <div className={cn("px-3 py-1.5 border-b flex items-center gap-1.5", headerBg, borderColor)}>
        <button type="button" onClick={() => setExpanded(!expanded)} className="p-0.5 rounded hover:bg-accent/50 transition-colors cursor-pointer">
          {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </button>
        <FolderOpen className={cn("h-3 w-3 shrink-0", iconColor)} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.groupType}</span>
        {group.answer && (
          <span className="text-[10px] font-medium text-amber-700 bg-amber-100 rounded px-1.5 py-0.5 ml-1">{group.answer}</span>
        )}
        <span className="text-[10px] text-muted-foreground/60 ml-auto">{group.parts.length}</span>
        <button type="button" onClick={() => onTogglePartPruned(partIndex)} disabled={!!pipelineRunning} className="p-0.5 rounded hover:bg-accent transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default" title={group.isPruned ? t`Include in render` : t`Exclude from render`}>
          {group.isPruned ? <EyeOff className="h-3 w-3 text-muted-foreground" /> : <Eye className="h-3 w-3 text-muted-foreground" />}
        </button>
      </div>

      {/* Group children */}
      {expanded && (
        <div className="pl-3 pr-1 py-1.5 space-y-1.5">
          {group.reasoning && (
            <div className="text-[10px] text-muted-foreground/70 italic px-1 py-0.5">{group.reasoning}</div>
          )}
          {group.parts.map((child, childIdx) => {
            if (child.type === "text_group") {
              return (
                <div key={child.groupId} className={cn("rounded border overflow-hidden", child.isPruned && "opacity-40")}>
                  <div className="px-2 py-1 bg-muted/30 border-b flex items-center gap-1">
                    <Type className="h-2.5 w-2.5 text-blue-500 shrink-0" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{child.groupType}</span>
                  </div>
                  <div className="divide-y">
                    {child.texts.map((te) => (
                      <div key={te.textId} className={cn("px-2 py-1 flex items-start gap-1.5 text-xs", te.isPruned && "opacity-40")}>
                        <span className="shrink-0 text-[9px] font-medium text-muted-foreground bg-muted/50 rounded px-1 py-0.5">{te.textType}</span>
                        <span className="flex-1 min-w-0 break-words">{te.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }

            if (child.type === "image") {
              if (child.isPruned && !showPrunedImages) return null
              return (
                <div key={child.imageId} className={cn("rounded border overflow-hidden", child.isPruned && "opacity-40")}>
                  <div className="px-2 py-1 bg-muted/30 border-b flex items-center gap-1">
                    <Image className="h-2.5 w-2.5 text-green-600 shrink-0" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{child.imageId}</span>
                  </div>
                  <ImageCard imageId={child.imageId} bookLabel={bookLabel} isPruned={child.isPruned} reason={child.reason} />
                </div>
              )
            }

            if (child.type === "group") {
              return (
                <GroupPartView
                  key={child.groupId}
                  group={child}
                  partIndex={partIndex}
                  bookLabel={bookLabel}
                  showPrunedImages={showPrunedImages}
                  pipelineRunning={pipelineRunning}
                  onTogglePartPruned={onTogglePartPruned}
                  t={t}
                  depth={depth + 1}
                />
              )
            }

            return null
          })}
        </div>
      )}
    </div>
  )
}

// -- Component --

export function SectionDataPanel({
  open,
  onClose,
  section,
  sectionIndex,
  sectionCount,
  bookLabel,
  sectionTypes,
  textTypes,
  groupTypes,
  activityAnswers,
  onChangeSectionType,
  onToggleSectionPruned,
  onTogglePartPruned,
  onChangeGroupType,
  onChangeTextType,
  onToggleTextPruned,
  onDeleteTextEntry,
  onDuplicateTextEntry,
  onEditText,
  onAddGroup,
  onDuplicateGroup,
  onDeleteGroup,
  onReorderParts,
  onMoveText,
  onMergeSection,
  onMergeCrossPage,
  hasPrevPage,
  hasNextPage,
  onCloneSection,
  onDeleteSection,
  onRerender,
  onAddImage,
  onUpdateAnswer,
  versionPickerNode,
  pipelineRunning,
  merging,
  cloning,
  deleting,
  saving,
  rerendering,
  dirty,
  renderingDirty,
  hasApiKey,
  showPrunedImages,
  onToggleShowPrunedImages,
  sectionHtml,
  selectedDataId,
  onSelectElement,
  onMoveElement,
  onReorderElement,
  prunedDataIds,
}: SectionDataPanelProps) {
  const { t } = useLingui()
  const [activeTab, setActiveTab] = useState<"content" | "layers" | "json">("content")
  const [rerenderOpen, setRerenderOpen] = useState(false)
  const [rerenderPrompt, setRerenderPrompt] = useState("")
  const parts = section.parts

  const hasTextParts = parts.some((p) => p.type === "text_group" || (p.type === "group" && p.parts.some((c) => c.type === "text_group")))
  const hasImageParts = parts.some((p) => p.type === "image" || (p.type === "group" && p.parts.some((c) => c.type === "image")))

  // -- Group drag state --
  const [dragGroupIdx, setDragGroupIdx] = useState<number | null>(null)
  // dropGroupSlot tracks the insertion point: "before:3" means insert before partIndex 3, "after:3" means insert after
  const [dropGroupSlot, setDropGroupSlot] = useState<string | null>(null)

  // -- Text drag state --
  const [dragText, setDragText] = useState<{
    partIndex: number
    textIndex: number
  } | null>(null)
  const [dropTarget, setDropTarget] = useState<{
    partIndex: number
    textIndex: number
  } | null>(null)
  const dragCounterRef = useRef(0)

  // -- Group drag handlers --
  const handleGroupDragStart = useCallback(
    (e: React.DragEvent, partIndex: number) => {
      e.dataTransfer.effectAllowed = "move"
      e.dataTransfer.setData(DRAG_TYPE_GROUP, String(partIndex))
      setDragGroupIdx(partIndex)
    },
    []
  )

  const handleGroupDragEnd = useCallback(() => {
    setDragGroupIdx(null)
    setDropGroupSlot(null)
  }, [])

  const handleGroupDragOver = useCallback(
    (e: React.DragEvent, partIndex: number) => {
      if (dragGroupIdx === null) return
      if (!e.dataTransfer.types.includes(DRAG_TYPE_GROUP)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = "move"
      // Determine if cursor is in the top or bottom half of the element
      const rect = e.currentTarget.getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      const slot = e.clientY < midY ? `before:${partIndex}` : `after:${partIndex}`
      setDropGroupSlot(slot)
    },
    [dragGroupIdx]
  )

  // Drop zone between groups: handles drops in the gaps
  const handleGapDragOver = useCallback(
    (e: React.DragEvent, insertBeforePartIndex: number) => {
      if (dragGroupIdx === null) return
      if (!e.dataTransfer.types.includes(DRAG_TYPE_GROUP)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = "move"
      setDropGroupSlot(`before:${insertBeforePartIndex}`)
    },
    [dragGroupIdx]
  )

  const handleGroupDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!dropGroupSlot) return
      const fromStr = e.dataTransfer.getData(DRAG_TYPE_GROUP)
      if (!fromStr) return
      const fromIndex = parseInt(fromStr, 10)
      const [position, idxStr] = dropGroupSlot.split(":")
      const targetIdx = parseInt(idxStr, 10)
      const toIndex = position === "after" ? targetIdx + 1 : targetIdx
      // Adjust: if dragging from before the insertion point, the removal shifts indices
      const adjustedTo = fromIndex < toIndex ? toIndex - 1 : toIndex
      if (fromIndex !== adjustedTo) {
        onReorderParts(fromIndex, adjustedTo)
      }
      setDragGroupIdx(null)
      setDropGroupSlot(null)
    },
    [onReorderParts, dropGroupSlot]
  )

  // -- Text drag handlers --
  const handleTextDragStart = useCallback(
    (e: React.DragEvent, partIndex: number, textIndex: number) => {
      e.stopPropagation() // don't trigger group drag
      e.dataTransfer.effectAllowed = "move"
      e.dataTransfer.setData(
        DRAG_TYPE_TEXT,
        JSON.stringify({ partIndex, textIndex })
      )
      setDragText({ partIndex, textIndex })
    },
    []
  )

  const handleTextDragEnd = useCallback(() => {
    setDragText(null)
    setDropTarget(null)
    dragCounterRef.current = 0
  }, [])

  const handleTextDragOver = useCallback(
    (e: React.DragEvent, partIndex: number, textIndex: number) => {
      if (!dragText) return
      if (!e.dataTransfer.types.includes(DRAG_TYPE_TEXT)) return
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = "move"
      setDropTarget({ partIndex, textIndex })
    },
    [dragText]
  )

  const handleGroupBodyDragOver = useCallback(
    (e: React.DragEvent, partIndex: number, textCount: number) => {
      if (!dragText) return
      if (!e.dataTransfer.types.includes(DRAG_TYPE_TEXT)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = "move"
      // Drop at the end of the group
      setDropTarget({ partIndex, textIndex: textCount })
    },
    [dragText]
  )

  const handleTextDrop = useCallback(
    (e: React.DragEvent, toPartIndex: number, toTextIndex: number) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE_TEXT)) return // let group drops bubble up
      e.preventDefault()
      e.stopPropagation()
      const raw = e.dataTransfer.getData(DRAG_TYPE_TEXT)
      if (!raw) return
      const { partIndex: fromPartIndex, textIndex: fromTextIndex } = JSON.parse(
        raw
      ) as { partIndex: number; textIndex: number }

      if (fromPartIndex === toPartIndex && fromTextIndex === toTextIndex) {
        // No-op
      } else {
        onMoveText(fromPartIndex, fromTextIndex, toPartIndex, toTextIndex)
      }
      setDragText(null)
      setDropTarget(null)
      dragCounterRef.current = 0
    },
    [onMoveText]
  )

  const handleGroupBodyDrop = useCallback(
    (e: React.DragEvent, partIndex: number, textCount: number) => {
      handleTextDrop(e, partIndex, textCount)
    },
    [handleTextDrop]
  )

  return (
    <div
      className={`absolute top-0 right-0 h-full w-[480px] flex flex-col bg-background border-l shadow-lg transition-transform duration-200 ease-in-out z-30 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {/* Panel header */}
      <div className="border-b">
        <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
          <span className="font-medium uppercase tracking-wider">{t`Content`}</span>
          {sectionTypes ? (
            <Select
              value={section.sectionType}
              onValueChange={onChangeSectionType}
              disabled={pipelineRunning}
            >
              <SelectTrigger className="h-6 text-[10px] font-medium px-1.5 py-0 w-auto min-w-[80px] border-0 bg-muted/50">
                <SelectValue>
                  {getSectionTypeDisplayLabel(section.sectionType)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(sectionTypes).map(([key, desc]) => (
                  <SelectItem key={key} value={key} className="text-xs">
                    {getSectionTypeDisplayLabel(key)}
                    <span className="ml-1 text-muted-foreground text-[10px]">
                      {getSectionTypeDisplayDescription(key, desc)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="font-medium">{getSectionTypeDisplayLabel(section.sectionType)}</span>
          )}
          {/* Re-render button — right next to section type */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setRerenderOpen(!rerenderOpen)}
              disabled={rerendering || pipelineRunning || dirty || renderingDirty || saving || !hasApiKey}
              className="p-0.5 rounded hover:bg-accent transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
              title={
                pipelineRunning
                  ? t`Wait for storyboard to complete`
                  : !hasApiKey
                    ? t`API key required to re-render`
                    : dirty
                      ? t`Save changes before re-rendering`
                      : renderingDirty
                        ? t`Re-render (your edits will be preserved)`
                      : t`Re-render this section`
              }
            >
              {rerendering ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
              )}
            </button>
            {rerenderOpen && (
              <div className="absolute left-0 top-full mt-1 z-50 w-72 rounded-lg border bg-popover p-3 shadow-lg">
                <p className="text-xs font-medium mb-2">{t`Re-render section`}</p>
                <textarea
                  value={rerenderPrompt}
                  onChange={(e) => setRerenderPrompt(e.target.value)}
                  placeholder={t`Optional instructions for the LLM...`}
                  className="w-full text-xs rounded border bg-background px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  rows={3}
                />
                <div className="flex items-center justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRerenderOpen(false)
                      setRerenderPrompt("")
                    }}
                    className="text-xs px-2 py-1 rounded hover:bg-accent transition-colors cursor-pointer"
                  >
                    {t`Cancel`}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onRerender(rerenderPrompt.trim() || undefined)
                      setRerenderOpen(false)
                      setRerenderPrompt("")
                    }}
                    className="text-xs px-2.5 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                  >
                    {t`Re-render`}
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <SectionActionsDropdown
              sectionIndex={sectionIndex}
              sectionCount={sectionCount}
              isPruned={section.isPruned}
              hasPrevPage={hasPrevPage}
              hasNextPage={hasNextPage}
              onTogglePrune={onToggleSectionPruned}
              onMerge={onMergeSection}
              onMergeCrossPage={onMergeCrossPage}
              onClone={onCloneSection}
              onDelete={onDeleteSection}
              disabled={merging || cloning || deleting || dirty || renderingDirty || saving || !!pipelineRunning}
            />
            {versionPickerNode}
            <button
              type="button"
              onClick={onClose}
              className="p-0.5 rounded hover:bg-accent transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {/* Page row — background & text color */}
        {!section.isPruned && (
          <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-muted-foreground border-t">
            <span className="font-medium uppercase tracking-wider">{t`Page`}</span>
            <span
              className="w-3.5 h-3.5 rounded border"
              style={{ backgroundColor: section.backgroundColor }}
              title={t`Background: ${section.backgroundColor}`}
            />
            <span className="text-[10px]">{section.backgroundColor}</span>
            <span
              className="w-3.5 h-3.5 rounded border ml-2"
              style={{ backgroundColor: section.textColor }}
              title={t`Text color: ${section.textColor}`}
            />
            <span className="text-[10px]">{section.textColor}</span>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex border-b bg-muted/20">
        <button
          type="button"
          onClick={() => setActiveTab("content")}
          className={cn(
            "flex-1 text-[10px] font-medium uppercase tracking-wider py-1.5 transition-colors cursor-pointer",
            activeTab === "content"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t`Content`}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("layers")}
          className={cn(
            "flex-1 text-[10px] font-medium uppercase tracking-wider py-1.5 transition-colors cursor-pointer",
            activeTab === "layers"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t`Layers`}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("json")}
          className={cn(
            "flex-1 text-[10px] font-medium uppercase tracking-wider py-1.5 transition-colors cursor-pointer",
            activeTab === "json"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t`JSON`}
        </button>
      </div>

      {/* Pipeline running banner */}
      {pipelineRunning && (
        <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 border-b text-xs text-violet-700">
          <Loader2 className="h-3 w-3 animate-spin shrink-0" />
          {t`Editing is disabled while the storyboard is running`}
        </div>
      )}

      {/* Layers tab — scrollable */}
      {activeTab === "layers" && (
        <div className="overflow-auto flex-1">
          {sectionHtml ? (
            <LayersPanel
              html={sectionHtml}
              selectedDataId={selectedDataId}
              prunedDataIds={prunedDataIds ? new Set(prunedDataIds) : undefined}
              onSelect={onSelectElement}
              onMove={onMoveElement}
              onReorder={onReorderElement}
              disabled={!!pipelineRunning}
            />
          ) : (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              {t`No rendered HTML for this section`}
            </div>
          )}
        </div>
      )}

      {/* Content tab — scrollable */}
      {activeTab === "content" && (
      <div className="overflow-auto flex-1 px-4 py-3 space-y-2">
        {/* Unified parts list — renders text_group, image, and group in document order */}
        {parts.map((p, partIndex) => {
          if (p.type === "text_group") {
            const isGroupDragging = dragGroupIdx === partIndex
            const showDropLine = dropGroupSlot === `before:${partIndex}` && dragGroupIdx !== null && dragGroupIdx !== partIndex
            return (
              <div key={p.groupId}>
                {showDropLine && <div className="h-0.5 bg-primary rounded-full mb-1" />}
                <div
                  className={`group/card rounded border overflow-hidden transition-all duration-150 ${
                    p.isPruned ? "opacity-40" : ""
                  } ${isGroupDragging ? "opacity-50 scale-[0.98]" : ""}`}
                  onDragOver={(e) => handleGroupDragOver(e, partIndex)}
                  onDrop={handleGroupDrop}
                >
                  <div className="px-3 py-1.5 bg-muted/50 border-b flex items-center gap-1.5">
                    <div
                      draggable={!pipelineRunning}
                      onDragStart={(e) => { if (pipelineRunning) { e.preventDefault(); return } handleGroupDragStart(e, partIndex) }}
                      onDragEnd={handleGroupDragEnd}
                      className={cn("p-0.5 -ml-1 rounded transition-colors opacity-0 group-hover/card:opacity-100", pipelineRunning ? "cursor-default opacity-30" : "cursor-grab active:cursor-grabbing hover:bg-accent")}
                      title={pipelineRunning ? undefined : t`Drag to reorder`}
                    >
                      <GripVertical className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <Type className="h-3 w-3 text-blue-500 shrink-0" />
                    {groupTypes ? (
                      <Select value={p.groupType} onValueChange={(val) => onChangeGroupType(partIndex, val)} disabled={pipelineRunning}>
                        <SelectTrigger className="h-5 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0 w-auto min-w-[60px] border-0 bg-transparent text-muted-foreground">
                          <SelectValue>{p.groupType}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(groupTypes).map(([key, desc]) => (
                            <SelectItem key={key} value={key} className="text-xs">
                              {key}
                              <span className="ml-1 text-muted-foreground text-[10px]">{desc}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{p.groupType}</span>
                    )}
                    <div className="ml-auto flex items-center gap-0.5">
                      <button type="button" onClick={() => onDuplicateGroup(partIndex)} disabled={pipelineRunning} className="p-0.5 rounded hover:bg-accent transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default" title={t`Duplicate group`}>
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      </button>
                      {p.isPruned && (
                        <button type="button" onClick={() => onDeleteGroup(partIndex)} disabled={pipelineRunning} className="p-0.5 rounded hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default" title={t`Delete group`}>
                          <Trash2 className="h-3 w-3 text-red-600" />
                        </button>
                      )}
                      <button type="button" onClick={() => onTogglePartPruned(partIndex)} disabled={pipelineRunning} className="p-0.5 rounded hover:bg-accent transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default" title={p.isPruned ? t`Include in render` : t`Exclude from render`}>
                        {p.isPruned ? <EyeOff className="h-3 w-3 text-muted-foreground" /> : <Eye className="h-3 w-3 text-muted-foreground" />}
                      </button>
                    </div>
                  </div>
                  <div
                    className="divide-y"
                    onDragOver={(e) => handleGroupBodyDragOver(e, partIndex, p.texts.length)}
                    onDrop={(e) => handleGroupBodyDrop(e, partIndex, p.texts.length)}
                  >
                    {p.texts.length === 0 && (
                      <div className="px-3 py-3 text-xs text-muted-foreground/50 italic text-center">{t`Empty group — drag text entries here`}</div>
                    )}
                    {p.texts.map((textEntry, ti) => {
                      const isTextDragging = dragText?.partIndex === partIndex && dragText?.textIndex === ti
                      const isTextDropTarget = dropTarget?.partIndex === partIndex && dropTarget?.textIndex === ti && dragText !== null
                      return (
                        <div
                          key={textEntry.textId}
                          className={`group/text px-3 py-1.5 flex items-start gap-2 text-sm transition-all duration-150 ${textEntry.isPruned ? "opacity-40" : ""} ${isTextDragging ? "opacity-30 bg-muted/30" : ""} ${isTextDropTarget ? "border-t-2 !border-t-primary" : ""}`}
                          onDragOver={(e) => handleTextDragOver(e, partIndex, ti)}
                          onDrop={(e) => handleTextDrop(e, partIndex, ti)}
                        >
                          <div
                            draggable={!pipelineRunning}
                            onDragStart={(e) => { if (pipelineRunning) { e.preventDefault(); return } handleTextDragStart(e, partIndex, ti) }}
                            onDragEnd={handleTextDragEnd}
                            className={cn("shrink-0 p-0.5 mt-0.5 rounded transition-colors opacity-0 group-hover/text:opacity-100", pipelineRunning ? "cursor-default opacity-30" : "cursor-grab active:cursor-grabbing hover:bg-accent")}
                            title={pipelineRunning ? undefined : t`Drag to reorder or move to another group`}
                          >
                            <GripVertical className="h-3 w-3 text-muted-foreground/50" />
                          </div>
                          {textTypes ? (
                            <Select value={textEntry.textType} onValueChange={(val) => onChangeTextType(partIndex, ti, val)} disabled={pipelineRunning}>
                              <SelectTrigger className="shrink-0 h-5 text-[10px] font-medium px-1.5 py-0 w-auto min-w-[60px] border-0 bg-muted/50">
                                <SelectValue>{textEntry.textType}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(textTypes).map(([key, desc]) => (
                                  <SelectItem key={key} value={key} className="text-xs">
                                    {key}
                                    <span className="ml-1 text-muted-foreground text-[10px]">{desc}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="shrink-0 text-xs font-medium text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5 text-center">{textEntry.textType}</span>
                          )}
                          <EditableText value={textEntry.text} onCommit={(newText) => onEditText(partIndex, ti, newText)} disabled={pipelineRunning} />
                          <div className="shrink-0 flex items-center gap-0.5 self-center opacity-0 group-hover/text:opacity-100 transition-opacity">
                            <button type="button" onClick={() => onDuplicateTextEntry(partIndex, ti)} disabled={pipelineRunning} className="p-0.5 rounded hover:bg-accent transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default" title={t`Duplicate text entry`}>
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            </button>
                            {textEntry.isPruned && (
                              <button type="button" onClick={() => onDeleteTextEntry(partIndex, ti)} disabled={pipelineRunning} className="p-0.5 rounded hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default" title={t`Delete text entry`}>
                                <Trash2 className="h-3 w-3 text-red-600" />
                              </button>
                            )}
                            <button type="button" onClick={() => onToggleTextPruned(partIndex, ti)} disabled={pipelineRunning} className="p-0.5 rounded hover:bg-accent transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default" title={textEntry.isPruned ? t`Include in render` : t`Exclude from render`}>
                              {textEntry.isPruned ? <EyeOff className="h-3 w-3 text-muted-foreground" /> : <Eye className="h-3 w-3 text-muted-foreground" />}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          }

          if (p.type === "image") {
            if (p.isPruned && !showPrunedImages) return null
            return (
              <div key={p.imageId} className="group/card relative">
                <div className={`rounded border overflow-hidden ${p.isPruned ? "opacity-40" : ""}`}>
                  <div className="px-3 py-1.5 bg-muted/50 border-b flex items-center gap-1.5">
                    <Image className="h-3 w-3 text-green-600 shrink-0" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{p.imageId}</span>
                    <div className="ml-auto">
                      <button type="button" onClick={() => onTogglePartPruned(partIndex)} disabled={pipelineRunning} className="p-0.5 rounded hover:bg-accent transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default" title={p.isPruned ? t`Include in render` : t`Exclude from render`}>
                        {p.isPruned ? <EyeOff className="h-3 w-3 text-muted-foreground" /> : <Eye className="h-3 w-3 text-muted-foreground" />}
                      </button>
                    </div>
                  </div>
                  <ImageCard imageId={p.imageId} bookLabel={bookLabel} isPruned={p.isPruned} reason={p.reason} />
                </div>
              </div>
            )
          }

          if (p.type === "group") {
            return (
              <GroupPartView
                key={p.groupId}
                group={p}
                partIndex={partIndex}
                bookLabel={bookLabel}
                showPrunedImages={showPrunedImages}
                pipelineRunning={pipelineRunning}
                onTogglePartPruned={onTogglePartPruned}
                t={t}
              />
            )
          }

          return null
        })}

        {/* Drop zone after the last part */}
        {dragGroupIdx !== null && (() => {
          const lastIdx = parts.length - 1
          const showDropLine = dropGroupSlot === `after:${lastIdx}` && dragGroupIdx !== lastIdx
          return (
            <div
              className="py-1.5"
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(DRAG_TYPE_GROUP)) return
                e.preventDefault()
                e.dataTransfer.dropEffect = "move"
                setDropGroupSlot(`after:${lastIdx}`)
              }}
              onDrop={handleGroupDrop}
            >
              {showDropLine && <div className="h-0.5 bg-primary rounded-full" />}
            </div>
          )
        })()}

        {/* Add group / Add image buttons */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onAddGroup}
            disabled={pipelineRunning}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded border border-dashed py-2.5 text-xs transition-colors",
              pipelineRunning
                ? "border-muted-foreground/20 text-muted-foreground/50 cursor-default"
                : "border-muted-foreground/30 hover:border-muted-foreground/60 text-muted-foreground hover:text-foreground cursor-pointer"
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            {t`Add Group`}
          </button>
          <button
            type="button"
            onClick={onAddImage}
            disabled={pipelineRunning}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded border border-dashed py-2.5 text-xs transition-colors",
              pipelineRunning
                ? "border-muted-foreground/20 text-muted-foreground/50 cursor-default"
                : "border-muted-foreground/30 hover:border-muted-foreground/60 text-muted-foreground hover:text-foreground cursor-pointer"
            )}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            {t`Add Image`}
          </button>
        </div>

        {/* Activity Answers */}
        {activityAnswers && Object.keys(activityAnswers).length > 0 && (
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              {t`Answers`}
            </h3>
            <div className="space-y-1.5">
              {Object.entries(activityAnswers)
                .sort(([a], [b]) => {
                  const numA = parseInt(a.replace(/\D/g, ""), 10) || 0
                  const numB = parseInt(b.replace(/\D/g, ""), 10) || 0
                  return numA - numB
                })
                .map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 px-3 py-1.5 rounded border bg-amber-50/60">
                    <span className="shrink-0 text-[10px] font-medium text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">
                      {key}
                    </span>
                    <input
                      type="text"
                      value={String(value)}
                      onChange={(e) => onUpdateAnswer(key, e.target.value)}
                      disabled={pipelineRunning}
                      className="flex-1 min-w-0 text-xs rounded border border-transparent bg-transparent px-1.5 py-1 hover:border-border hover:bg-white focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors disabled:opacity-50 disabled:cursor-default"
                    />
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
      )}

      {/* JSON tab — raw sectioning data */}
      {activeTab === "json" && (
      <div className="overflow-auto flex-1 p-2">
        <pre className="text-[10px] leading-relaxed font-mono whitespace-pre-wrap break-all bg-muted/30 rounded p-3 select-text">
          {JSON.stringify(section, (_key, value) => {
            if (_key === "imageBase64") return undefined
            return value
          }, 2)}
        </pre>
      </div>
      )}
    </div>
  )
}
