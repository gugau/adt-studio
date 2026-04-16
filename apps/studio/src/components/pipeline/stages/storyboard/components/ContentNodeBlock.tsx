import { useState, useRef, useCallback, useEffect, type ReactNode } from "react"
import {
  AlignLeft,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  Hash,
  Image,
  Layers,
  List,
  MessageSquare,
  PanelTop,
  Puzzle,
  SquarePen,
  TextCursorInput,
  Type,
} from "lucide-react"
import { BASE_URL } from "@/api/client"
import type { ContentNodeData } from "@adt/types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useLingui } from "@lingui/react/macro"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Type styling — maps type names to colors and icons
// ---------------------------------------------------------------------------

type TypeStyle = { bg: string; text: string; borderL: string; icon: ReactNode }

const IC = "h-3 w-3"

// Color categories:
//   purple = activity-related
//   blue   = groups (group, list, panel, sidebar, list_item)
//   grey   = text / general
//   amber  = headings
//   green  = images
const PURPLE: Pick<TypeStyle, "bg" | "text" | "borderL"> = { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-400", borderL: "border-l-violet-400/60 dark:border-l-violet-500/40" }
const BLUE: Pick<TypeStyle, "bg" | "text" | "borderL"> = { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", borderL: "border-l-blue-400/60 dark:border-l-blue-500/40" }
const GREY: Pick<TypeStyle, "bg" | "text" | "borderL"> = { bg: "bg-gray-100 dark:bg-gray-800/40", text: "text-gray-600 dark:text-gray-400", borderL: "border-l-gray-300/60 dark:border-l-gray-600/40" }
const AMBER: Pick<TypeStyle, "bg" | "text" | "borderL"> = { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", borderL: "border-l-amber-400/60 dark:border-l-amber-500/40" }
const GREEN: Pick<TypeStyle, "bg" | "text" | "borderL"> = { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", borderL: "border-l-emerald-400/60 dark:border-l-emerald-500/40" }

const CONTAINER_STYLES: Record<string, TypeStyle> = {
  activity: { ...PURPLE, icon: <Puzzle className={IC} /> },
  group: { ...BLUE, icon: <Layers className={IC} /> },
  image_group: { ...GREEN, icon: <Image className={IC} /> },
  list: { ...BLUE, icon: <List className={IC} /> },
  list_item: { ...BLUE, icon: <List className={IC} /> },
  panel: { ...BLUE, icon: <PanelTop className={IC} /> },
  sidebar: { ...BLUE, icon: <PanelTop className={IC} /> },
}

const LEAF_STYLES: Record<string, TypeStyle> = {
  text: { ...GREY, icon: <Type className={IC} /> },
  heading: { ...AMBER, icon: <Hash className={IC} /> },
  section_heading: { ...AMBER, icon: <Hash className={IC} /> },
  activity_instruction: { ...PURPLE, icon: <SquarePen className={IC} /> },
  activity_question: { ...PURPLE, icon: <MessageSquare className={IC} /> },
  activity_option: { ...PURPLE, icon: <Puzzle className={IC} /> },
  activity_number: { ...PURPLE, icon: <Puzzle className={IC} /> },
  activity_fill_in_the_blank: { ...PURPLE, icon: <TextCursorInput className={IC} /> },
  instruction_text: { ...PURPLE, icon: <SquarePen className={IC} /> },
  caption: { ...GREY, icon: <AlignLeft className={IC} /> },
  label: { ...GREY, icon: <AlignLeft className={IC} /> },
  quote: { ...GREY, icon: <MessageSquare className={IC} /> },
  math: { ...GREY, icon: <Type className={IC} /> },
  page_number: { ...GREY, icon: <Type className={IC} /> },
  book_metadata: { ...GREY, icon: <Type className={IC} /> },
  header: { ...GREY, icon: <Type className={IC} /> },
  footer: { ...GREY, icon: <Type className={IC} /> },
  image: { ...GREEN, icon: <Image className={IC} /> },
}

const DEFAULT_CONTAINER_STYLE: TypeStyle = { ...BLUE, icon: <Layers className={IC} /> }
const DEFAULT_LEAF_STYLE: TypeStyle = { ...GREY, icon: <Type className={IC} /> }

function getTypeStyle(typeName: string, isContainer: boolean): TypeStyle {
  // Check both maps — activity types can appear as containers or leaves
  if (isContainer) {
    if (CONTAINER_STYLES[typeName]) return CONTAINER_STYLES[typeName]
    // Activity sub-types used as containers (e.g. activity_option as a container)
    if (typeName.startsWith("activity")) return { ...PURPLE, icon: <Puzzle className={IC} /> }
    return DEFAULT_CONTAINER_STYLE
  }
  if (LEAF_STYLES[typeName]) return LEAF_STYLES[typeName]
  if (typeName.startsWith("activity")) return { ...PURPLE, icon: <Puzzle className={IC} /> }
  return DEFAULT_LEAF_STYLE
}


// ---------------------------------------------------------------------------
// EditableText — click-to-edit inline text
// ---------------------------------------------------------------------------

export function EditableText({
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
  const cancelRef = useRef(false)

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
          cancelRef.current = false
          e.currentTarget.blur()
        }
        if (e.key === "Escape") {
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
// TypePill — colored badge with icon for type labels
// ---------------------------------------------------------------------------

function TypePill({
  typeValue,
  isContainer,
  typeOptions,
  disabled,
  onChangeType,
  nodeId,
  expanded,
}: {
  typeValue: string
  isContainer: boolean
  typeOptions?: Record<string, string>
  disabled: boolean
  onChangeType: (nodeId: string, field: "structure" | "role", newType: string) => void
  nodeId: string
  /** When true, always show the label text (no hover needed). Use for container/group rows with no inline text. */
  expanded?: boolean
}) {
  const style = getTypeStyle(typeValue, isContainer)
  const label = typeValue.replace(/_/g, " ")

  const labelClass = expanded
    ? "ml-1 text-[9px] font-semibold uppercase tracking-wide"
    : "max-w-0 overflow-hidden opacity-0 group-hover/pill:max-w-[120px] group-hover/pill:opacity-100 group-hover/pill:ml-1 transition-all duration-150 text-[9px] font-semibold uppercase tracking-wide"

  const pillContent = (
    <span className={cn("group/pill inline-flex items-center gap-0 rounded px-1 py-0.5 whitespace-nowrap shrink-0", style.bg, style.text)}>
      {style.icon}
      <span className={labelClass}>
        {label}
      </span>
    </span>
  )

  if (!typeOptions) return pillContent

  return (
    <Select
      value={typeValue}
      onValueChange={(v) => onChangeType(nodeId, isContainer ? "structure" : "role", v)}
      disabled={disabled}
    >
      <SelectTrigger className={cn(
        "group/pill h-auto py-0.5 px-1 border-0 shadow-none rounded gap-0 min-w-0 w-auto shrink-0 focus:ring-1 focus:ring-ring/30 whitespace-nowrap",
        style.bg, style.text,
        !disabled && "hover:brightness-95 dark:hover:brightness-110",
      )}>
        {style.icon}
        <span className={labelClass}>
          <SelectValue>{label}</SelectValue>
        </span>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(typeOptions).map(([key, desc]) => {
          const s = getTypeStyle(key, isContainer)
          return (
            <SelectItem key={key} value={key} className="text-xs">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className={cn("inline-flex items-center gap-1 px-1 py-px rounded text-[10px] font-medium", s.bg, s.text)}>
                  {s.icon}
                  <span className="uppercase tracking-wide">{key.replace(/_/g, " ")}</span>
                </span>
                {desc && <span className="text-muted-foreground text-[10px] whitespace-normal">{desc}</span>}
              </span>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

// ---------------------------------------------------------------------------
// ContainerDropZone — minimal drop target at the bottom of containers
// ---------------------------------------------------------------------------

const DRAG_TYPE_NODE = "application/x-content-node"

function ContainerDropZone({ nodeId, childCount, disabled, onMoveNode }: {
  nodeId: string
  childCount: number
  disabled: boolean
  onMoveNode: (dragNodeId: string, targetParentId: string | null, insertIndex: number) => void
}) {
  const { t } = useLingui()
  const [active, setActive] = useState(false)
  return (
    <div
      className={cn(
        "rounded transition-colors text-center text-[10px]",
        active
          ? "border border-dashed border-primary bg-primary/5 text-primary py-1.5"
          : childCount === 0
            ? "border border-dashed border-border/40 py-1 text-muted-foreground/30 italic"
            : "py-0.5",
      )}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE_NODE)) return
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = "move"
        setActive(true)
      }}
      onDragLeave={() => setActive(false)}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        const dragId = e.dataTransfer.getData(DRAG_TYPE_NODE)
        if (dragId && !disabled) onMoveNode(dragId, nodeId, childCount)
        setActive(false)
      }}
    >
      {childCount === 0 ? t`Empty` : (active ? t`Drop here` : "")}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ContentNodeBlock — draggable block editor for content_node parts
// ---------------------------------------------------------------------------

export interface ContentNodeBlockProps {
  node: ContentNodeData
  parentId: string | null
  indexInParent: number
  bookLabel: string
  depth: number
  disabled: boolean
  containerTypes?: Record<string, string>
  leafTypes?: Record<string, string>
  onTogglePruned: (nodeId: string) => void
  onEditText: (nodeId: string, newText: string) => void
  onChangeType: (nodeId: string, field: "structure" | "role", newType: string) => void
  onMoveNode: (dragNodeId: string, targetParentId: string | null, insertIndex: number) => void
}

export function ContentNodeBlock({
  node,
  parentId,
  indexInParent,
  bookLabel,
  depth,
  disabled,
  containerTypes,
  leafTypes,
  onTogglePruned,
  onEditText,
  onChangeType,
  onMoveNode,
}: ContentNodeBlockProps) {
  const { t } = useLingui()
  const [collapsed, setCollapsed] = useState(false)
  const [dropPosition, setDropPosition] = useState<"before" | "inside" | "after" | null>(null)
  const hasChildren = node.children != null && node.children.length > 0
  const isContainer = hasChildren || (node.structure != null)
  const isText = node.text != null
  const imgSrc = node.imageId ? `${BASE_URL}/books/${bookLabel}/images/${node.imageId}` : null
  const isImageLeaf = !isContainer && !isText && !!node.imageId

  const handleDragStart = (e: React.DragEvent) => {
    if (disabled) { e.preventDefault(); return }
    e.dataTransfer.setData(DRAG_TYPE_NODE, node.nodeId)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE_NODE)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = "move"
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - rect.top
    if (isContainer) {
      if (y < rect.height * 0.25) setDropPosition("before")
      else if (y > rect.height * 0.75) setDropPosition("after")
      else setDropPosition("inside")
    } else {
      setDropPosition(y < rect.height / 2 ? "before" : "after")
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropPosition(null)
  }

  const isDescendant = (root: ContentNodeData, targetId: string): boolean => {
    if (root.nodeId === targetId) return true
    return root.children?.some((c) => isDescendant(c, targetId)) ?? false
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const dragId = e.dataTransfer.getData(DRAG_TYPE_NODE)
    if (!dragId || dragId === node.nodeId) { setDropPosition(null); return }
    if (isContainer && dropPosition === "inside" && isDescendant(node, dragId)) { setDropPosition(null); return }
    if (dropPosition === "before") onMoveNode(dragId, parentId, indexInParent)
    else if (dropPosition === "after") onMoveNode(dragId, parentId, indexInParent + 1)
    else if (dropPosition === "inside" && isContainer) onMoveNode(dragId, node.nodeId, node.children?.length ?? 0)
    setDropPosition(null)
  }

  const typeValue = isContainer ? (node.structure ?? "") : (node.role ?? "")
  const typeOptions = isContainer ? containerTypes : leafTypes
  const style = getTypeStyle(typeValue, isContainer)

  const dragHandle = (
    <div
      draggable={!disabled}
      onDragStart={handleDragStart}
      className={cn(
        "p-0.5 rounded shrink-0 opacity-0 group-hover/block:opacity-40 hover:!opacity-80 transition-opacity",
        disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing",
      )}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground" />
    </div>
  )

  const pruneBtn = (
    <button
      type="button"
      onClick={() => onTogglePruned(node.nodeId)}
      disabled={disabled}
      className="p-0.5 rounded hover:bg-muted transition-colors disabled:opacity-30 opacity-0 group-hover/block:opacity-60 hover:!opacity-100 shrink-0"
      title={node.isPruned ? t`Include in render` : t`Exclude from render`}
    >
      {node.isPruned ? <EyeOff className="h-3 w-3 text-destructive/60" /> : <Eye className="h-3 w-3 text-muted-foreground/40" />}
    </button>
  )

  const dropIndicator = (pos: "before" | "after") =>
    dropPosition === pos && <div className={cn("absolute left-0 right-0 h-0.5 bg-primary rounded-full z-10", pos === "before" ? "-top-px" : "-bottom-px")} />

  // Container block
  if (isContainer) {
    return (
      <div className="relative">
        {dropIndicator("before")}
        <div
          className={cn(
            "group/container rounded-md border border-border/25 border-l-2 transition-all",
            style.borderL,
            "hover:border-border/60",
            node.isPruned ? "opacity-40" : "",
            dropPosition === "inside" && "ring-1 ring-primary/50 bg-primary/5",
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Container header — pill flush against left border */}
          <div className="group/block flex items-center gap-1 px-1.5 py-0.5">
            <TypePill
              typeValue={typeValue}
              isContainer
              typeOptions={typeOptions}
              disabled={disabled}
              onChangeType={onChangeType}
              nodeId={node.nodeId}
              expanded
            />
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="shrink-0 p-0.5 text-muted-foreground/50 hover:text-muted-foreground rounded hover:bg-muted/60"
            >
              {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {collapsed && hasChildren && (
              <span className="text-[9px] text-muted-foreground/40">{node.children!.length}</span>
            )}
            <div className="ml-auto flex items-center gap-0.5">
              {dragHandle}
              {pruneBtn}
            </div>
          </div>
          {/* Children */}
          {!collapsed && (
            <div className="pl-5 pr-1 pb-1 space-y-0.5">
              {hasChildren && node.children!.map((child, ci) => (
                <ContentNodeBlock
                  key={child.nodeId}
                  node={child}
                  parentId={node.nodeId}
                  indexInParent={ci}
                  bookLabel={bookLabel}
                  depth={depth + 1}
                  disabled={disabled}
                  containerTypes={containerTypes}
                  leafTypes={leafTypes}
                  onTogglePruned={onTogglePruned}
                  onEditText={onEditText}
                  onChangeType={onChangeType}
                  onMoveNode={onMoveNode}
                />
              ))}
              <ContainerDropZone nodeId={node.nodeId} childCount={node.children?.length ?? 0} disabled={disabled} onMoveNode={onMoveNode} />
            </div>
          )}
        </div>
        {dropIndicator("after")}
      </div>
    )
  }

  // Text leaf block
  if (isText) {
    return (
      <div className="relative">
        {dropIndicator("before")}
        <div
          className={cn(
            "group/block flex items-start gap-1 rounded-md py-0.5 px-1.5 transition-colors",
            node.isPruned ? "opacity-40" : "hover:bg-accent/40 hover:outline hover:outline-1 hover:outline-border/50",
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <TypePill
            typeValue={typeValue}
            isContainer={false}
            typeOptions={typeOptions}
            disabled={disabled}
            onChangeType={onChangeType}
            nodeId={node.nodeId}
          />
          <div className="flex-1 min-w-0 text-[11px] leading-snug pt-px">
            <EditableText
              value={node.text!}
              onCommit={(newText) => onEditText(node.nodeId, newText)}
              disabled={disabled}
            />
          </div>
          {dragHandle}
          {pruneBtn}
        </div>
        {dropIndicator("after")}
      </div>
    )
  }

  // Image leaf block
  if (isImageLeaf && imgSrc) {
    return (
      <div className="relative">
        {dropIndicator("before")}
        <div
          className={cn(
            "group/block flex items-center gap-1 rounded-md py-0.5 px-1.5 transition-colors",
            node.isPruned ? "opacity-40" : "hover:bg-accent/40 hover:outline hover:outline-1 hover:outline-border/50",
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <span className={cn("inline-flex items-center rounded px-1 py-0.5 shrink-0", GREEN.bg, GREEN.text)}>
            <Image className={IC} />
          </span>
          <img src={imgSrc} alt={node.imageId ?? "image"} className="h-16 w-auto object-contain rounded border border-border/40" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
          <span className="text-[9px] text-muted-foreground/40 font-mono truncate">{node.imageId}</span>
          <div className="ml-auto flex items-center gap-0.5">
            {dragHandle}
            {pruneBtn}
          </div>
        </div>
        {dropIndicator("after")}
      </div>
    )
  }

  return null
}

// ---------------------------------------------------------------------------
// Tree manipulation helpers
// ---------------------------------------------------------------------------

/** Deep-update a node in a ContentNodeData tree by nodeId. Returns a new tree (immutable). */
export function updateNodeInTree(
  node: ContentNodeData,
  nodeId: string,
  updater: (n: ContentNodeData) => ContentNodeData,
): ContentNodeData {
  if (node.nodeId === nodeId) return updater(node)
  if (!node.children) return node
  let changed = false
  const updatedChildren = node.children.map((c) => {
    const updated = updateNodeInTree(c, nodeId, updater)
    if (updated !== c) changed = true
    return updated
  })
  return changed ? { ...node, children: updatedChildren } : node
}

/** Check if a node or any of its descendants has the given nodeId. */
export function treeContainsNode(root: ContentNodeData, nodeId: string): boolean {
  if (root.nodeId === nodeId) return true
  return root.children?.some((c) => treeContainsNode(c, nodeId)) ?? false
}

/** Remove a node from the tree. Returns [updatedTree, removedNode]. If the root itself matches, returns [null, root]. */
export function removeNodeFromTree(
  root: ContentNodeData,
  nodeId: string,
): [ContentNodeData | null, ContentNodeData | null] {
  if (root.nodeId === nodeId) return [null, root]
  if (!root.children) return [root, null]

  let found: ContentNodeData | null = null
  const filtered: ContentNodeData[] = []
  for (const child of root.children) {
    if (child.nodeId === nodeId) {
      found = child
      continue
    }
    if (!found) {
      const [updated, removed] = removeNodeFromTree(child, nodeId)
      if (removed) {
        found = removed
        if (updated) filtered.push(updated)
        continue
      }
    }
    filtered.push(child)
  }
  if (!found) return [root, null]
  return [{ ...root, children: filtered }, found]
}

/** Insert a node into a tree at the given parent and index. Returns null if targetParentId not found. */
export function insertNodeIntoTree(
  root: ContentNodeData,
  node: ContentNodeData,
  targetParentId: string | null,
  insertIndex: number,
): ContentNodeData | null {
  if (targetParentId === null || targetParentId === root.nodeId) {
    const children = [...(root.children ?? [])]
    children.splice(insertIndex, 0, node)
    return { ...root, children }
  }

  let inserted = false
  const walk = (n: ContentNodeData): ContentNodeData => {
    if (n.nodeId === targetParentId) {
      inserted = true
      const children = [...(n.children ?? [])]
      children.splice(insertIndex, 0, node)
      return { ...n, children }
    }
    if (!n.children) return n
    return { ...n, children: n.children.map(walk) }
  }
  const result = walk(root)
  return inserted ? result : null
}

/** Remove a node from the tree and insert it at a new position. Returns null if the drag node was not found. */
export function moveNodeInTree(
  root: ContentNodeData,
  dragNodeId: string,
  targetParentId: string | null,
  insertIndex: number,
): ContentNodeData | null {
  let draggedNode: ContentNodeData | null = null
  const removeNode = (n: ContentNodeData): ContentNodeData => {
    if (!n.children) return n
    const filtered = n.children.filter((c) => {
      if (c.nodeId === dragNodeId) { draggedNode = c; return false }
      return true
    }).map(removeNode)
    return { ...n, children: filtered }
  }
  const treeWithout = removeNode(root)
  if (!draggedNode) return null

  if (targetParentId === null || targetParentId === root.nodeId) {
    const children = [...(treeWithout.children ?? [])]
    children.splice(insertIndex, 0, draggedNode)
    return { ...treeWithout, children }
  }

  let inserted = false
  const insertInto = (n: ContentNodeData): ContentNodeData => {
    if (n.nodeId === targetParentId) {
      inserted = true
      const children = [...(n.children ?? [])]
      children.splice(insertIndex, 0, draggedNode!)
      return { ...n, children }
    }
    if (!n.children) return n
    return { ...n, children: n.children.map(insertInto) }
  }
  const result = insertInto(treeWithout)
  return inserted ? result : null
}
