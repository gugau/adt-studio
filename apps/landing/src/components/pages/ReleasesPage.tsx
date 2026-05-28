import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";
import {
  formatRelativeApprox,
  MOCK_RELEASES,
  type MockRelease,
} from "@/data/mockReleases";

export function ReleasesPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const items = MOCK_RELEASES;

  return (
    <div className="relative min-h-screen bg-[color:var(--color-background)] pb-32 pt-32 lg:pb-40">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] [background:radial-gradient(ellipse_55%_55%_at_50%_0%,color-mix(in_oklch,var(--color-primary)_12%,transparent),transparent_70%)]"
      />

      <div className="relative mx-auto w-full max-w-5xl px-5 md:px-8">
        <div
          className={cn(
            "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            mounted ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
          )}
        >
          <a
            href="#top"
            className="group inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--color-muted-foreground)] transition-colors hover:text-[color:var(--color-foreground)]"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-300 ease-out group-hover:-translate-x-0.5" />
            Back to home
          </a>
        </div>

        <header className="relative mt-14 flex flex-col items-center gap-5 text-center">
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute left-1/2 top-1/2 -z-0 h-48 w-[520px] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-[1200ms]",
              "[background:radial-gradient(ellipse_60%_60%_at_50%_50%,color-mix(in_oklch,var(--color-primary)_22%,transparent),transparent_70%)] blur-2xl",
              mounted ? "opacity-100" : "opacity-0",
            )}
          />
          <h1
            className={cn(
              "relative text-balance text-5xl font-bold leading-[1.02] tracking-[-0.035em] transition-all duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)] md:text-7xl",
              "bg-gradient-to-b from-[color:var(--color-foreground)] via-[color:var(--color-foreground)] to-[color:var(--color-foreground)]/55 bg-clip-text text-transparent",
              mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
            )}
            style={{ transitionDelay: "140ms" }}
          >
            Updates
          </h1>
          <p
            className={cn(
              "relative max-w-xl text-base leading-relaxed text-[color:var(--color-muted-foreground)] transition-opacity duration-[700ms] md:text-lg",
              mounted ? "opacity-100" : "opacity-0",
            )}
            style={{ transitionDelay: "260ms" }}
          >
            What&rsquo;s new in ADT Studio.
          </p>
        </header>

        <ol className="mt-20 flex flex-col gap-24 md:gap-32">
          {items.map((release, i) => (
            <ReleaseEntry
              key={release.tag}
              release={release}
              index={i}
              mounted={mounted}
            />
          ))}
        </ol>

        <div
          className={cn(
            "mt-24 flex flex-wrap items-center justify-center gap-2 transition-opacity duration-700",
            mounted ? "opacity-100" : "opacity-0",
          )}
          style={{ transitionDelay: "560ms" }}
        >
          <Button
            href="https://github.com/unicef/adt-studio/releases"
            target="_blank"
            rel="noreferrer noopener"
            variant="secondary"
            size="md"
          >
            See all releases on GitHub
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReleaseEntry({
  release,
  index,
  mounted,
}: {
  release: MockRelease;
  index: number;
  mounted: boolean;
}) {
  const detailHref = `#/releases/${encodeURIComponent(release.tag)}`;

  return (
    <li
      id={release.tag}
      className={cn(
        "scroll-mt-32 transition-all duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
      )}
      style={{ transitionDelay: `${260 + Math.min(index, 6) * 60}ms` }}
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[200px_1fr] md:gap-12">
        <aside className="flex flex-col gap-2 md:sticky md:top-28 md:self-start md:pt-1">
          <div className="flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-muted-foreground)]">
            <span
              aria-hidden
              className="h-1 w-1 rounded-full bg-[color:var(--color-primary)]/70"
            />
            {release.tag}
          </div>
          <a
            href={detailHref}
            className="text-balance text-xl font-semibold leading-[1.15] tracking-tight text-[color:var(--color-foreground)] transition-colors duration-300 ease-out hover:text-[color:var(--color-primary)] md:text-[22px]"
          >
            {release.name}
          </a>
          <div className="font-mono text-[11px] tracking-tight text-[color:var(--color-muted-foreground)]">
            {formatRelativeApprox(release.published_at)}
          </div>
        </aside>

        <div className="flex flex-col gap-7">
          <a
            href={detailHref}
            aria-label={`Open ${release.name} release notes`}
            className="group relative block overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] shadow-sm transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-xl"
          >
            <div className="aspect-[16/9] w-full overflow-hidden bg-[color:var(--color-muted)]">
              <img
                src={release.hero.src}
                alt={release.hero.alt}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
              />
            </div>
          </a>

          <p className="max-w-2xl text-[15px] leading-relaxed text-[color:var(--color-foreground)]/85 md:text-base">
            {release.summary}{" "}
            <a
              href={detailHref}
              className="font-medium text-[color:var(--color-primary)] underline-offset-2 hover:underline"
            >
              Watch the video
            </a>{" "}
            to learn more.
          </p>

          {release.sections && release.sections.length > 0 && (
            <div className="mt-2 flex flex-col gap-7 md:gap-8">
              {release.sections.map((section, j) => (
                <div key={j}>
                  <div className="text-sm font-semibold tracking-tight text-[color:var(--color-foreground)]">
                    {section.heading}
                  </div>
                  <ul className="mt-3 flex flex-col gap-1.5 text-[15px] leading-relaxed text-[color:var(--color-foreground)]/85">
                    {section.items.map((item, k) => (
                      <li key={k} className="flex gap-2.5">
                        <span
                          aria-hidden
                          className="mt-[0.7em] h-1 w-1 shrink-0 rounded-full bg-[color:var(--color-muted-foreground)]/60"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
