import { ElementActions, type ElementActionsProps } from "./style-editor/ElementActions"

export interface SectionEditToolbarProps extends Omit<ElementActionsProps, "isContainer"> {
  rect: DOMRect
  containerOffset: { top: number; left: number }
}

export function SectionEditToolbar({
  rect,
  containerOffset,
  dataId,
  isImage,
  ...rest
}: SectionEditToolbarProps) {
  if (!dataId) return null

  const POPOVER_H = isImage ? 220 : 80
  const top = containerOffset.top + rect.top - POPOVER_H
  const left = containerOffset.left + rect.left

  return (
    <div
      className="fixed z-50 bg-popover border rounded-lg shadow-lg w-[320px]"
      style={{
        top: Math.max(4, top),
        left: Math.max(4, Math.min(left, window.innerWidth - 330)),
      }}
    >
      <div className="p-2.5">
        <ElementActions dataId={dataId} isImage={isImage} isContainer={false} {...rest} />
      </div>
    </div>
  )
}
