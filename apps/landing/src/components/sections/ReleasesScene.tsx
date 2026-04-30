import { ArrowRight, ArrowUpRight, Download, Tag } from "lucide-react";
import { SectionEyebrow } from "@/components/SectionEyebrow";
import { cn } from "@/lib/cn";
import {
  formatDownloads,
  formatRelativeDate,
  stripMarkdown,
  sumReleaseDownloads,
  useGithubReleases,
  type GithubRelease,
} from "@/lib/useGithubReleases";
import { useInView } from "@/lib/useScrollProgress";

export function ReleasesScene() {
  const { releases, loading, error } = useGithubReleases();
  const { ref, inView: mounted } = useInView<HTMLDivElement>({ threshold: 0.2 });
  const items = releases ?? [];

  return (
    <section
      id="releases"
      className="snap-section relative flex min-h-screen items-center border-y border-[color:var(--color-border)] bg-[color:var(--color-muted)]/30 py-24 lg:py-32"
    >
      <div ref={ref} className="mx-auto w-full max-w-6xl px-6 md:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow label="Releases" />
          <h2
            className={cn(
              "mt-5 text-balance text-4xl font-semibold leading-[1.08] tracking-tight md:text-5xl",
              "transition-all duration-[700ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
              mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
            )}
            style={{ transitionDelay: "80ms" }}
          >
            Shipped, open,{" "}
            <span className="text-[color:var(--color-primary)]">documented</span>
            .
          </h2>
          <p
            className={cn(
              "mx-auto mt-4 max-w-xl text-base leading-relaxed text-[color:var(--color-muted-foreground)] md:text-lg",
              "transition-opacity duration-[600ms]",
              mounted ? "opacity-100" : "opacity-0",
            )}
            style={{ transitionDelay: "220ms" }}
          >
            Every version ships with full release notes on GitHub — nothing
            hidden, always current.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
          {loading || items.length === 0
            ? Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard
                  key={i}
                  index={i}
                  mounted={mounted}
                  failed={error}
                />
              ))
            : items.slice(0, 3).map((r, i) => (
                <ReleaseCard
                  key={r.tag_name}
                  release={r}
                  index={i}
                  mounted={mounted}
                  isLatest={i === 0}
                />
              ))}
        </div>

        <div
          className={cn(
            "mt-10 flex justify-center transition-opacity duration-500",
            mounted ? "opacity-100" : "opacity-0",
          )}
          style={{ transitionDelay: "640ms" }}
        >
          <a
            href="https://github.com/unicef/adt-studio/releases"
            target="_blank"
            rel="noreferrer noopener"
            className="group inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-4 py-2 text-sm font-semibold text-[color:var(--color-foreground)] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[color:var(--color-primary)]/30 hover:shadow-md"
          >
            View all releases on GitHub
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>
      </div>
    </section>
  );
}

function ReleaseCard({
  release,
  index,
  mounted,
  isLatest,
}: {
  release: GithubRelease;
  index: number;
  mounted: boolean;
  isLatest: boolean;
}) {
  const title = release.name?.trim() || release.tag_name;
  const body = stripMarkdown(release.body).split("\n").slice(0, 3).join(" · ");
  const primaryAsset = pickPrimaryAsset(release.assets);
  const detailHref = `#/releases/${encodeURIComponent(release.tag_name)}`;

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 transition-all duration-[700ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-[color:var(--color-primary)]/30 hover:shadow-[0_12px_32px_-14px_rgba(0,0,0,0.14)]",
        mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
      )}
      style={{ transitionDelay: `${320 + index * 120}ms` }}
    >
      <a
        href={detailHref}
        aria-label={`Open release ${release.tag_name} details`}
        className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)]"
      />

      <div className="pointer-events-none relative z-[1] flex items-center gap-2">
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
      </div>

      <h3 className="pointer-events-none relative z-[1] mt-4 line-clamp-2 text-base font-semibold tracking-tight text-[color:var(--color-foreground)]">
        {title}
      </h3>
      <div className="pointer-events-none relative z-[1] mt-1 flex items-center gap-1.5 font-mono text-[11px] text-[color:var(--color-muted-foreground)]">
        <span>{formatRelativeDate(release.published_at)}</span>
        {sumReleaseDownloads(release) > 0 && (
          <>
            <span aria-hidden className="opacity-50">
              ·
            </span>
            <span className="inline-flex items-center gap-1">
              <Download className="h-3 w-3" />
              {formatDownloads(sumReleaseDownloads(release))}
            </span>
          </>
        )}
      </div>

      <p className="pointer-events-none relative z-[1] mt-3 line-clamp-3 text-sm leading-relaxed text-[color:var(--color-muted-foreground)]">
        {body || "No release notes provided."}
      </p>

      <div className="relative z-[2] mt-5 flex flex-1 items-end justify-between gap-3">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--color-foreground)] transition-colors group-hover:text-[color:var(--color-primary)]">
          View details
          <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
        </span>
        {primaryAsset && (
          <a
            href={primaryAsset.browser_download_url}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--color-muted-foreground)] transition-colors hover:text-[color:var(--color-foreground)]"
          >
            <Download className="h-3 w-3" />
            Download
          </a>
        )}
      </div>
    </article>
  );
}

function SkeletonCard({
  index,
  mounted,
  failed,
}: {
  index: number;
  mounted: boolean;
  failed?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 transition-all duration-[700ms]",
        mounted ? "opacity-100" : "opacity-0",
      )}
      style={{ transitionDelay: `${320 + index * 120}ms` }}
      aria-busy={!failed}
    >
      <div className="flex items-center gap-2">
        <span className="h-5 w-16 rounded-md bg-[color:var(--color-muted)]" />
      </div>
      <div className="mt-3 h-4 w-4/5 rounded bg-[color:var(--color-muted)]" />
      <div className="h-3 w-1/3 rounded bg-[color:var(--color-muted)]" />
      <div className="mt-2 flex flex-col gap-1.5">
        <span className="h-2 w-[96%] rounded bg-[color:var(--color-muted)]" />
        <span className="h-2 w-[92%] rounded bg-[color:var(--color-muted)]" />
        <span className="h-2 w-[72%] rounded bg-[color:var(--color-muted)]" />
      </div>
      {failed && (
        <div className="mt-2 text-xs text-[color:var(--color-muted-foreground)]">
          Couldn't reach GitHub — see all releases on the repo.
        </div>
      )}
    </div>
  );
}

function pickPrimaryAsset(assets: GithubRelease["assets"]) {
  if (!assets || assets.length === 0) return null;
  const prefer = assets.find((a) => /\.(exe|dmg|AppImage)$/i.test(a.name));
  return prefer ?? assets[0];
}
