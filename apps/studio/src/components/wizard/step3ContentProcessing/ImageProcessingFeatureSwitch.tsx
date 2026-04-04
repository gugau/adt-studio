import type { MessageDescriptor } from "@lingui/core"
import { useLingui } from "@lingui/react/macro"
import { cn } from "@/lib/utils"
import { ImageProcessingSwitch } from "./ImageProcessingSwitch"
import type { ImageProcessingPreviewFocus } from "./imageProcessingPreviewTypes"
import { useDelayedPreviewFocus } from "@/components/wizard"

export type ImageProcessingFeatureSwitchProps = {
  title: string
  subtitle: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  previewFocus: ImageProcessingPreviewFocus
  id: string
  className?: string
  disabled?: boolean
  recommended?: boolean
  presetLabel?: MessageDescriptor
}


export function ImageProcessingFeatureSwitch({
  title,
  subtitle,
  checked,
  onCheckedChange,
  previewFocus,
  id,
  disabled = false,
  recommended = false,
  presetLabel,
}: ImageProcessingFeatureSwitchProps) {
  const { i18n, t } = useLingui()
  const { onMouseEnter, onMouseLeave } = useDelayedPreviewFocus(previewFocus)

  function toggle() {
    if (disabled) return
    onCheckedChange(!checked)
  }

  return (
    <div
      role="switch"
      id={id}
      aria-checked={checked}
      aria-disabled={disabled}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-subtitle`}
      tabIndex={disabled ? -1 : 0}
      className={cn(
        "flex w-full min-h-[72px] cursor-pointer select-none items-center justify-center gap-2.5 rounded-lg border px-4 py-2 shadow-sm transition-colors",
        "bg-white border-border",
        "hover:bg-muted hover:border-input",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        disabled && "cursor-not-allowed opacity-60 hover:bg-white hover:border-border",
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={() => {
        toggle()
      }}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault()
          toggle()
        }
      }}
    >
      <div className="flex min-w-0 flex-1 flex-row items-center self-stretch">
        <div className="flex min-h-px min-w-px flex-1 flex-col items-start justify-center gap-0.5">
          <div className="flex items-center gap-2">
            <p
              id={`${id}-title`}
              className="select-none text-lg font-semibold leading-[26px] tracking-tight text-foreground"
            >
              {title}
            </p>
            {recommended && (
              <span className="inline-flex shrink-0 items-center rounded-full border border-[#e5e5e5] bg-[#f5f5f5] px-2 py-0.5 text-[10px] font-medium leading-none text-[#525252]">
                {presetLabel
                  ? t`Recommended for ${i18n._(presetLabel)}`
                  : t`Recommended`}
              </span>
            )}
          </div>
          <p
            id={`${id}-subtitle`}
            className="w-full select-none text-base font-normal leading-5 text-muted-foreground"
          >
            {subtitle}
          </p>
        </div>
      </div>
      <ImageProcessingSwitch
        id={`${id}-switch`}
        checked={checked}
        decorative
        disabled={disabled}
      />
    </div>
  )
}
