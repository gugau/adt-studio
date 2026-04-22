import { useState, type ComponentType } from "react"
import {
  ChevronDown,
  ChevronRight,
  Copy,
  CornerLeftUp,
  CornerRightDown,
  Eye,
  EyeOff,
  GripVertical,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  List,
  MessageCircle,
  Plus,
  Sparkles,
  Type as TypeIcon,
  Trash2,
} from "lucide-react"
import { useLingui } from "@lingui/react/macro"
import type { ContentNodeData } from "@adt/types"
import { BASE_URL } from "@/api/client"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EditableText } from "./EditableText"
import { TREE_DRAG_TYPE } from "./SectionTreeEditor"

// ── Type-to-visual mapping ──────────────────────────────────────
// Each role/structure gets a distinct icon + accent color so the tree
// is scannable at a glance (activity vs panel vs text vs image, etc).

type Visual = {
  Icon: ComponentType<{ className?: string }>
  text: string // text color class
  bg: string // pill background class
  ring: string // subtle ring/border class
}

const DEFAULT_CONTAINER_VISUAL: Visual = {
  Icon: Layers,
  text: "text-slate-600",
  bg: "bg-slate-100",
  ring: "ring-slate-200",
}

const DEFAULT_LEAF_VISUAL: Visual = {
  Icon: TypeIcon,
  text: "text-slate-600",
  bg: "bg-slate-100",
  ring: "ring-slate-200",
}

function getStructureVisual(structure: string | undefined): Visual {
  switch (structure) {
    case "activity":
      return { Icon: Sparkles, text: "text-cyan-700", bg: "bg-cyan-50", ring: "ring-cyan-200" }
    case "panel":
      return { Icon: LayoutGrid, text: "text-violet-700", bg: "bg-violet-50", ring: "ring-violet-200" }
    case "list":
      return { Icon: List, text: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-200" }
    case "group":
      return DEFAULT_CONTAINER_VISUAL
    default:
      return DEFAULT_CONTAINER_VISUAL
  }
}

function getRoleVisual(role: string | undefined): Visual {
  switch (role) {
    case "image":
      return { Icon: ImageIcon, text: "text-emerald-700", bg: "bg-emerald-50", ring: "ring-emerald-200" }
    case "question":
    case "prompt":
      return { Icon: MessageCircle, text: "text-sky-700", bg: "bg-sky-50", ring: "ring-sky-200" }
    case "answer":
    case "fill_in":
    case "blank":
      return { Icon: HelpCircle, text: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-200" }
    default:
      return DEFAULT_LEAF_VISUAL
  }
}

export interface DragState {
  nodeId: string
}

export interface DropIntent {
  parentNodeId: string | null
  index: number
}

export interface TreeNodeProps {
  node: ContentNodeData
  parentNodeId: string | null
  indexInParent: number
  depth: number
  bookLabel: string
  textRoles?: Record<string, string>
  containerStructures?: Record<string, string>
  disabled?: boolean
  drag: DragState | null
  setDrag: (drag: DragState | null) => void
  onEditText: (nodeId: string, text: string) => void
  onSetRole: (nodeId: string, role: string) => void
  onSetStructure: (nodeId: string, structure: string) => void
  onTogglePruned: (nodeId: string) => void
  onDelete: (nodeId: string) => void
  onDuplicate: (nodeId: string) => void
  onNest: (nodeId: string, structure: string) => void
  onUnnest: (nodeId: string) => void
  onAddChildLeaf: (parentNodeId: string | null, role: string) => void
  onAddChildContainer: (parentNodeId: string | null, structure: string) => void
  onDrop: (sourceNodeId: string, target: DropIntent) => void
  defaultTextRole: string
  defaultStructure: string
}

export function TreeNode(props: TreeNodeProps) {
  const { node } = props
  if (node.role === "image") return <ImageLeaf {...props} />
  if (node.role) return <TextLeaf {...props} />
  return <ContainerNode {...props} />
}

// ── Shared drag handle ──────────────────────────────────────────

function DragHandle({
  nodeId,
  disabled,
  setDrag,
}: {
  nodeId: string
  disabled?: boolean
  setDrag: (drag: DragState | null) => void
}) {
  const { t } = useLingui()
  return (
    <div
      draggable={!disabled}
      onDragStart={(e) => {
        if (disabled) {
          e.preventDefault()
          return
        }
        e.stopPropagation()
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData(TREE_DRAG_TYPE, nodeId)
        setDrag({ nodeId })
      }}
      onDragEnd={() => setDrag(null)}
      className={cn(
        "shrink-0 p-0.5 rounded transition-colors",
        disabled
          ? "cursor-default opacity-30"
          : "cursor-grab active:cursor-grabbing hover:bg-accent opacity-0 group-hover/row:opacity-100"
      )}
      title={disabled ? undefined : t`Drag to move`}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground/70" />
    </div>
  )
}

// ── Drop zone slot (between siblings) ───────────────────────────

function DropZone({
  parentNodeId,
  index,
  drag,
  onDrop,
}: {
  parentNodeId: string | null
  index: number
  drag: DragState | null
  onDrop: (sourceNodeId: string, target: DropIntent) => void
}) {
  const [over, setOver] = useState(false)
  if (!drag) return null
  return (
    <div
      className={cn(
        "h-1 rounded-full my-0.5 transition-colors",
        over ? "bg-primary" : "bg-transparent"
      )}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(TREE_DRAG_TYPE)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const sourceId = e.dataTransfer.getData(TREE_DRAG_TYPE)
        if (!sourceId) return
        onDrop(sourceId, { parentNodeId, index })
      }}
    />
  )
}

