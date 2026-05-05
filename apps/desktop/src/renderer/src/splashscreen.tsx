import { Trans } from "@lingui/react/macro";
import { SplashLogo } from "./components/SplashLogo";
import { RecoveryPanel } from "./components/RecoveryPanel";
import { useElapsedSeconds } from "./hooks/use-elapsed-seconds";
import { StatusMessage } from "./components/StatusMessage";
import { Progress } from "./components/Progress";
import { STUCK_THRESHOLD_SECONDS } from "./constants";

export function Splashscreen() {
  const elapsed = useElapsedSeconds();
  const isStuck = elapsed >= STUCK_THRESHOLD_SECONDS;
  const version = window.splashControls?.version;

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-linear-to- from-white to-slate-50"
    >
      <div className="flex animate-[splash-fade-in-up_0.6s_ease_both] flex-col items-center gap-5">
        <SplashLogo />
        <div>
          <div className="text-center text-[15px] font-semibold uppercase tracking-[0.18em] text-slate-900">
            ADT Studio
          </div>
          <div className="mt-1 text-center text-[11px] font-normal uppercase tracking-[0.12em] text-slate-400">
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
  );
}
