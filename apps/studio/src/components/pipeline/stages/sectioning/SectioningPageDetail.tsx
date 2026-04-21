import { useEffect, type ReactNode } from "react"
import { Trans, useLingui } from "@lingui/react/macro"
import { BASE_URL, type ContentNode, type PageDetail } from "@/api/client"
import { usePageImage } from "@/hooks/use-pages"
import { useStepHeader } from "../../components/StepViewRouter"

function NodeBlock({
  node,
  bookLabel,
  inheritedPruned,
}: {
  node: ContentNode
  bookLabel: string
  inheritedPruned: boolean
}) {
  const pruned = node.isPruned || inheritedPruned
  const mutedText = pruned ? "line-through text-muted-foreground/60" : "text-foreground"

  if (node.role === "image") {
    return (
      <div className="py-1">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">image</span>
          <span className={`text-xs font-mono ${pruned ? "line-through text-muted-foreground/60" : "text-muted-foreground"}`}>
            {node.nodeId}
          </span>
        </div>
        <img
          src={`${BASE_URL}/books/${bookLabel}/images/${node.nodeId}`}
          alt={node.nodeId}
          className={`mt-1 h-20 w-auto object-contain rounded border bg-white ${pruned ? "opacity-40" : ""}`}
          onError={(e) => {
            ;(e.target as HTMLImageElement).style.display = "none"
          }}
        />
      </div>
    )
  }

  if (node.role) {
    return (
      <div className={`py-0.5 text-sm font-mono ${mutedText}`}>
        <span className="text-xs uppercase tracking-wide text-muted-foreground mr-2">{node.role}</span>
        <span className="whitespace-pre-wrap">{node.text ?? ""}</span>
      </div>
    )
  }

  const children = node.children ?? []
  return (
    <div className="py-1">
      <div className={`text-xs font-semibold uppercase tracking-wide ${pruned ? "text-muted-foreground/60 line-through" : "text-sky-700"}`}>
        {node.structure ?? "container"}
        <span className="ml-2 text-[10px] font-mono text-muted-foreground/70 normal-case">
          {node.nodeId}
        </span>
      </div>
      <div className="pl-3 border-l border-sky-200 ml-1 mt-1">
        {children.length === 0 ? (
          <div className="text-xs text-muted-foreground italic py-0.5"><Trans>Empty container</Trans></div>
        ) : (
          children.map((c) => (
            <NodeBlock key={c.nodeId} node={c} bookLabel={bookLabel} inheritedPruned={pruned} />
          ))
        )}
      </div>
    </div>
  )
}

export function SectioningPageDetail({
  bookLabel,
  pageId,
  page,
  navigationExtra,
  navigationArrows,
}: {
  bookLabel: string
  pageId: string
  page: PageDetail
  navigationExtra: ReactNode
  navigationArrows: ReactNode
}) {
  const { t } = useLingui()
  const { setExtra, setOnLabelClick } = useStepHeader()
  const { data: imageData } = usePageImage(bookLabel, pageId)

  useEffect(() => {
    setOnLabelClick(null)
    setExtra(
      <div className="flex-1 flex items-center gap-3">
        {navigationExtra}
        <div className="ml-auto flex gap-1">{navigationArrows}</div>
      </div>
    )
    return () => {
      setExtra(null)
      setOnLabelClick(null)
    }
  }, [navigationExtra, navigationArrows, setExtra, setOnLabelClick])

  const sections = page.sectioningTree?.sections ?? []

  return (
    <div className="flex h-full min-h-0">
      <div className="w-1/2 min-w-0 border-r overflow-auto bg-muted/10 p-4">
        {imageData ? (
          <img
            src={`data:image/png;base64,${imageData.imageBase64}`}
            alt={t`Page image`}
            className="w-full h-auto rounded border bg-white shadow-sm"
          />
        ) : (
          <div className="text-sm text-muted-foreground"><Trans>Loading image...</Trans></div>
        )}
      </div>
      <div className="w-1/2 min-w-0 overflow-auto p-4 space-y-4">
        {sections.length === 0 ? (
          <div className="text-sm text-muted-foreground italic"><Trans>No sections on this page</Trans></div>
        ) : (
          sections.map((section, idx) => (
            <div key={section.sectionId}>
              <div className="flex items-baseline gap-3 mb-2">
                <div className="text-xs font-medium text-muted-foreground">{`#${idx + 1}`}</div>
                <div className="text-sm font-semibold">{section.sectionId}</div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{section.sectionType}</div>
                {section.isPruned ? (
                  <span className="text-xs text-amber-600"><Trans>pruned</Trans></span>
                ) : null}
              </div>
              <div className="border rounded bg-muted/20 p-3">
                {section.nodes.length === 0 ? (
                  <div className="text-sm text-muted-foreground italic"><Trans>Empty section</Trans></div>
                ) : (
                  section.nodes.map((node) => (
                    <NodeBlock
                      key={node.nodeId}
                      node={node}
                      bookLabel={bookLabel}
                      inheritedPruned={section.isPruned}
                    />
                  ))
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
