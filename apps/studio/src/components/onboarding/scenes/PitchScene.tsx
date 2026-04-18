import { useEffect, useState } from "react";
import {
  Volume2,
  Languages,
  LayoutGrid,
  Hand,
  Image as ImageIcon,
  BookMarked,
  Check,
} from "lucide-react";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react/macro";
import { cn } from "@/lib/utils";
import type { OnboardingStepProps } from "../steps";
import { t } from "@lingui/core/macro";

const PILLAR_COLORS = {
  speech: { text: "text-rose-600", bg: "bg-rose-50" },
  translate: { text: "text-pink-600", bg: "bg-pink-50" },
  layout: { text: "text-blue-600", bg: "bg-blue-50" },
  sign: { text: "text-cyan-600", bg: "bg-cyan-50" },
} as const;

export function PitchScene(_props: OnboardingStepProps) {
  const { t } = useLingui();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const pillars = [
    { key: "speech", label: t`Audio narration`, Icon: Volume2 },
    { key: "translate", label: t`Translations`, Icon: Languages },
    { key: "layout", label: t`Structured HTML`, Icon: LayoutGrid },
    { key: "sign", label: t`Sign language`, Icon: Hand },
  ] as const;

  return (
    <div className="relative grid h-full w-full grid-cols-1 items-center gap-14 p-8 md:grid-cols-[1.1fr_1fr] md:px-20">
      <div>
        <div
          className={cn(
            "mb-4 flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-all duration-500",
            mounted ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0",
          )}
        >
          <span className="inline-block h-px w-6 bg-muted-foreground" />
          <Trans>What it does</Trans>
        </div>

        <h1
          className={cn(
            "mb-5 text-4xl font-semibold leading-[1.05] tracking-tight text-foreground transition-all duration-[700ms] ease-[cubic-bezier(0.22,1,0.36,1)] md:text-5xl",
            mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
          )}
          style={{ transitionDelay: "100ms" }}
        >
          <Trans>
            This is <span className="text-primary font-bold">ADT Studio</span>.
          </Trans>
        </h1>

        <p
          className={cn(
            "max-w-xl text-[17px] leading-relaxed text-muted-foreground transition-all duration-[700ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
            mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
          )}
          style={{ transitionDelay: "250ms" }}
        >
          <Trans>
            Turn any PDF into a fully accessible book — audio, translations,
            structured HTML layouts — all generated from your source file,{" "}
            <span className="font-semibold text-foreground">all editable</span>,{" "}
            <span className="font-semibold text-foreground">all yours</span>.
          </Trans>
        </p>

        <div
          className={cn(
            "mt-7 flex flex-wrap gap-2 transition-all duration-[700ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
            mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
          )}
          style={{ transitionDelay: "400ms" }}
        >
          {pillars.map((p) => {
            const colors = PILLAR_COLORS[p.key];
            return (
              <span
                key={p.key}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
                  colors.bg,
                  colors.text,
                )}
              >
                <p.Icon className="h-3.5 w-3.5" />
                {p.label}
              </span>
            );
          })}
        </div>
      </div>

      <PdfToBookDiagram mounted={mounted} />
    </div>
  );
}

function PDFCard({ mounted }: { mounted: boolean }) {
  return (
    <div
      className={cn(
        "absolute left-0 top-[30px] z-10 box-border h-[250px] w-[190px] rounded-[10px] border border-border bg-card px-4 py-3.5 transition-transform duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        mounted
          ? "-rotate-[5deg]"
          : "-translate-x-2.5 -rotate-[5deg] scale-[0.96]",
      )}
      style={{
        boxShadow:
          "0 14px 30px -16px rgba(0,0,0,.22), 0 2px 6px rgba(0,0,0,.06)",
        transitionDelay: "300ms",
      }}
    >
      <div
        aria-hidden
        className="absolute right-0 top-0 h-5 w-5 rounded-tr-[10px]"
        style={{
          background: "linear-gradient(225deg, #f3f4f6 50%, transparent 50%)",
        }}
      />
      <div className="mb-3 flex items-center gap-1.5">
        <span className="rounded-sm bg-red-50 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-red-500">
          <Trans>PDF</Trans>
        </span>
        <span className="font-mono text-[9px] text-muted-foreground">
          238pp
        </span>
      </div>
      {[86, 96, 74, 88, 80].map((w, i) => (
        <div
          key={i}
          className="mb-1.5 h-1 rounded-sm bg-muted"
          style={{ width: `${w}%` }}
        />
      ))}
      <div className="mt-1.5 mb-2.5 grid h-10 place-items-center rounded-sm bg-muted/80 text-muted-foreground">
        <ImageIcon className="h-[18px] w-[18px]" />
      </div>
      {[70, 90, 60].map((w, i) => (
        <div
          key={i}
          className="mb-1.5 h-1 rounded-sm bg-muted"
          style={{ width: `${w}%` }}
        />
      ))}
    </div>
  );
}

