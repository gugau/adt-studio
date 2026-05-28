import { ArrowRight } from "lucide-react";
import { SectionEyebrow } from "@/components/SectionEyebrow";
import { cn } from "@/lib/cn";
import {
  formatRelativeApprox,
  MOCK_RELEASES,
  type MockRelease,
} from "@/data/mockReleases";
import { useInView } from "@/lib/useScrollProgress";

export function ReleasesScene() {
  const { ref, inView: mounted } = useInView<HTMLDivElement>({ threshold: 0.2 });

  const latest = MOCK_RELEASES[0] ?? null;

  return (
    <section
      id="releases"
      className="snap-section relative flex min-h-screen items-center overflow-hidden border-y border-[color:var(--color-border)] bg-[color:var(--color-muted)]/30 py-24 lg:py-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -z-0 h-[520px] -translate-y-1/2 [background:radial-gradient(ellipse_60%_55%_at_50%_50%,color-mix(in_oklch,var(--color-primary)_12%,transparent),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-px bg-gradient-to-r from-transparent via-[color:var(--color-border)] to-transparent"
      />

      <div
        ref={ref}
        className="relative mx-auto w-full max-w-6xl px-6 md:px-10"
      >
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow label="Updates" />
          <h2
            className={cn(
              "mt-5 text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.025em] md:text-[56px]",
              "bg-gradient-to-b from-[color:var(--color-foreground)] via-[color:var(--color-foreground)] to-[color:var(--color-foreground)]/60 bg-clip-text text-transparent",
              "transition-all duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
              mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
            )}
            style={{ transitionDelay: "80ms" }}
          >
            Shipped, open,{" "}
            <span className="bg-gradient-to-br from-[color:var(--color-primary)] to-[color:var(--color-primary)]/70 bg-clip-text text-transparent">
              documented
            </span>
            .
          </h2>
          <p
            className={cn(
              "mx-auto mt-5 max-w-xl text-base leading-relaxed text-[color:var(--color-muted-foreground)] md:text-lg",
              "transition-opacity duration-[700ms]",
              mounted ? "opacity-100" : "opacity-0",
            )}
            style={{ transitionDelay: "220ms" }}
          >
            Every version ships with full release notes — what&rsquo;s new,
            what&rsquo;s fixed, what&rsquo;s next.
          </p>
        </div>

        {latest && (
          <a
            href="#/releases"
            className={cn(
              "group relative mx-auto mt-14 block max-w-5xl",
              "transition-all duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
              mounted ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
            )}
            style={{ transitionDelay: "340ms" }}
          >
            <div className="relative grid grid-cols-1 gap-0 overflow-hidden rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.18)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-1 group-hover:shadow-[0_32px_80px_-30px_rgba(0,0,0,0.28)] md:grid-cols-[1.05fr_1fr]">
              <HeroVisual release={latest} />

              <div className="flex flex-col justify-between gap-8 p-7 md:p-10">
                <div className="flex flex-col gap-5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-primary)]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-primary)]">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--color-primary)]/60" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--color-primary)]" />
                      </span>
                      Latest release
                    </span>
                    <span className="font-mono text-[11px] tracking-tight text-[color:var(--color-muted-foreground)]">
                      {formatRelativeApprox(latest.published_at)}
                    </span>
                  </div>

                  <h3 className="text-balance text-3xl font-semibold leading-[1.08] tracking-tight text-[color:var(--color-foreground)] md:text-[34px]">
                    {latest.name}
                  </h3>

                  <p className="line-clamp-3 max-w-xl text-[15px] leading-relaxed text-[color:var(--color-foreground)]/75 md:text-base">
                    {latest.summary}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-foreground)] px-4 py-2.5 text-sm font-semibold text-[color:var(--color-background)] shadow-sm transition-all duration-300 ease-out group-hover:translate-x-0.5 group-hover:shadow-md">
                    See every release
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 ease-out group-hover:translate-x-0.5" />
                  </span>
                  <span className="text-xs font-semibold text-[color:var(--color-muted-foreground)]">
                    + {MOCK_RELEASES.length - 1} earlier releases
                  </span>
                </div>
              </div>
            </div>
          </a>
        )}
      </div>
    </section>
  );
}

function HeroVisual({ release }: { release: MockRelease }) {
  return (
    <div className="relative aspect-[16/11] w-full overflow-hidden bg-[color:var(--color-muted)] md:aspect-auto md:h-full md:min-h-[360px]">
      <img
        src={release.hero.src}
        alt={release.hero.alt}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-[color:var(--color-card)]/30"
      />
      <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-black/40 px-2 py-1 font-mono text-[11px] font-semibold text-white shadow-sm backdrop-blur-md">
        {release.tag}
      </span>
    </div>
  );
}