// ── Container ───────────────────────────────────────────────────

function ContainerNode(props: TreeNodeProps) {
  const {
    node,
    depth,
    containerStructures,
    disabled,
    drag,
    setDrag,
    onSetStructure,
    onTogglePruned,
    onDelete,
    onDuplicate,
    onNest,
    onUnnest,
    onAddChildLeaf,
    onAddChildContainer,
    onDrop,
    defaultTextRole,
    defaultStructure,
    parentNodeId,
    bookLabel,
    textRoles,
    onEditText,
    onSetRole,
  } = props
  const { t } = useLingui()
  const [collapsed, setCollapsed] = useState(false)
  const children = node.children ?? []
  const structureLabel = node.structure ?? "group"
  const isDragging = drag?.nodeId === node.nodeId
  const visual = getStructureVisual(node.structure)

  return (
    <div
      className={cn(
        "group/row rounded border bg-card/40",
        node.isPruned && "opacity-40",
        isDragging && "opacity-30"
      )}
    >
      <div
        className={cn(
          "px-2 py-1 border-b flex items-center gap-1.5",
          visual.bg
        )}
      >
        <DragHandle nodeId={node.nodeId} disabled={disabled} setDrag={setDrag} />
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="p-0.5 rounded hover:bg-accent transition-colors cursor-pointer"
          title={collapsed ? t`Expand` : t`Collapse`}
        >
          {collapsed ? (
            <ChevronRight className={cn("h-3 w-3", visual.text)} />
          ) : (
            <ChevronDown className={cn("h-3 w-3", visual.text)} />
          )}
        </button>
        <visual.Icon className={cn("h-3.5 w-3.5 shrink-0", visual.text)} />
        {containerStructures ? (
          <Select
            value={node.structure ?? defaultStructure}
            onValueChange={(val) => onSetStructure(node.nodeId, val)}
            disabled={disabled}
          >
            <SelectTrigger
              className={cn(
                "h-5 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0 w-auto min-w-[80px] border-0 bg-transparent",
                visual.text
              )}
            >
              <SelectValue>{structureLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.keys(containerStructures).map((key) => (
                <SelectItem key={key} value={key} className="text-xs">
                  {key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wider",
              visual.text
            )}
          >
            {structureLabel}
          </span>
        )}
        <span className="text-[10px] font-mono text-muted-foreground/50 truncate">
          {node.nodeId}
        </span>
        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
          {parentNodeId != null && (
            <button
              type="button"
              onClick={() => onUnnest(node.nodeId)}
              disabled={disabled}
              className="p-0.5 rounded hover:bg-accent transition-colors cursor-pointer disabled:opacity-30"
              title={t`Move out of parent`}
            >
              <CornerLeftUp className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onNest(node.nodeId, defaultStructure)}
            disabled={disabled}
            className="p-0.5 rounded hover:bg-accent transition-colors cursor-pointer disabled:opacity-30"
            title={t`Wrap in new container`}
          >
            <CornerRightDown className="h-3 w-3 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={() => onDuplicate(node.nodeId)}
            disabled={disabled}
            className="p-0.5 rounded hover:bg-accent transition-colors cursor-pointer disabled:opacity-30"
            title={t`Duplicate`}
          >
            <Copy className="h-3 w-3 text-muted-foreground" />
          </button>
          {node.isPruned && (
            <button
              type="button"
              onClick={() => onDelete(node.nodeId)}
              disabled={disabled}
              className="p-0.5 rounded hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-30"
              title={t`Delete`}
            >
              <Trash2 className="h-3 w-3 text-red-600" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onTogglePruned(node.nodeId)}
            disabled={disabled}
            className="p-0.5 rounded hover:bg-accent transition-colors cursor-pointer disabled:opacity-30"
            title={node.isPruned ? t`Include in render` : t`Exclude from render`}
          >
            {node.isPruned ? (
              <EyeOff className="h-3 w-3 text-muted-foreground" />
            ) : (
              <Eye className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div
          className="pl-2 pr-1 py-1"
          style={{ marginLeft: depth === 0 ? 0 : 4 }}
        >
          <DropZone
            parentNodeId={node.nodeId}
            index={0}
            drag={drag}
            onDrop={onDrop}
          />
          {children.length === 0 && !drag && (
            <div className="text-[11px] italic text-muted-foreground/60 py-1 px-1">
              {t`Empty container`}
            </div>
          )}
          {children.map((child, i) => (
            <div key={child.nodeId}>
              <TreeNode
                node={child}
                parentNodeId={node.nodeId}
                indexInParent={i}
                depth={depth + 1}
                bookLabel={bookLabel}
                textRoles={textRoles}
                containerStructures={containerStructures}
                disabled={disabled}
                drag={drag}
                setDrag={setDrag}
                onEditText={onEditText}
                onSetRole={onSetRole}
                onSetStructure={onSetStructure}
                onTogglePruned={onTogglePruned}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onNest={onNest}
                onUnnest={onUnnest}
                onAddChildLeaf={onAddChildLeaf}
                onAddChildContainer={onAddChildContainer}
                onDrop={onDrop}
                defaultTextRole={defaultTextRole}
                defaultStructure={defaultStructure}
              />
              <DropZone
                parentNodeId={node.nodeId}
                index={i + 1}
                drag={drag}
                onDrop={onDrop}
              />
            </div>
          ))}
          <div className="flex items-center gap-1 pt-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onAddChildLeaf(node.nodeId, defaultTextRole)}
              disabled={disabled}
              className="flex items-center gap-1 rounded border border-dashed border-muted-foreground/30 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-muted-foreground/60 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
            >
              <Plus className="h-2.5 w-2.5" />
              {t`Add text`}
            </button>
            <button
              type="button"
              onClick={() =>
                onAddChildContainer(node.nodeId, defaultStructure)
              }
              disabled={disabled}
              className="flex items-center gap-1 rounded border border-dashed border-muted-foreground/30 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-muted-foreground/60 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
            >
              <Plus className="h-2.5 w-2.5" />
              {t`Add container`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Text leaf ───────────────────────────────────────────────────

function TextLeaf(props: TreeNodeProps) {
  const {
    node,
    textRoles,
    disabled,
    setDrag,
    onEditText,
    onSetRole,
    onTogglePruned,
    onDelete,
    onDuplicate,
    onNest,
    onUnnest,
    parentNodeId,
    defaultStructure,
  } = props
  const { t } = useLingui()
  const isDragging = props.drag?.nodeId === node.nodeId
  const visual = getRoleVisual(node.role)

  return (
    <div
      className={cn(
        "group/row flex items-start gap-1.5 rounded px-1 py-0.5 transition-colors hover:bg-muted/40",
        node.isPruned && "opacity-40",
        isDragging && "opacity-30"
      )}
    >
      <DragHandle nodeId={node.nodeId} disabled={disabled} setDrag={setDrag} />
      <visual.Icon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", visual.text)} />
      {textRoles ? (
        <Select
          value={node.role ?? "text"}
          onValueChange={(val) => onSetRole(node.nodeId, val)}
          disabled={disabled}
        >
          <SelectTrigger
            className={cn(
              "shrink-0 h-5 text-[10px] font-medium px-1.5 py-0 w-auto min-w-[60px] border-0",
              visual.bg,
              visual.text
            )}
          >
            <SelectValue>{node.role}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.keys(textRoles).map((key) => (
              <SelectItem key={key} value={key} className="text-xs">
                {key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span
          className={cn(
            "shrink-0 text-[10px] font-medium rounded px-1.5 py-0.5",
            visual.bg,
            visual.text
          )}
        >
          {node.role}
        </span>
      )}
      <EditableText
        value={node.text ?? ""}
        onCommit={(next) => onEditText(node.nodeId, next)}
        disabled={disabled}
      />
      <div className="shrink-0 flex items-center gap-0.5 self-center opacity-0 group-hover/row:opacity-100 transition-opacity">
        {parentNodeId != null && (
          <button
            type="button"
            onClick={() => onUnnest(node.nodeId)}
            disabled={disabled}
            className="p-0.5 rounded hover:bg-accent transition-colors cursor-pointer disabled:opacity-30"
            title={t`Move out of parent`}
          >
            <CornerLeftUp className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onNest(node.nodeId, defaultStructure)}
          disabled={disabled}
          className="p-0.5 rounded hover:bg-accent transition-colors cursor-pointer disabled:opacity-30"
          title={t`Wrap in new container`}
        >
          <CornerRightDown className="h-3 w-3 text-muted-foreground" />
        </button>
        <button
          type="button"
          onClick={() => onDuplicate(node.nodeId)}
          disabled={disabled}
          className="p-0.5 rounded hover:bg-accent transition-colors cursor-pointer disabled:opacity-30"
          title={t`Duplicate`}
        >
          <Copy className="h-3 w-3 text-muted-foreground" />
        </button>
        {node.isPruned && (
          <button
            type="button"
            onClick={() => onDelete(node.nodeId)}
            disabled={disabled}
            className="p-0.5 rounded hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-30"
            title={t`Delete`}
          >
            <Trash2 className="h-3 w-3 text-red-600" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onTogglePruned(node.nodeId)}
          disabled={disabled}
          className="p-0.5 rounded hover:bg-accent transition-colors cursor-pointer disabled:opacity-30"
          title={node.isPruned ? t`Include in render` : t`Exclude from render`}
        >
          {node.isPruned ? (
            <EyeOff className="h-3 w-3 text-muted-foreground" />
          ) : (
            <Eye className="h-3 w-3 text-muted-foreground" />
          )}
        </button>
      </div>
    </div>
  )
}

// ── Image leaf ──────────────────────────────────────────────────

function ImageLeaf(props: TreeNodeProps) {
  const {
    node,
    bookLabel,
    disabled,
    setDrag,
    onTogglePruned,
    onDelete,
    onDuplicate,
  } = props
  const { t } = useLingui()
  const isDragging = props.drag?.nodeId === node.nodeId
  const visual = getRoleVisual("image")
  return (
    <div
      className={cn(
        "group/row flex items-center gap-2 rounded px-2 py-1 transition-colors hover:bg-muted/40",
        node.isPruned && "opacity-40",
        isDragging && "opacity-30"
      )}
    >
      <DragHandle nodeId={node.nodeId} disabled={disabled} setDrag={setDrag} />
      <visual.Icon className={cn("h-3.5 w-3.5 shrink-0", visual.text)} />
      <span
        className={cn(
          "shrink-0 text-[10px] font-medium uppercase tracking-wider rounded px-1.5 py-0.5",
          visual.bg,
          visual.text
        )}
      >
        {t`image`}
      </span>
      <img
        src={`${BASE_URL}/books/${bookLabel}/images/${node.nodeId}`}
        alt={node.nodeId}
        className={cn(
          "h-10 w-auto rounded border bg-white object-contain",
          node.isPruned && "grayscale"
        )}
        onError={(e) => {
          ;(e.target as HTMLImageElement).style.display = "none"
        }}
      />
      <span className="text-[10px] font-mono text-muted-foreground truncate flex-1">
        {node.nodeId}
      </span>
      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => onDuplicate(node.nodeId)}
          disabled={disabled}
          className="p-0.5 rounded hover:bg-accent transition-colors cursor-pointer disabled:opacity-30"
          title={t`Duplicate`}
        >
          <Copy className="h-3 w-3 text-muted-foreground" />
        </button>
        {node.isPruned && (
          <button
            type="button"
            onClick={() => onDelete(node.nodeId)}
            disabled={disabled}
            className="p-0.5 rounded hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-30"
            title={t`Delete`}
          >
            <Trash2 className="h-3 w-3 text-red-600" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onTogglePruned(node.nodeId)}
          disabled={disabled}
          className="p-0.5 rounded hover:bg-accent transition-colors cursor-pointer disabled:opacity-30"
          title={node.isPruned ? t`Include in render` : t`Exclude from render`}
        >
          {node.isPruned ? (
            <EyeOff className="h-3 w-3 text-muted-foreground" />
          ) : (
            <Eye className="h-3 w-3 text-muted-foreground" />
          )}
        </button>
      </div>
    </div>
  )
}