function PdfToBookDiagram({ mounted }: { mounted: boolean }) {
  return (
    <div className="relative mx-auto h-[420px] w-[480px]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-5 inset-x-14 blur-[2px]"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 50%, rgba(43,127,255,.10), transparent 70%)",
        }}
      />

      <PDFCard mounted={mounted} />

      {/* Arrow */}
      <div
        className="absolute left-[170px] top-[175px] z-20 flex h-[30px] w-20 items-center justify-center transition-opacity duration-[400ms]"
        style={{
          opacity: mounted ? 1 : 0,
          transitionDelay: "900ms",
        }}
      >
        <svg width="60" height="14" viewBox="0 0 60 14" className="block">
          <defs>
            <linearGradient id="pitch-arrow-grad" x1="0" x2="1">
              <stop offset="0" stopColor="#a3a3a3" />
              <stop offset="1" stopColor="#2b7fff" />
            </linearGradient>
          </defs>
          <path
            d="M2 7h50M48 2l6 5-6 5"
            stroke="url(#pitch-arrow-grad)"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span
          aria-hidden
          className="absolute top-[-18px] rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-primary-foreground"
          style={{ background: "var(--color-primary)" }}
        >
          <Trans>ADT</Trans>
        </span>
      </div>

      <BookCard mounted={mounted} />

      <FloatGlyph
        top={-6}
        right={250}
        hex="#e11d48"
        bg="#fff1f2"
        Icon={Volume2}
        delay={1500}
        mounted={mounted}
      />
      <FloatGlyph
        top={90}
        right={-14}
        hex="#db2777"
        bg="#fdf2f8"
        Icon={Languages}
        delay={1650}
        mounted={mounted}
      />
      <FloatGlyph
        top={320}
        right={74}
        hex="#0891b2"
        bg="#ecfeff"
        Icon={Hand}
        delay={1800}
        mounted={mounted}
      />
    </div>
  );
}

function BookCard({ mounted }: { mounted: boolean }) {
  return (
    <div
      className={cn(
        "absolute right-0 top-0 z-[15] h-[340px] w-[270px] overflow-hidden rounded-xl border border-border bg-card transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        mounted ? "rotate-[3deg]" : "translate-x-5 rotate-[3deg] scale-[0.95]",
      )}
      style={{
        boxShadow:
          "0 30px 60px -20px rgba(43,127,255,.25), 0 4px 14px rgba(0,0,0,.08)",
        transitionDelay: "600ms",
      }}
    >
      <div className="flex h-[30px] items-center gap-1.5 px-3 bg-blue-500">
        <Check className="h-3 w-3 text-white" />
        <span className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-white">
          <Trans>Accessible book</Trans>
        </span>
        <span aria-hidden className="ml-auto flex gap-[3px]">
          <span className="h-1 w-1 rounded-full bg-white/60" />
          <span className="h-1 w-1 rounded-full bg-white/60" />
          <span className="h-1 w-1 rounded-full bg-white/60" />
        </span>
      </div>
      <div className="px-4 pb-3.5 pt-4">
        <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
          <Trans>Chapter 3</Trans>
        </div>
        <div className="mb-2.5 h-3 w-3/4 rounded-sm bg-foreground" />
        <div className="mb-1.5 h-1 w-[92%] rounded-sm bg-muted" />
        <div className="mb-1.5 h-1 w-[88%] rounded-sm bg-muted" />
        <div className="mb-3.5 h-1 w-[60%] rounded-sm bg-muted" />

        <div
          className="relative mb-1.5 grid aspect-[16/9] place-items-center overflow-hidden rounded-md"
          style={{
            background: "linear-gradient(135deg, #dbeafe, #e0e7ff)",
          }}
        >
          <ImageIcon className="h-[26px] w-[26px] text-blue-500" />
          <span className="absolute bottom-1 right-1 rounded-sm bg-teal-50 px-1 py-0.5 text-[7px] font-bold uppercase tracking-wide text-teal-600">
            <Trans>Alt</Trans>
          </span>
        </div>
        <div className="mb-3 text-[8px] italic leading-relaxed text-muted-foreground">
          <Trans>
            Fig 3.1 — The water cycle: evaporation, condensation, precipitation.
          </Trans>
        </div>

        <div className="flex flex-wrap gap-1">
          <FeaturePill
            color="text-rose-600"
            bg="bg-rose-50"
            Icon={Volume2}
            label="EN · PT · ES"
            delay={1100}
            mounted={mounted}
          />
          <FeaturePill
            color="text-cyan-600"
            bg="bg-cyan-50"
            Icon={Hand}
            label="ASL · LIBRAS"
            delay={1250}
            mounted={mounted}
          />
          <FeaturePill
            color="text-lime-700"
            bg="bg-lime-50"
            Icon={BookMarked}
            label={t`Glossary`}
            delay={1400}
            mounted={mounted}
          />
        </div>
      </div>
    </div>
  );
}

function FloatGlyph({
  top,
  right,
  hex,
  bg,
  Icon,
  delay,
  mounted,
}: {
  top: number;
  right: number;
  hex: string;
  bg: string;
  Icon: typeof Volume2;
  delay: number;
  mounted: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "absolute z-20 grid h-10 w-10 place-items-center rounded-xl transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        mounted ? "scale-100 opacity-100" : "scale-[0.6] opacity-0",
      )}
      style={{
        top,
        right,
        background: bg,
        color: hex,
        border: `1px solid ${hex}22`,
        boxShadow: `0 6px 18px -6px ${hex}55, 0 1px 3px rgba(0,0,0,.05)`,
        transitionDelay: `${delay}ms`,
      }}
    >
      <Icon className="h-[18px] w-[18px]" />
    </div>
  );
}

function FeaturePill({
  color,
  bg,
  Icon,
  label,
  delay,
  mounted,
}: {
  color: string;
  bg: string;
  Icon: typeof Volume2;
  label: string;
  delay: number;
  mounted: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold",
        bg,
        color,
        "transition-all duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        mounted ? "scale-100 opacity-100" : "scale-[0.7] opacity-0",
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}
