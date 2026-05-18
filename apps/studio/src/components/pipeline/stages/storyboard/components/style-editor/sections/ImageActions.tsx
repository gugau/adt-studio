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
 * Image preview followed by a row of action buttons (crop / replace / AI /
 * segment). Sits above the property accordion when the selected element is
 * an image.
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

  const actions: ReadonlyArray<{
    key: string
    handler: ((id: string) => void) | undefined
    icon: LucideIcon
    label: string
    accent?: "default" | "purple" | "orange"
    disabled?: boolean
  }> = [
    { key: "crop", handler: onCrop, icon: Crop, label: t`Crop` },
    { key: "recrop", handler: onRecropFromPage, icon: ImageIcon, label: t`Recrop from page` },
    { key: "replace", handler: onReplace, icon: Upload, label: t`Replace` },
    { key: "replace-from-book", handler: onReplaceFromBook, icon: ImageIcon, label: t`Replace from book` },
    { key: "ai", handler: onAiImage, icon: Sparkles, label: t`AI`, accent: "purple" },
    {
      key: "segment",
      handler: onSegment,
      icon: Scissors,
      label: segmenting ? t`Segmenting…` : t`Segment`,
      accent: "orange",
      disabled: segmenting,
    },
  ]

  const available = actions.filter((a) => a.handler != null)

  return (
    <section className="border-b pt-3 pb-3">
      <div className="rounded-md overflow-hidden border bg-muted/30">
        <img src={imageSrc} alt={dataId} className="w-full h-32 object-cover" />
      </div>
      {available.length > 0 ? (
        <TooltipProvider delayDuration={0}>
          <div className="mt-2 flex items-center justify-between flex-wrap">
            {available.map((a) => (
              <ActionButton
                key={a.key}
                icon={a.icon}
                label={a.label}
                onClick={() => a.handler?.(dataId)}
                disabled={a.disabled}
                accent={a.accent}
              />
            ))}
          </div>
        </TooltipProvider>
      ) : null}
    </section>
  )
}

function ActionButton({
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
    default:
      "bg-muted text-foreground/80 hover:bg-muted/70 hover:text-foreground",
    purple:
      "bg-purple-50 text-purple-600 hover:bg-purple-100 dark:bg-purple-500/15 dark:text-purple-300 dark:hover:bg-purple-500/25",
    orange:
      "bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-500/15 dark:text-orange-300 dark:hover:bg-orange-500/25",
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
            "h-8 w-8 rounded-md flex items-center justify-center cursor-pointer outline-none",
            "transition-colors duration-150 ease-out",
            "focus-visible:ring-1 focus-visible:ring-violet-500",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            palette[accent],
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} variant="light">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
