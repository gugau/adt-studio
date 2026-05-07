import { useLingui } from "@lingui/react/macro"
import { cn } from "@/lib/utils"
import { useWindowControls } from "@/hooks/use-window-controls"
import { usePlatform } from "@/hooks/use-platform"


export function WindowsControls({
  className,
  variant,
}: {
  className?: string
  variant?: "dark" | "light"
}) {
  const { t } = useLingui()
  const platform = usePlatform()
  const { isMaximized, minimize, toggleMaximize, close, available } = useWindowControls()

  const tone =
    variant === "dark"
      ? "text-white/90 hover:bg-white/10 active:bg-white/5"
      : variant === "light"
        ? "text-black/80 hover:bg-black/10 active:bg-black/5"
        : "text-foreground/80 hover:bg-foreground/10 active:bg-foreground/5"

  const baseButton =
    "flex items-center justify-center w-[46px] h-full transition-colors focus:outline-none"

  if (platform !== "windows" || !available) return null

  return (
    <div
      className={cn("flex items-stretch h-full no-drag", className)}
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      <button
        type="button"
        onClick={minimize}
        aria-label={t`Minimize`}
        title={t`Minimize`}
        className={cn(baseButton, tone)}
      >
        <MinimizeIcon />
      </button>
      <button
        type="button"
        onClick={toggleMaximize}
        aria-label={isMaximized ? t`Restore` : t`Maximize`}
        title={isMaximized ? t`Restore` : t`Maximize`}
        className={cn(baseButton, tone)}
      >
        {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
      </button>
      <button
        type="button"
        onClick={close}
        aria-label={t`Close`}
        title={t`Close`}
        className={cn(
          baseButton,
          tone,
          "hover:bg-[#c42b1c] hover:text-white active:bg-[#b1271a] active:text-white",
        )}
      >
        <CloseIcon />
      </button>
    </div>
  )
}

function MinimizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M0 5 H10" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

function MaximizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

function RestoreIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1">
      <path d="M2.5 2.5 V0.5 H9.5 V7.5 H7.5" />
      <rect x="0.5" y="2.5" width="7" height="7" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M0 0 L10 10 M10 0 L0 10" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}
