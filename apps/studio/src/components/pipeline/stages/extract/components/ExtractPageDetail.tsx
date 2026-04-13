import { useState, useEffect, useRef, useCallback } from "react"
import { AlertTriangle, Check, Crop, Eye, EyeOff, FileText, Image, ImageOff, Layers, Loader2, ChevronDown, X, RefreshCw } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { usePage, usePageImage } from "@/hooks/use-pages"
import { api, BASE_URL } from "@/api/client"
import type { VersionEntry } from "@/api/client"
import type { ContentNodeData } from "@adt/types"
import { useActiveConfig } from "@/hooks/use-debug"
import { useBookRun } from "@/hooks/use-book-run"
import { useBookTasks } from "@/hooks/use-book-tasks"
import { useApiKey } from "@/hooks/use-api-key"
import { Trans } from "@lingui/react/macro"
import { useLingui } from "@lingui/react/macro"
import { getTextGroupLabel, getTextTypeLabel } from "@/lib/text-type-labels"
import { ImageCropDialog } from "@/components/pipeline/stages/storyboard/components/ImageCropDialog"

function VersionPicker({
  currentVersion,
  saving,
  dirty,
  bookLabel,
  node,
  itemId,
  onPreview,
  onSave,
  onDiscard,
}: {
  currentVersion: number | null
  saving: boolean
  dirty: boolean
  bookLabel: string
  node: string
  itemId: string
  onPreview: (data: unknown) => void
  onSave: () => void
  onDiscard: () => void
}) {
  const [open, setOpen] = useState(false)
  const [versions, setVersions] = useState<VersionEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const handleOpen = async () => {
    if (saving || currentVersion == null) return
    setOpen(true)
    setLoading(true)
    const res = await api.getVersionHistory(bookLabel, node, itemId, true)
    setVersions(res.versions)
    setLoading(false)
  }

  const handlePick = (v: VersionEntry) => {
    if (v.version === currentVersion && !dirty) {
      setOpen(false)
      return
    }
    setOpen(false)
    onPreview(v.data)
  }

  if (saving) {
    return <Loader2 className="h-3 w-3 animate-spin ml-auto" />
  }

  if (currentVersion == null) return null

  if (dirty) {
    return (
      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={onDiscard}
          className="text-[10px] font-medium rounded px-2 py-0.5 bg-muted hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
        >
          <Trans>Discard</Trans>
        </button>
        <button
          type="button"
          onClick={onSave}
          className="flex items-center gap-1 text-[10px] font-medium rounded px-2 py-0.5 bg-green-600 hover:bg-green-500 text-white cursor-pointer transition-colors"
        >
          <Check className="h-3 w-3" />
          <Trans>Save</Trans>
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-0.5 text-[10px] font-normal normal-case tracking-normal bg-muted hover:bg-muted/80 rounded px-1.5 py-0.5 transition-colors"
      >
        v{currentVersion}
        <ChevronDown className="h-2.5 w-2.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-popover border rounded shadow-md min-w-[80px] py-1">
          {loading ? (
            <div className="flex items-center justify-center py-2 px-3">
              <Loader2 className="h-3 w-3 animate-spin" />
            </div>
          ) : versions && versions.length > 0 ? (
            versions.map((v) => (
              <button
                key={v.version}
                type="button"
                onClick={() => handlePick(v)}
                className={`w-full text-left px-3 py-1 text-xs hover:bg-accent transition-colors ${
                  v.version === currentVersion ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                v{v.version}
              </button>
            ))
          ) : (
            <div className="px-3 py-1 text-xs text-muted-foreground"><Trans>No versions</Trans></div>
          )}
        </div>
      )}
    </div>
  )
}

function ImageCard({ imageId, bookLabel, isPruned, reason, onTogglePrune, onRecrop, cacheBust }: { imageId: string; bookLabel: string; isPruned?: boolean; reason?: string; onTogglePrune?: () => void; onRecrop?: () => void; cacheBust?: number }) {
  const { t } = useLingui()
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null)
  // eslint-disable-next-line lingui/no-unlocalized-strings
  const imgSrc = `${BASE_URL}/books/${bookLabel}/images/${imageId}${cacheBust ? `?v=${cacheBust}` : ""}`

  return (
    <div
      className={`relative rounded border overflow-hidden bg-card flex flex-col items-center min-h-[80px] ${isPruned ? "opacity-40" : ""}`}
      title={isPruned && reason ? t`Pruned: ${reason}` : undefined}
    >
      <div className="absolute top-1 right-1 z-10 flex items-center gap-1">
        {onRecrop && (
          <button
            type="button"
            onClick={onRecrop}
            className="flex items-center justify-center w-5 h-5 rounded-full cursor-pointer transition-colors bg-black/30 opacity-0 group-hover:opacity-100 hover:bg-black/50"
            title={t`Recrop from page`}
          >
            <Crop className="h-3 w-3 text-white" />
          </button>
        )}
        <button
          type="button"
          onClick={onTogglePrune}
          className={`flex items-center justify-center w-5 h-5 rounded-full cursor-pointer transition-colors ${
            isPruned
              ? "bg-destructive hover:bg-destructive/80"
              : "bg-black/30 opacity-0 group-hover:opacity-100 hover:bg-black/50"
          }`}
          title={isPruned ? t`Unprune image` : t`Prune image`}
        >
          {isPruned
            ? <EyeOff className="h-3 w-3 text-white" />
            : <Eye className="h-3 w-3 text-white" />
          }
        </button>
      </div>
      <img
        src={imgSrc}
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
      <div className="px-2 py-1 border-t bg-muted/30 w-full mt-auto">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground truncate">{imageId}</span>
          {dimensions && (
            <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
              {dimensions.w}&times;{dimensions.h}
            </span>
          )}
        </div>
        {isPruned && reason && (
          <p className="text-[10px] text-destructive/70 truncate mt-0.5" title={reason}>{reason}</p>
        )}
      </div>
    </div>
  )
}

type PageStructuringData = NonNullable<import("@/api/client").PageDetail["pageStructuring"]>

function ContentNodeView({
  node,
  depth,
  configuredTextTypes,
  configuredContainerTypes,
  bookLabel,
  collapsed,
  onUpdate,
  onTogglePrune,
  onToggleCollapse,
}: {
  node: ContentNodeData
  depth: number
  configuredTextTypes: string[]
  configuredContainerTypes: string[]
  bookLabel: string
  collapsed: Set<string>
  onUpdate: (nodeId: string, field: string, value: string) => void
  onTogglePrune: (nodeId: string) => void
  onToggleCollapse: (nodeId: string) => void
}) {
  const { t } = useLingui()
  const hasChildren = node.children != null && node.children.length > 0
  const isContainer = hasChildren || (node.structure != null && node.imageId != null)
  const isText = node.text != null
  const isCollapsed = collapsed.has(node.nodeId)

  // Container node (includes image containers and containers with background images)
  if (isContainer) {
    // eslint-disable-next-line lingui/no-unlocalized-strings
    const imgSrc = node.imageId ? `${BASE_URL}/books/${bookLabel}/images/${node.imageId}` : null
    const hasBody = hasChildren || imgSrc != null
    return (
      <div className={`relative ${node.isPruned ? "opacity-40" : ""}`} style={{ paddingLeft: depth * 20 }}>
        {/* Vertical connector from parent */}
        {depth > 0 && (
          <div
            className="absolute top-0 bottom-0 border-l border-muted-foreground/15"
            style={{ left: (depth - 1) * 20 + 9 }}
          />
        )}
        <div className="group/container relative flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted/40 transition-colors">
          <select
            value={node.structure ?? ""}
            onChange={(e) => onUpdate(node.nodeId, "structure", e.target.value)}
            onClick={(e) => {
              if (hasBody && (e.target as HTMLSelectElement).value === node.structure) {
                e.preventDefault()
                onToggleCollapse(node.nodeId)
              }
            }}
            className="shrink-0 text-[11px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 border-0 outline-none focus:ring-1 focus:ring-ring cursor-pointer appearance-none bg-primary/10 text-primary"
          >
            {!configuredContainerTypes.includes(node.structure ?? "") && (
              <option value={node.structure ?? ""}>{getTextGroupLabel(node.structure ?? "")}</option>
            )}
            {configuredContainerTypes.map((ct) => (
              <option key={ct} value={ct}>
                {getTextGroupLabel(ct)}
              </option>
            ))}
          </select>
          {node.imageId && (
            <span className="text-[10px] text-muted-foreground/60 font-mono truncate">{node.imageId}</span>
          )}
          <button
            type="button"
            onClick={() => onTogglePrune(node.nodeId)}
            className={`shrink-0 ml-auto flex items-center justify-center w-5 h-5 rounded cursor-pointer transition-colors ${
              node.isPruned
                ? "text-destructive hover:bg-destructive/10"
                : "text-muted-foreground/40 opacity-0 group-hover/container:opacity-100 hover:bg-muted hover:text-muted-foreground"
            }`}
            title={node.isPruned ? t`Unprune` : t`Prune`}
          >
            {node.isPruned
              ? <EyeOff className="h-3.5 w-3.5" />
              : <Eye className="h-3.5 w-3.5" />
            }
          </button>
        </div>
        {hasBody && !isCollapsed && (
          <div className="relative">
            {imgSrc && (
              <div className="relative py-1" style={{ paddingLeft: (depth + 1) * 20 }}>
                {/* Connector line through image area */}
                <div
                  className="absolute top-0 bottom-0 border-l border-muted-foreground/15"
                  style={{ left: depth * 20 + 9 }}
                />
                <img
                  src={imgSrc}
                  alt={node.imageId!}
                  className="relative max-h-[140px] max-w-full object-contain rounded-lg border border-border/50 shadow-sm"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                />
              </div>
            )}
            {hasChildren && node.children!.map((child) => (
              <ContentNodeView
                key={child.nodeId}
                node={child}
                depth={depth + 1}
                configuredTextTypes={configuredTextTypes}
                configuredContainerTypes={configuredContainerTypes}
                bookLabel={bookLabel}
                collapsed={collapsed}
                onUpdate={onUpdate}
                onTogglePrune={onTogglePrune}
                onToggleCollapse={onToggleCollapse}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Text leaf node
  if (isText) {
    return (
      <div
        className={`relative ${node.isPruned ? "opacity-40" : ""}`}
        style={{ paddingLeft: depth * 20 }}
      >
        {/* Vertical connector from parent */}
        {depth > 0 && (
          <div
            className="absolute top-0 bottom-0 border-l border-muted-foreground/15"
            style={{ left: (depth - 1) * 20 + 9 }}
          />
        )}
        <div className="group/node relative flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-muted/40 transition-colors">
          <select
            value={node.role ?? ""}
            onChange={(e) => onUpdate(node.nodeId, "role", e.target.value)}
            className="shrink-0 text-[11px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 bg-muted text-muted-foreground border-0 outline-none focus:ring-1 focus:ring-ring cursor-pointer appearance-none mt-px"
            style={{ width: `${Math.max((node.role ?? "").length * 0.75 + 2, 4.5)}em` }}
          >
            {!configuredTextTypes.includes(node.role ?? "") && (
              <option value={node.role ?? ""}>{getTextTypeLabel(node.role ?? "")}</option>
            )}
            {configuredTextTypes.map((tt) => (
              <option key={tt} value={tt}>
                {getTextTypeLabel(tt)}
              </option>
            ))}
          </select>
          <textarea
            value={node.text ?? ""}
            onChange={(e) => onUpdate(node.nodeId, "text", e.target.value)}
            rows={1}
            className="leading-relaxed flex-1 min-w-0 text-[13px] bg-transparent border-0 outline-none resize-none overflow-hidden p-0 focus:ring-1 focus:ring-ring focus:rounded mt-px"
            onInput={(e) => {
              const el = e.target as HTMLTextAreaElement
              el.style.height = "auto"
              el.style.height = el.scrollHeight + "px"
            }}
            ref={(el) => {
              if (el) {
                el.style.height = "auto"
                el.style.height = el.scrollHeight + "px"
              }
            }}
          />
          <button
            type="button"
            onClick={() => onTogglePrune(node.nodeId)}
            className={`shrink-0 self-center flex items-center justify-center w-5 h-5 rounded cursor-pointer transition-colors ${
              node.isPruned
                ? "text-destructive hover:bg-destructive/10"
                : "text-muted-foreground/40 opacity-0 group-hover/node:opacity-100 hover:bg-muted hover:text-muted-foreground"
            }`}
            title={node.isPruned ? t`Unprune` : t`Prune`}
          >
            {node.isPruned
              ? <EyeOff className="h-3.5 w-3.5" />
              : <Eye className="h-3.5 w-3.5" />
            }
          </button>
        </div>
      </div>
    )
  }

  // Empty node (shouldn't happen but handle gracefully)
  return null
}
type ImageClassData = NonNullable<import("@/api/client").PageDetail["imageClassification"]>

/** Recursively find and update a node by ID in a tree */
function updateNodeInTree(
  nodes: ContentNodeData[],
  nodeId: string,
  updater: (node: ContentNodeData) => ContentNodeData
): ContentNodeData[] {
  return nodes.map((node) => {
    if (node.nodeId === nodeId) return updater(node)
    if (node.children) {
      return { ...node, children: updateNodeInTree(node.children, nodeId, updater) }
    }
    return node
  })
}

export function ExtractPageDetail({
  bookLabel,
  pageId,
}: {
  bookLabel: string
  pageId: string
}) {
  const { t } = useLingui()
  const { data: page, isLoading } = usePage(bookLabel, pageId)
  const { data: imageData } = usePageImage(bookLabel, pageId)
  const { data: activeConfigData } = useActiveConfig(bookLabel)
  const mergedConfig = activeConfigData?.merged as Record<string, unknown> | undefined
  const configuredTextTypes = mergedConfig
    ? Object.keys((mergedConfig.text_types ?? {}) as Record<string, string>)
    : []
  const configuredContainerTypes = mergedConfig
    ? Object.keys((mergedConfig.container_types ?? {}) as Record<string, string>)
    : []
  const [pageImageDims, setPageImageDims] = useState<{ w: number; h: number } | null>(null)
  const { apiKey } = useApiKey()
  const { stageState, stepState } = useBookRun()
  const { isTaskRunning } = useBookTasks(bookLabel)
  const storyboardRunning = stageState("storyboard") === "running" || stageState("storyboard") === "queued"
  const storyboardDone = stageState("storyboard") === "done"
  const metadataRunning = stepState("metadata") === "running"
  const pageStructuringRunning = stepState("page-structuring") === "running"
  const imageFilterRunning = stepState("image-filtering") === "running"
  const reStructuring = isTaskRunning("re-structure", pageId)
  const [savingText, setSavingText] = useState(false)
  const [savingImages, setSavingImages] = useState(false)
  const [pendingTextData, setPendingTextData] = useState<PageStructuringData | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [pendingImageData, setPendingImageData] = useState<ImageClassData | null>(null)
  const [cropTarget, setCropTarget] = useState<string | null>(null)
  const [cropPageSrc, setCropPageSrc] = useState<string | null>(null)
  const [cacheBust, setCacheBust] = useState(0)
  const queryClient = useQueryClient()

  // Clear pending state when page changes
  useEffect(() => {
    setPendingTextData(null)
    setPendingImageData(null)
    setCropTarget(null)
    setCropPageSrc(null)
  }, [pageId])

  const handleRecropFromPage = useCallback(async (imageId: string) => {
    try {
      const { imageBase64 } = await api.getPageImage(bookLabel, pageId)
      setCropTarget(imageId)
      setCropPageSrc(`data:image/png;base64,${imageBase64}`)
    } catch {
      // silently fail — page image may not be available
    }
  }, [bookLabel, pageId])

  const handleCropApply = useCallback(async (blob: Blob) => {
    if (!cropTarget) return
    try {
      const result = await api.uploadCroppedImage(bookLabel, pageId, cropTarget, blob)
      // Swap old imageId → new imageId in imageClassification and save
      const base = pendingImageData ?? page?.imageClassification
      if (base) {
        const updated = {
          ...base,
          images: base.images.map((img) =>
            img.imageId === cropTarget ? { ...img, imageId: result.imageId } : img
          ),
        }
        await api.updateImageClassification(bookLabel, pageId, updated)
      }
      await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "pages", pageId] })
      setPendingImageData(null)
      setCacheBust((n) => n + 1)
    } finally {
      setCropTarget(null)
      setCropPageSrc(null)
    }
  }, [cropTarget, bookLabel, pageId, queryClient, pendingImageData, page?.imageClassification])

  // Effective data: pending if dirty, otherwise server
  const structuringData = pendingTextData ?? page?.pageStructuring ?? null
  const imageClassData = pendingImageData ?? page?.imageClassification ?? null
  const textDirty = pendingTextData != null
  const imageDirty = pendingImageData != null

  const updateNodeField = (nodeId: string, field: string, value: string) => {
    const base = pendingTextData ?? page?.pageStructuring
    if (!base) return
    setPendingTextData({
      ...base,
      nodes: updateNodeInTree(base.nodes, nodeId, (node) => ({ ...node, [field]: value })),
    })
  }

  const toggleNodePrune = (nodeId: string) => {
    const base = pendingTextData ?? page?.pageStructuring
    if (!base) return
    setPendingTextData({
      ...base,
      nodes: updateNodeInTree(base.nodes, nodeId, (node) => ({ ...node, isPruned: !node.isPruned })),
    })
  }

  const toggleCollapse = (nodeId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId)
      return next
    })
  }

  const toggleImagePrune = (imageId: string) => {
    const base = pendingImageData ?? page?.imageClassification
    if (!base) return
    setPendingImageData({
      images: base.images.map((img) =>
        img.imageId === imageId
          ? { ...img, isPruned: !img.isPruned, reason: img.isPruned ? undefined : "manual" }
          : img
      ),
    })
  }

  const saveTextChanges = async () => {
    if (!pendingTextData || storyboardRunning) return
    setSavingText(true)
    const minDelay = new Promise((r) => setTimeout(r, 400))
    await api.updatePageStructuring(bookLabel, pageId, pendingTextData)
    setPendingTextData(null)
    await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "pages", pageId] })
    await minDelay
    setSavingText(false)
  }

  const saveImageChanges = async () => {
    if (!pendingImageData || storyboardRunning) return
    setSavingImages(true)
    const minDelay = new Promise((r) => setTimeout(r, 400))
    await api.updateImageClassification(bookLabel, pageId, pendingImageData)
    setPendingImageData(null)
    await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "pages", pageId] })
    await minDelay
    setSavingImages(false)
  }

  const handleReStructure = async () => {
    if (!apiKey || reStructuring) return
    try {
      await api.reStructurePage(bookLabel, pageId, apiKey)
      setPendingTextData(null)
    } catch {
      // API call failed — task was never submitted, nothing to track
    }
  }

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground"><Trans>Loading page...</Trans></div>
  }

  if (!page) return null

  return (
    <div className="space-y-2 p-4">
      {storyboardDone && (
        <div className="flex items-center gap-2 rounded border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <Trans>Storyboard has already been run. Changes made here will not take effect until storyboard is re-run.</Trans>
        </div>
      )}
      <div className="flex gap-6">
      {/* Left: Page image + extracted images */}
      <div className="w-[45%] shrink-0 space-y-4">
        {/* Extracted images header */}
        {(() => {
          const pageImageId = `${pageId}_page`
          const totalImages = imageClassData?.images.filter(
            (img) => img.imageId !== pageImageId
          ).length ?? 0
          const count = totalImages + (imageData ? 1 : 0)
          if (count === 0) return null
          return (
            <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <Image className="h-3 w-3" />
              <Trans>Extracted Images ({String(count)})</Trans>
              <VersionPicker
                currentVersion={page.versions.imageClassification}
                saving={savingImages}
                dirty={imageDirty}
                bookLabel={bookLabel}
                node="image-filtering"
                itemId={pageId}
                onPreview={(data) => setPendingImageData(data as ImageClassData)}
                onSave={saveImageChanges}
                onDiscard={() => setPendingImageData(null)}
              />
            </h3>
          )
        })()}

        {/* Page image */}
        {imageData ? (
          <div className="rounded border overflow-hidden shadow-sm">
            <img
              src={`data:image/png;base64,${imageData.imageBase64}`}
              alt={t`Page ${String(page.pageNumber)}`}
              className="w-full h-auto block"
              onLoad={(e) => {
                const img = e.target as HTMLImageElement
                setPageImageDims({ w: img.naturalWidth, h: img.naturalHeight })
              }}
            />
            <div className="px-2 py-1 flex items-center justify-between border-t bg-muted/30">
              <span className="text-[10px] text-muted-foreground truncate">
                {pageId}
                {t`_page`}
              </span>
              {pageImageDims && (
                <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
                  {pageImageDims.w}&times;{pageImageDims.h}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex aspect-[3/4] w-full items-center justify-center rounded border bg-muted/50 text-sm text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <ImageOff className="h-6 w-6" />
              <Trans>No image available</Trans>
            </div>
          </div>
        )}

        {/* Other extracted images (excluding the page image) */}
        {(() => {
          const pageImageId = `${pageId}_page`
          const extractedImages = (imageClassData?.images.filter(
            (img) => img.imageId !== pageImageId
          ) ?? []).sort((a, b) => Number(a.isPruned) - Number(b.isPruned))
          if (extractedImages.length === 0) {
            if (imageFilterRunning && !imageClassData) {
              return (
                <div className="flex items-center gap-2 rounded border border-dashed p-3 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  <Trans>Classifying images…</Trans>
                </div>
              )
            }
            return null
          }
          return (
            <div className="grid grid-cols-2 gap-2 items-start">
              {extractedImages.map((img) => (
                <div key={img.imageId} className="group">
                  <ImageCard
                    imageId={img.imageId}
                    bookLabel={bookLabel}
                    isPruned={img.isPruned}
                    reason={img.reason}
                    onTogglePrune={() => toggleImagePrune(img.imageId)}
                    onRecrop={!storyboardRunning ? () => handleRecropFromPage(img.imageId) : undefined}
                    cacheBust={cacheBust}
                  />
                </div>
              ))}
            </div>
          )
        })()}

        {/* Extracted text */}
        {page.text ? (
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              <FileText className="h-3 w-3" />
              <Trans>Extracted Text</Trans>
            </h3>
            <div className="rounded border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap font-mono">
              {page.text}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground py-8 text-center">
            <Trans>No extracted text yet. Run the pipeline first.</Trans>
          </div>
        )}
      </div>

      {/* Right: Page structure */}
      <div className="flex-1 min-w-0">
        {/* Metadata — processing indicator */}
        {metadataRunning && (
          <div className="mb-4 flex items-center gap-2 rounded border border-dashed p-3 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            <Trans>Processing metadata…</Trans>
          </div>
        )}

        {/* Page structure — processing indicator */}
        {!structuringData && pageStructuringRunning && (
          <div className="mb-4 flex items-center gap-2 rounded border border-dashed p-3 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            <Trans>Structuring page…</Trans>
          </div>
        )}

        {/* Page structure tree */}
        {structuringData && structuringData.nodes.length > 0 && (
          <div className="mb-4">
            <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              <Layers className="h-3 w-3" />
              <Trans>Page Structure</Trans>
              <div className="ml-auto flex items-center gap-1.5">
              <VersionPicker
                currentVersion={page.versions.pageStructuring}
                saving={savingText}
                dirty={textDirty}
                bookLabel={bookLabel}
                node="page-structuring"
                itemId={pageId}
                onPreview={(data) => setPendingTextData(data as PageStructuringData)}
                onSave={saveTextChanges}
                onDiscard={() => setPendingTextData(null)}
              />
              {apiKey && !textDirty && (
                <button
                  type="button"
                  onClick={handleReStructure}
                  disabled={reStructuring || pageStructuringRunning}
                  className="flex items-center rounded p-0.5 bg-muted hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={t`Re-run page structuring`}
                >
                  <RefreshCw className={`h-3 w-3 ${reStructuring ? "animate-spin" : ""}`} />
                </button>
              )}
              </div>
            </h3>
            <div>
              {structuringData.nodes.map((node) => (
                <ContentNodeView
                  key={node.nodeId}
                  node={node}
                  depth={0}
                  configuredTextTypes={configuredTextTypes}
                  configuredContainerTypes={configuredContainerTypes}
                  bookLabel={bookLabel}
                  collapsed={collapsed}
                  onUpdate={updateNodeField}
                  onTogglePrune={toggleNodePrune}
                  onToggleCollapse={toggleCollapse}
                />
              ))}
            </div>
          </div>
        )}

      </div>
      </div>
      {cropTarget && cropPageSrc && (
        <ImageCropDialog
          imageSrc={cropPageSrc}
          onApply={handleCropApply}
          onClose={() => { setCropTarget(null); setCropPageSrc(null) }}
        />
      )}
    </div>
  )
}
