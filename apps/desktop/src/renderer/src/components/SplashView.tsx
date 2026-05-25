import { Trans } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import { SplashLogo } from "./SplashLogo"
import { RecoveryPanel } from "./RecoveryPanel"
import { Progress } from "./Progress"
import { StatusMessage } from "./StatusMessage"
import { useElapsedSeconds } from "../hooks/use-elapsed-seconds"
import { STUCK_THRESHOLD_SECONDS } from "../constants"

/**
 * Default splashscreen view — logo + status + progress + (after the
 * stuck threshold) recovery actions. The bug icon at the top-right
 * navigates to `/debug` for the captured logs / startup error.
 */
export function SplashView() {
  const elapsed = useElapsedSeconds()
  const isStuck = elapsed >= STUCK_THRESHOLD_SECONDS
  const version = window.splashControls?.version

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-white"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 28%, #f4f8ff 0%, #ffffff 55%, #f8fafc 100%)",
        }}
      />

      <Link
        to="/debug"
        aria-label="Show debug info"
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <BugIcon />
      </Link>

      <div className="flex animate-[splash-fade-in-up_0.7s_ease_both] flex-col items-center gap-6">
        <SplashLogo />
        <div className="flex flex-col items-center gap-1.5">
          <div className="text-center text-[20px] font-semibold tracking-tight text-slate-900">
            ADT Studio
          </div>
          <div className="text-center text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
            <Trans>Accessible Digital Textbooks</Trans>
          </div>
        </div>
      </div>

      <div className="absolute bottom-9 left-0 right-0 flex animate-[splash-fade-in-up_0.6s_ease_0.3s_both] flex-col items-center gap-3 px-8">
        <div
          aria-live="polite"
          className="text-[11px] font-normal uppercase tracking-widest text-slate-500 animate-[splash-status-pulse_1.8s_ease-in-out_infinite]"
        >
          <StatusMessage elapsed={elapsed} />
        </div>
        <Progress />
        {isStuck && <RecoveryPanel elapsed={elapsed} />}
      </div>

      <div className="absolute bottom-2 right-3 text-sm tabular-nums text-slate-400">
        v{version}
      </div>
    </div>
  )
}

function BugIcon() {
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
      <path d="M8 2l1.88 1.88" />
      <path d="M14.12 3.88L16 2" />
      <path d="M9 7.13v-1a3.003 3.003 0 116 0v1" />
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6z" />
      <path d="M12 20v-9" />
      <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
      <path d="M6 13H2" />
      <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
      <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
      <path d="M22 13h-4" />
      <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
    </svg>
  )
}
