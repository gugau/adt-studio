import { ArrowRight, ChevronDown, Github, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { PdfToBookDiagram } from "@/components/PdfToBookDiagram";
import { cn } from "@/lib/cn";
import {
  formatRelativeDate,
  useGithubReleases,
} from "@/lib/useGithubReleases";

export function WelcomeScene() {
  const [mounted, setMounted] = useState(false);
  const { releases } = useGithubReleases();
  const latest = releases?.[0];

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <section
      id="top"
      className="snap-section relative flex min-h-screen w-full items-center overflow-hidden px-4 pb-24 pt-32 lg:pb-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 text-[color:var(--color-foreground)] opacity-[0.18] [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_65%_70%_at_50%_40%,black_10%,transparent_75%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-20%] h-[560px] w-[1100px] -translate-x-1/2 rounded-full blur-3xl [background:radial-gradient(closest-side,color-mix(in_oklch,var(--color-primary)_28%,transparent),transparent_80%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[6%] h-[260px] w-[520px] -translate-x-1/2 rounded-full blur-2xl [background:radial-gradient(closest-side,color-mix(in_oklch,var(--color-primary)_14%,transparent),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-[color:var(--color-background)]"
      />

      <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
          <a
            href={
              latest?.html_url ??
              "https://github.com/unicef/adt-studio/releases/latest"
            }
            target="_blank"
            rel="noreferrer noopener"
            className={cn(
              "group relative inline-flex max-w-full items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)]/70 px-3 py-1 text-xs font-semibold text-[color:var(--color-muted-foreground)] shadow-sm backdrop-blur-sm transition-all duration-500 hover:border-[color:var(--color-primary)]/30 hover:text-[color:var(--color-foreground)]",
              mounted ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
            )}
          >
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--color-primary)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-primary)]">
              <Sparkles className="h-3 w-3" />
              {latest?.prerelease ? "Beta" : "New"}
            </span>
            {latest ? (
              <span className="min-w-0 truncate">
                <span className="font-mono">{latest.tag_name}</span>
                <span className="text-[color:var(--color-muted-foreground)]/80">
                  {" · "}
                  {formatRelativeDate(latest.published_at)}
                </span>
                <span className="hidden sm:inline">{" · ADT Studio"}</span>
              </span>
            ) : (
              <span className="min-w-0 truncate">
                <span className="sm:hidden">Now on macOS, Windows, Linux</span>
                <span className="hidden sm:inline">
                  ADT Studio — now on macOS, Windows, Linux
                </span>
              </span>
            )}
            <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
          </a>

          <h1
            className={cn(
              "text-balance text-[48px] font-bold leading-[0.88] tracking-tight transition-all duration-[700ms] ease-[cubic-bezier(0.22,1,0.36,1)] sm:text-[56px] md:text-[88px] lg:text-[104px]",
              mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
            )}
            style={{ transitionDelay: "150ms" }}
          >
            <span className="block">Born</span>
            <span className="block bg-gradient-to-r from-[color:var(--color-primary)] to-violet-500 bg-clip-text text-transparent">
              accessible.
            </span>
          </h1>

          <p
            className={cn(
              "max-w-xl text-[17px] leading-relaxed text-[color:var(--color-muted-foreground)] transition-opacity duration-[600ms] md:text-lg",
              mounted ? "opacity-100" : "opacity-0",
            )}
            style={{ transitionDelay: "350ms" }}
          >
            Turn any textbook into something every student can read, hear,
            see, and understand — audio, structured layouts, translations, and
            sign language, all built in.
          </p>

          <div
            className={cn(
              "mt-1 flex flex-wrap items-center justify-center gap-3 transition-opacity duration-500 lg:justify-start",
              mounted ? "opacity-100" : "opacity-0",
            )}
            style={{ transitionDelay: "500ms" }}
          >
            <Button href="#/download" size="lg" variant="primary">
              Download for free
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              href="https://github.com/unicef/adt-studio"
              target="_blank"
              rel="noreferrer noopener"
              size="lg"
              variant="secondary"
            >
              <Github className="h-4 w-4" />
              Star on GitHub
            </Button>
          </div>

          <div
            className={cn(
              "mt-1 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[color:var(--color-muted-foreground)] transition-opacity duration-500 lg:justify-start",
              mounted ? "opacity-100" : "opacity-0",
            )}
            style={{ transitionDelay: "650ms" }}
          >
            <span className="font-mono">MIT licensed</span>
            <span className="h-1 w-1 rounded-full bg-[color:var(--color-border)]" />
            <span className="font-mono">Runs locally</span>
            <span className="h-1 w-1 rounded-full bg-[color:var(--color-border)]" />
            <span className="font-mono">Windows · macOS · Linux</span>
          </div>
        </div>

        <div
          className={cn(
            "relative flex justify-center transition-all duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)] lg:justify-end",
            mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
          )}
          style={{ transitionDelay: "400ms" }}
        >
          <div className="relative h-[294px] w-[336px] sm:h-[420px] sm:w-[480px]">
            <div className="absolute inset-0 origin-top-left scale-[0.7] sm:scale-100">
              <PdfToBookDiagram mounted={mounted} />
            </div>
          </div>
        </div>
      </div>

      <a
        href="#features"
        aria-label="Scroll to next section"
        className={cn(
          "absolute bottom-6 left-1/2 grid h-10 w-10 -translate-x-1/2 cursor-pointer place-items-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)]/70 text-[color:var(--color-muted-foreground)] backdrop-blur-sm transition-all duration-500 hover:border-[color:var(--color-primary)]/40 hover:text-[color:var(--color-foreground)]",
          mounted ? "opacity-100" : "opacity-0",
        )}
        style={{
          transitionDelay: "900ms",
          animation: mounted
            ? "onboarding-icon-float 4s ease-in-out 1s infinite"
            : undefined,
        }}
      >
        <ChevronDown className="h-4 w-4" />
      </a>
    </section>
  );
}
