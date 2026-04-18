import { useEffect, useRef, useState } from "react";
import { Check, Pause, Play } from "lucide-react";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react/macro";
import { cn } from "@/lib/utils";
import type { OnboardingStepProps } from "../../steps";
import { DURATIONS, FEATURE_COUNT, HOLD_AFTER_MS } from "./utils";
import { AnimPdfPreset } from "./AnimPdfPreset";
import { AnimPresetPicker } from "./AnimPresetPicker";
import { AnimPipeline } from "./AnimPipeline";
import { AnimEnrich } from "./AnimEnrich";

export function CarouselScene({ onNext }: OnboardingStepProps) {
  const { t } = useLingui();
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [playing, setPlaying] = useState(true);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onNextRef = useRef(onNext);
  const doneRef = useRef(false);
  useEffect(() => { onNextRef.current = onNext; }, [onNext]);

  useEffect(() => {
    if (!playing || holding) return;
    let raf: number;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      setProgress((p) => {
        const dur = DURATIONS[idx] ?? 12000;
        const np = p + dt / dur;
        if (np >= 1) {
          if (idx < FEATURE_COUNT - 1) {
            if (!holdTimer.current) {
              setHolding(true);
              holdTimer.current = setTimeout(() => {
                holdTimer.current = null;
                setIdx((i) => i + 1);
                setProgress(0);
                setHolding(false);
              }, HOLD_AFTER_MS);
            }
            return 1;
          }
          doneRef.current = true;
          return 1;
        }
        return np;
      });
      if (doneRef.current) {
        doneRef.current = false;
        onNextRef.current();
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [playing, holding, idx]);

  useEffect(() => {
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    };
  }, []);

  const features = [
    {
      num: "01",
      title: t`Start from a PDF`,
      body: t`Drop in a PDF to kick things off. ADT Studio organizes it into a new book project so you don't start from zero.`,
      Anim: AnimPdfPreset,
    },
    {
      num: "02",
      title: t`Pick a preset`,
      body: t`Choose a preset that matches your content — textbook, storyboard, reference, or custom — and ADT Studio tailors the pipeline accordingly.`,
      Anim: AnimPresetPicker,
    },
    {
      num: "03",
      title: t`Run the pipeline`,
      body: t`Configure each stage — extract, storyboard, layout — then let ADT Studio build the book. Review the output, correct anything that needs a human touch.`,
      Anim: AnimPipeline,
    },
    {
      num: "04",
      title: t`Edit & enrich`,
      body: t`Layer on translations, text-to-speech, and a glossary — all inspectable, cacheable, reversible.`,
      Anim: AnimEnrich,
    },
  ];

  const goTo = (i: number) => {
    setHolding(false);
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setIdx(i);
    setProgress(0);
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="grid flex-1 grid-cols-1 items-center gap-14 overflow-hidden px-8 pt-8 md:grid-cols-[1fr_1.35fr] md:px-16">
        <div>
          <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <Trans>How it works</Trans>
          </div>

          <div className="relative min-h-[170px]">
            {features.map((f, i) => (
              <div
                key={i}
                className={cn(
                  "transition-all duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                  i === idx
                    ? "relative opacity-100"
                    : "pointer-events-none absolute inset-0 translate-y-2.5 opacity-0",
                )}
              >
                <div className="mb-2.5 font-mono text-xs font-bold uppercase tracking-wider text-primary">
                  {f.num} / {String(features.length).padStart(2, "0")}
                </div>
                <h2 className="mb-3.5 text-3xl font-semibold leading-tight tracking-tight text-foreground">
                  {f.title}
                </h2>
                <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-7 flex flex-col gap-1.5">
            {features.map((f, i) => {
              const done = i < idx;
              const active = i === idx;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all",
                    active
                      ? "border-border bg-card shadow-sm"
                      : "border-transparent bg-transparent hover:bg-accent/60",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
                      done
                        ? "border-primary bg-primary"
                        : active
                          ? "border-primary bg-card"
                          : "border-border bg-transparent",
                    )}
                  >
                    {done && (
                      <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />
                    )}
                    {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </span>
                  <span
                    className={cn(
                      "flex-1 text-sm",
                      active ? "font-semibold text-foreground" : "font-medium text-muted-foreground",
                    )}
                  >
                    {f.title}
                  </span>
                  {active && (
                    <span className="h-[3px] w-14 overflow-hidden rounded bg-muted">
                      <span className="block h-full bg-primary" style={{ width: `${progress * 100}%` }} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {playing ? <Trans>Pause</Trans> : <Trans>Play</Trans>}
          </button>
        </div>

        <div
          className="relative aspect-[4/3] w-full overflow-hidden rounded-[14px] border border-border bg-card"
          style={{ boxShadow: "0 10px 30px -12px rgba(0,0,0,.12), 0 2px 6px rgba(0,0,0,.04)" }}
        >
          {features.map((f, i) => (
            <div
              key={i}
              className={cn(
                "absolute inset-0 transition-opacity duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                i === idx ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              <f.Anim progress={i === idx ? progress : 0} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
