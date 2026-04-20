import { useEffect, type ReactNode } from "react"
import { Trans, useLingui } from "@lingui/react/macro"
import type { PageDetail } from "@/api/client"
import { usePageImage } from "@/hooks/use-pages"
import { useStepHeader } from "../../components/StepViewRouter"

type SectionPart = NonNullable<PageDetail["sectioning"]>["sections"][number]["parts"][number]

function PartBlock({ part }: { part: SectionPart }) {
  const muted = part.isPruned
  if (part.type === "image") {
    return (
      <div className={`py-0.5 text-sm font-mono ${muted ? "line-through text-muted-foreground/60" : "text-foreground"}`}>
        <span className="text-xs uppercase tracking-wide text-muted-foreground mr-2">image</span>
        <span>{`[${part.imageId}]`}</span>
      </div>
    )
  }
  return (
    <div className="py-0.5">
      <div className={`text-xs font-semibold uppercase tracking-wide ${muted ? "text-muted-foreground/60 line-through" : "text-sky-700"}`}>
        {part.groupType}
      </div>
      {part.texts.map((t) => (
        <div
          key={t.textId}
          className={`py-0.5 pl-3 text-sm font-mono ${t.isPruned || muted ? "line-through text-muted-foreground/60" : "text-foreground"}`}
        >
          <span className="text-xs uppercase tracking-wide text-muted-foreground mr-2">{t.textType}</span>
          <span className="whitespace-pre-wrap">{t.text}</span>
        </div>
      ))}
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

  const sections = page.sectioning?.sections ?? []

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
                {section.parts.length === 0 ? (
                  <div className="text-sm text-muted-foreground italic"><Trans>Empty section</Trans></div>
                ) : (
                  section.parts.map((p, i) => (
                    <PartBlock
                      key={p.type === "image" ? p.imageId : `${p.groupId}_${i}`}
                      part={p}
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
