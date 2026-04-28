import {
  Crop,
  Image as ImageIcon,
  Scissors,
  Sparkles,
  Upload,
  type LucideIcon,
} from "lucide-react"
import { useLingui } from "@lingui/react/macro"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { StyleEditorElementProps } from "../ElementActions"

interface ImageActionsSectionProps {
  dataId: string
  elementProps: StyleEditorElementProps
}

/**
 * Image preview with overlaid action buttons (crop / replace / AI / segment).
 * Rendered above the property accordion when the selected element is an image.
 */
export function ImageActionsSection({
  dataId,
  elementProps,
}: ImageActionsSectionProps) {
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
    <section className="border-b pt-3 pb-3">
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
