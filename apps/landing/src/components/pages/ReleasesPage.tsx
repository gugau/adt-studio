import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  Tag,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";
import {
  formatAbsoluteDate,
  formatDownloads,
  formatRelativeDate,
  stripMarkdown,
  sumReleaseDownloads,
  useGithubReleases,
  type GithubRelease,
} from "@/lib/useGithubReleases";

export function ReleasesPage() {
  const { releases, loading, error } = useGithubReleases();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const items = releases ?? [];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[color:var(--color-background)] pb-24 pt-32 lg:pb-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] [background:radial-gradient(ellipse_55%_55%_at_50%_0%,color-mix(in_oklch,var(--color-primary)_14%,transparent),transparent_70%)]"
      />

      <div className="relative mx-auto w-full max-w-3xl px-4">
        <div
          className={cn(
            "flex items-center gap-2 transition-all duration-500",
            mounted ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
          )}
        >
          <a
            href="#top"
            className="group inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)]/70 px-3 py-1 text-xs font-semibold text-[color:var(--color-muted-foreground)] shadow-sm backdrop-blur-sm transition-all hover:border-[color:var(--color-primary)]/30 hover:text-[color:var(--color-foreground)]"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
            Back to home
          </a>
        </div>

        <header className="mt-8 flex flex-col gap-3">
          <div
            className={cn(
              "text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-muted-foreground)] transition-opacity duration-500",
              mounted ? "opacity-100" : "opacity-0",
            )}
            style={{ transitionDelay: "80ms" }}
          >
            Releases
          </div>
          <h1
            className={cn(
              "text-balance text-3xl font-bold leading-[1.1] tracking-tight transition-all duration-[700ms] ease-[cubic-bezier(0.22,1,0.36,1)] md:text-[44px]",
              mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
            )}
            style={{ transitionDelay: "140ms" }}
          >
            Every release of ADT Studio.
          </h1>
          <p
            className={cn(
              "max-w-xl text-base leading-relaxed text-[color:var(--color-muted-foreground)] transition-opacity duration-[600ms] md:text-lg",
              mounted ? "opacity-100" : "opacity-0",
            )}
            style={{ transitionDelay: "240ms" }}
          >
            Full changelog, sorted newest first. Click any release for the
            complete notes and per-asset downloads.
          </p>
        </header>

        <div className="mt-12">
          {loading && items.length === 0 ? (
            <ReleaseListSkeleton mounted={mounted} />
          ) : error && items.length === 0 ? (
            <ErrorCard />
          ) : items.length === 0 ? (
            <EmptyCard />
          ) : (
            <ol className="flex flex-col gap-3">
              {items.map((release, i) => (
                <ReleaseRow
                  key={release.tag_name}
                  release={release}
                  index={i}
                  isLatest={i === 0}
                  mounted={mounted}
                />
              ))}
            </ol>
          )}
        </div>

        <div
          className={cn(
            "mt-10 flex flex-wrap items-center justify-center gap-2 transition-opacity duration-500",
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

function ReleaseRow({
  release,
  index,
  isLatest,
  mounted,
}: {
  release: GithubRelease;
  index: number;
  isLatest: boolean;
  mounted: boolean;
}) {
  const title = release.name?.trim() || release.tag_name;
  const summary = stripMarkdown(release.body)
    .split("\n")
    .filter(Boolean)
    .slice(0, 2)
    .join(" · ");
  const detailHref = `#/releases/${encodeURIComponent(release.tag_name)}`;
  const totalDownloads = sumReleaseDownloads(release);

  return (
    <li
      className={cn(
        "group transition-all duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        mounted ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      )}
      style={{ transitionDelay: `${300 + Math.min(index, 8) * 60}ms` }}
    >
      <a
        href={detailHref}
        className="relative flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[color:var(--color-primary)]/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)] sm:flex-row sm:items-center sm:gap-5"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--color-primary)]/10 px-2 py-0.5 font-mono text-[11px] font-bold text-[color:var(--color-primary)]">
              <Tag className="h-3 w-3" />
              {release.tag_name}
            </span>
            {isLatest && (
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Latest
              </span>
            )}
            {release.prerelease && (
              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Beta
              </span>
            )}
            <span className="font-mono text-[11px] text-[color:var(--color-muted-foreground)]">
              {formatAbsoluteDate(release.published_at)}
              <span className="opacity-60">
                {" · "}
                {formatRelativeDate(release.published_at)}
              </span>
            </span>
            {totalDownloads > 0 && (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[color:var(--color-muted-foreground)]">
                <Download className="h-3 w-3" />
                {formatDownloads(totalDownloads)}
              </span>
            )}
          </div>

          <div className="line-clamp-1 text-base font-semibold tracking-tight text-[color:var(--color-foreground)]">
            {title}
          </div>

          {summary && (
            <p className="line-clamp-2 text-sm leading-relaxed text-[color:var(--color-muted-foreground)]">
              {summary}
            </p>
          )}
        </div>

        <span className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-[color:var(--color-muted-foreground)] transition-colors group-hover:text-[color:var(--color-primary)] sm:inline-flex">
          View details
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </a>
    </li>
  );
}

function ReleaseListSkeleton({ mounted }: { mounted: boolean }) {
  return (
    <ol className="flex flex-col gap-3" aria-busy>
      {Array.from({ length: 5 }).map((_, i) => (
        <li
          key={i}
          className={cn(
            "rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5 transition-opacity duration-500",
            mounted ? "opacity-100" : "opacity-0",
          )}
          style={{ transitionDelay: `${300 + i * 60}ms` }}
        >
          <div className="flex items-center gap-2">
            <span className="h-4 w-16 rounded bg-[color:var(--color-muted)]" />
            <span className="h-3 w-24 rounded bg-[color:var(--color-muted)]" />
          </div>
          <div className="mt-3 h-4 w-2/3 rounded bg-[color:var(--color-muted)]" />
          <div className="mt-2 flex flex-col gap-1.5">
            <span className="block h-2 w-[92%] rounded bg-[color:var(--color-muted)]" />
            <span className="block h-2 w-[80%] rounded bg-[color:var(--color-muted)]" />
          </div>
        </li>
      ))}
    </ol>
  );
}

function ErrorCard() {
  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6">
      <div className="text-base font-semibold text-[color:var(--color-foreground)]">
        Couldn&rsquo;t load the release list
      </div>
      <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
        We couldn&rsquo;t reach GitHub. The full list is always available on
        the upstream repo.
      </p>
      <div className="mt-4">
        <Button
          href="https://github.com/unicef/adt-studio/releases"
          target="_blank"
          rel="noreferrer noopener"
          variant="secondary"
          size="md"
        >
          Open on GitHub
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function EmptyCard() {
  return (
    <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-card)]/60 p-6 text-sm text-[color:var(--color-muted-foreground)]">
      No releases published yet — check back once the first build ships.
    </div>
  );
}
