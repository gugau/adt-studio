import { useEffect, useRef, useState } from "react"
import { Trans, useLingui } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"

/**
 * Full-window debug route — replaces the splash content with the
 * captured startup error and recent API stdout/stderr. Sized to fit
 * the existing 460×460 splash window without resizing it; the log
 * region flexes and scrolls so anything overflowing stays reachable.
 *
 * Refreshes every 2s while mounted so logs stream in live, and exposes
 * Copy / Save / Refresh actions that round-trip to the main process.
 */
export function DebugView() {
  const { t } = useLingui()
  const [snapshot, setSnapshot] = useState<DebugSnapshot | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const feedbackTimer = useRef<number | null>(null)
  const logsRef = useRef<HTMLDivElement>(null)

  const refresh = async () => {
    try {
      const next = await window.splashControls?.getDebugInfo()
      if (next) setSnapshot(next)
    } catch (err) {
      console.error("Failed to load debug info", err)
    }
  }

  useEffect(() => {
    refresh()
    const id = window.setInterval(refresh, 2000)
    return () => window.clearInterval(id)
  }, [])

  // Pin scroll to the bottom whenever new logs arrive.
  useEffect(() => {
    const el = logsRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [snapshot])

  const showFeedback = (msg: string) => {
    setFeedback(msg)
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current)
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), 2000)
  }

  const handleCopy = async () => {
    try {
      await window.splashControls?.copyDebugInfo()
      showFeedback(t`Copied`)
    } catch (err) {
      console.error("Failed to copy debug info", err)
      showFeedback(t`Copy failed`)
    }
  }

  const handleSave = async () => {
    try {
      const path = await window.splashControls?.saveDebugInfo()
      if (path) showFeedback(t`Saved`)
    } catch (err) {
      console.error("Failed to save debug info", err)
      showFeedback(t`Save failed`)
    }
  }

  const error = snapshot?.startupError

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <div className="flex items-center gap-2">
          <Link
            to="/"
            aria-label={t`Back to splash`}
            className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <BackIcon />
          </Link>
          <span className="text-[12px] font-semibold text-slate-700">
            <Trans>Debug info</Trans>
          </span>
        </div>
        <div className="text-[10px] text-slate-400">
          {snapshot ? <span>v{snapshot.appVersion}</span> : null}
        </div>
      </div>

      {snapshot ? (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] text-slate-500">
          <span>
            {snapshot.platform} {snapshot.arch}
          </span>
          <span>Electron {snapshot.electronVersion}</span>
          <span>Node {snapshot.nodeVersion}</span>
          <span className="tabular-nums">
            {(snapshot.uptimeMs / 1000).toFixed(1)}s
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="mx-3 mt-2 shrink-0 rounded border border-rose-200 bg-rose-50 px-2 py-1.5 font-mono text-[10px] leading-tight text-rose-700">
          <div className="font-semibold">{error.message}</div>
          {error.stack ? (
            <pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap break-all text-[9px] text-rose-600">
              {error.stack}
            </pre>
          ) : null}
        </div>
      ) : null}

      <div
        ref={logsRef}
        className="m-3 flex-1 overflow-auto rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[10px] leading-tight text-slate-700"
      >
        {!snapshot ? (
          <div className="text-slate-400">
            <Trans>Loading debug info…</Trans>
          </div>
        ) : snapshot.logs.length === 0 ? (
          <div className="text-slate-400">
            <Trans>No log output captured yet.</Trans>
          </div>
        ) : (
          snapshot.logs.map((entry, i) => (
            <div
              key={`${entry.timestamp}-${i}`}
              className={
                entry.stream === "stderr"
                  ? "text-rose-600"
                  : entry.stream === "main"
                    ? "text-blue-600"
                    : ""
              }
            >
              <span className="text-slate-400">
                {new Date(entry.timestamp).toISOString().slice(11, 23)}{" "}
              </span>
              <span className="text-slate-400">[{entry.stream}]</span>{" "}
              {entry.line}
            </div>
          ))
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 px-3 py-2">
        <div className="text-[10px] text-emerald-600">
          {feedback ? <span>{feedback}</span> : null}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={refresh}
            className="inline-flex h-6 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-[10px] font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            <Trans>Refresh</Trans>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-6 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-[10px] font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            <Trans>Copy</Trans>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex h-6 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-[10px] font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            <Trans>Save…</Trans>
          </button>
        </div>
      </div>
    </div>
  )
}

function BackIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  )
}
