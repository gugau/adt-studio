import { useState } from "react"
import { Trans, useLingui } from "@lingui/react/macro"

function RecoveryPanel({ elapsed }: { elapsed: number }) {
  const { t } = useLingui()
  const [busy, setBusy] = useState<"relaunch" | "quit" | null>(null)

  const handleRelaunch = async () => {
    if (busy) return
    setBusy("relaunch")
    try {
      await window.splashControls?.relaunch()
    } catch (err) {
      console.error("Failed to relaunch", err)
      setBusy(null)
    }
  }

  const handleQuit = async () => {
    if (busy) return
    setBusy("quit")
    try {
      await window.splashControls?.quit()
    } catch (err) {
      console.error("Failed to quit", err)
      setBusy(null)
    }
  }

  return (
    <div
      role="region"
      aria-label={t`Recovery actions`}
      className="flex w-full flex-col items-center gap-2.5"
      style={{ animation: "splash-recovery-fade-in 0.35s ease-out both" }}
    >
      <p className="text-center text-[11px] text-slate-500">
        <Trans>Stuck on this screen? You can restart or quit safely.</Trans>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleRelaunch}
          disabled={busy !== null}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "relaunch" ? <Trans>Restarting…</Trans> : <Trans>Restart</Trans>}
        </button>
        <button
          type="button"
          onClick={handleQuit}
          disabled={busy !== null}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-transparent bg-transparent px-3 text-[12px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "quit" ? <Trans>Quitting…</Trans> : <Trans>Quit</Trans>}
        </button>
      </div>
      <p className="text-[10px] tabular-nums text-slate-400">
        <Trans>Elapsed: {elapsed}s</Trans>
      </p>
    </div>
  )
}

export { RecoveryPanel }
