import { useLingui } from "@lingui/react/macro"
import { cn } from "@/lib/utils"
import { useWindowControls } from "@/hooks/use-window-controls"

export function LinuxControls({ className }: { className?: string }) {
  const { t } = useLingui()
  const { isMaximized, minimize, toggleMaximize, close } = useWindowControls()

  const btnBase =
    "flex items-center justify-center h-6 w-6 rounded-full bg-white/15 hover:bg-white/25 active:bg-white/10 text-white/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"

  return (
    <div
      className={cn("flex items-center gap-2 no-drag", className)}
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      <button
        type="button"
        onClick={minimize}
        aria-label={t`Minimize`}
        title={t`Minimize`}
        className={btnBase}
      >
        <MinimizeGlyph />
      </button>
      <button
        type="button"
        onClick={toggleMaximize}
        aria-label={isMaximized ? t`Restore` : t`Maximize`}
        title={isMaximized ? t`Restore` : t`Maximize`}
        className={btnBase}
      >
        {isMaximized ? <RestoreGlyph /> : <MaximizeGlyph />}
      </button>
      <button
        type="button"
        onClick={close}
        aria-label={t`Close`}
        title={t`Close`}
        className={btnBase}
      >
        <CloseGlyph />
      </button>
    </div>
  )
}

function MinimizeGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2 8 H10" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  )
}

function MaximizeGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect x="2.25" y="2.25" width="7.5" height="7.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  )
}

function RestoreGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect x="3.5" y="2.25" width="6.25" height="6.25" rx="0.75" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <rect x="2.25" y="3.5" width="6.25" height="6.25" rx="0.75" fill="#374151" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  )
}

function CloseGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 3 L9 9 M9 3 L3 9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  )
}
