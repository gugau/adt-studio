import { ArrowRight, ArrowUpRight, Sparkles, Tag } from "lucide-react";
import { SectionEyebrow } from "@/components/SectionEyebrow";
import { cn } from "@/lib/cn";
import {
  firstImageFromBody,
  firstParagraphFromBody,
  sectionTone,
  summarizeSections,
  type SectionTone,
} from "@/lib/releaseSummary";
import {
  formatRelativeDate,
  useStableReleases,
  type GithubRelease,
} from "@/lib/useGithubReleases";
import { useInView } from "@/lib/useScrollProgress";

export function ChangelogDeckScene() {
  const { releases, loading } = useStableReleases();
  const { ref, inView: mounted } = useInView<HTMLDivElement>({ threshold: 0.2 });
  const items = (releases ?? []).slice(0, 3);
  const front = items[0];
  const behind = items.slice(1, 3);

  return (
    <section
      id="changelog-deck"
      className="snap-section relative flex min-h-screen items-center border-y border-[color:var(--color-border)] bg-[color:var(--color-muted)]/30 py-24 lg:py-32"
    >
      <div ref={ref} className="mx-auto w-full max-w-5xl px-6 md:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow label="Changelog" />
          <h2
            className={cn(
              "mt-5 text-balance text-4xl font-semibold leading-[1.08] tracking-tight md:text-5xl",
              "transition-all duration-[700ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
              mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
            )}
            style={{ transitionDelay: "80ms" }}
          >
            A stack of{" "}
            <span className="text-[color:var(--color-primary)]">shipped</span>
            {" "}work.
          </h2>
          <p
            className={cn(
              "mx-auto mt-4 max-w-xl text-base leading-relaxed text-[color:var(--color-muted-foreground)] md:text-lg",
              "transition-opacity duration-[600ms]",
              mounted ? "opacity-100" : "opacity-0",
            )}
            style={{ transitionDelay: "220ms" }}
          >
            Every version is documented — what changed, what's still cooking,
            and the screenshots to back it up.
          </p>
        </div>

        <div
          className={cn(
            "group relative mx-auto mt-16 flex h-[460px] max-w-2xl items-center justify-center md:h-[480px]",
            "transition-all duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
            mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
          )}
          style={{ transitionDelay: "320ms" }}
        >
          {loading || !front ? (
            <DeckSkeleton />
          ) : (
            <>
              {behind[1] && <BehindCard release={behind[1]} placement="left" />}
              {behind[0] && <BehindCard release={behind[0]} placement="right" />}
              <FrontCard release={front} />
            </>
          )}
        </div>

        <div
          className={cn(
            "mt-12 flex flex-col items-center gap-3 transition-opacity duration-500",
            mounted ? "opacity-100" : "opacity-0",
          )}
          style={{ transitionDelay: "640ms" }}
        >
          <a
            href="#/releases"
            className="group/cta relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-[color:var(--color-primary)] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_color-mix(in_oklch,var(--color-primary)_60%,transparent)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_-16px_color-mix(in_oklch,var(--color-primary)_70%,transparent)]"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-0 [background:radial-gradient(60%_120%_at_50%_120%,rgba(255,255,255,0.25),transparent)]"
            />
            <Sparkles className="h-4 w-4" />
            Read the full changelog
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
          </a>
          <a
            href="https://github.com/unicef/adt-studio/releases"
            target="_blank"
            rel="noreferrer noopener"
            className="group/gh inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-[color:var(--color-muted-foreground)] transition-colors hover:text-[color:var(--color-foreground)]"
          >
            Or jump to the raw notes on GitHub
            <ArrowUpRight className="h-3 w-3 transition-transform duration-200 group-hover/gh:translate-x-0.5 group-hover/gh:-translate-y-0.5" />
          </a>
        </div>
      </div>
    </section>
  );
}

function FrontCard({ release }: { release: GithubRelease }) {
  const title = release.name?.trim() || release.tag_name;
  const cover = firstImageFromBody(release.body);
  const excerpt = firstParagraphFromBody(release.body, 160);
  const sections = summarizeSections(release.body).slice(0, 3);
  const detailHref = `#/releases/${encodeURIComponent(release.tag_name)}`;

  return (
    <a
      href={detailHref}
      aria-label={`Open the changelog at ${release.tag_name}`}
      className={cn(
        "absolute left-1/2 top-1/2 z-30 flex w-[88%] max-w-[440px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] shadow-[0_24px_60px_-26px_rgba(0,0,0,0.22)]",
        "transition-all duration-[700ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        "group-hover:-translate-y-[58%] group-hover:scale-[1.02]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)]",
      )}
    >
      <CoverArea image={cover} tag={release.tag_name} />
      <div className="flex flex-col gap-2.5 p-5">
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-[color:var(--color-muted-foreground)]">
          <span className="inline-flex items-center gap-1 rounded-md bg-[color:var(--color-primary)]/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[color:var(--color-primary)]">
            <Tag className="h-2.5 w-2.5" />
            {release.tag_name}
          </span>
          <span aria-hidden className="opacity-50">·</span>
          <span>{formatRelativeDate(release.published_at)}</span>
          <span className="ml-auto rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            Latest
          </span>
        </div>
        <h3 className="line-clamp-2 text-[17px] font-semibold leading-snug tracking-tight text-[color:var(--color-foreground)]">
          {title}
        </h3>
        {excerpt && (
          <p className="line-clamp-2 text-sm leading-relaxed text-[color:var(--color-muted-foreground)]">
            {excerpt}
          </p>
        )}
        {sections.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {sections.map((s) => (
              <DeckChip
                key={s.title}
                label={s.title}
                count={s.count}
                tone={sectionTone(s.title)}
              />
            ))}
          </div>
        )}
      </div>
    </a>
  );
}

function BehindCard({
  release,
  placement,
}: {
  release: GithubRelease;
  placement: "left" | "right";
}) {
  const title = release.name?.trim() || release.tag_name;
  const cover = firstImageFromBody(release.body);
  const sections = summarizeSections(release.body).slice(0, 2);
  const isLeft = placement === "left";

  return (
    <div
      aria-hidden
      className={cn(
        "absolute top-1/2 z-10 flex w-[82%] max-w-[420px] flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] shadow-[0_18px_40px_-22px_rgba(0,0,0,0.18)]",
        "transition-all duration-[700ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        "left-1/2",
        isLeft
          ? "-translate-x-[64%] -translate-y-1/2 -rotate-[8deg] group-hover:-translate-x-[92%] group-hover:-translate-y-[44%] group-hover:-rotate-[13deg]"
          : "-translate-x-[36%] -translate-y-1/2 rotate-[8deg] group-hover:-translate-x-[8%] group-hover:-translate-y-[44%] group-hover:rotate-[13deg]",
        "scale-[0.94] group-hover:scale-[0.97]",
      )}
    >
      <BehindCover image={cover} tag={release.tag_name} />
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
          <span className="inline-flex items-center gap-1 rounded-md bg-[color:var(--color-primary)]/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[color:var(--color-primary)]">
            <Tag className="h-2.5 w-2.5" />
            {release.tag_name}
          </span>
          <span aria-hidden className="opacity-50">·</span>
          <span>{formatRelativeDate(release.published_at)}</span>
        </div>
        <h4 className="line-clamp-1 text-[13px] font-semibold leading-snug tracking-tight text-[color:var(--color-foreground)]/85">
          {title}
        </h4>
        {sections.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {sections.map((s) => (
              <DeckChip
                key={s.title}
                label={s.title}
                count={s.count}
                tone={sectionTone(s.title)}
                compact
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CoverArea({
  image,
  tag,
}: {
  image: string | null;
  tag: string;
}) {
  if (image) {
    return (
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[color:var(--color-muted)]/40">
        <img
          src={image}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent"
        />
      </div>
    );
  }
  return (
    <div aria-hidden className="relative aspect-[16/9] w-full overflow-hidden">
      <div className="absolute inset-0 [background:radial-gradient(120%_120%_at_30%_20%,color-mix(in_oklch,var(--color-primary)_22%,transparent),transparent_60%),radial-gradient(120%_120%_at_80%_80%,color-mix(in_oklch,#a855f7_18%,transparent),transparent_65%),linear-gradient(180deg,color-mix(in_oklch,var(--color-muted)_70%,transparent),color-mix(in_oklch,var(--color-card)_100%,transparent))]" />
      <div className="absolute inset-0 text-[color:var(--color-foreground)] opacity-[0.07] [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:14px_14px]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono text-2xl font-bold tracking-tight text-[color:var(--color-foreground)]/40">
          {tag}
        </span>
      </div>
    </div>
  );
}

function BehindCover({
  image,
  tag,
}: {
  image: string | null;
  tag: string;
}) {
  if (image) {
    return (
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[color:var(--color-muted)]/50">
        <img
          src={image}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover opacity-90"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[color:var(--color-card)]/30"
        />
      </div>
    );
  }
  return (
    <div
      aria-hidden
      className="relative aspect-[16/9] w-full overflow-hidden"
    >
      <div className="absolute inset-0 [background:radial-gradient(120%_120%_at_30%_20%,color-mix(in_oklch,var(--color-primary)_18%,transparent),transparent_60%),linear-gradient(180deg,color-mix(in_oklch,var(--color-muted)_70%,transparent),color-mix(in_oklch,var(--color-card)_100%,transparent))]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono text-xl font-bold tracking-tight text-[color:var(--color-foreground)]/35">
          {tag}
        </span>
      </div>
    </div>
  );
}

function DeckChip({
  label,
  count,
  tone,
  compact = false,
}: {
  label: string;
  count: number;
  tone: SectionTone;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold",
        compact ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-[11px]",
        toneStyles[tone],
      )}
    >
      <span className="truncate">{label}</span>
      {count > 0 && (
        <span className="rounded-full bg-white/60 px-1 font-mono text-[9px] font-bold tabular-nums">
          {count}
        </span>
      )}
    </span>
  );
}

const toneStyles: Record<SectionTone, string> = {
  added: "border-emerald-200 bg-emerald-50 text-emerald-800",
  fixed: "border-blue-200 bg-blue-50 text-blue-800",
  perf: "border-violet-200 bg-violet-50 text-violet-800",
  changed: "border-amber-200 bg-amber-50 text-amber-800",
  breaking: "border-rose-200 bg-rose-50 text-rose-800",
  security: "border-red-200 bg-red-50 text-red-800",
  docs: "border-slate-200 bg-slate-50 text-slate-700",
  neutral:
    "border-[color:var(--color-border)] bg-[color:var(--color-muted)]/60 text-[color:var(--color-muted-foreground)]",
};

function DeckSkeleton() {
  return (
    <>
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 z-10 flex w-[82%] max-w-[420px] -translate-x-[64%] -translate-y-1/2 -rotate-[8deg] flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] shadow-[0_18px_40px_-22px_rgba(0,0,0,0.18)]"
      >
        <div className="aspect-[16/9] w-full bg-[color:var(--color-muted)]/60" />
        <div className="flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-12 rounded bg-[color:var(--color-muted)]" />
            <span className="h-3 w-16 rounded bg-[color:var(--color-muted)]" />
          </div>
          <span className="h-3 w-3/4 rounded bg-[color:var(--color-muted)]" />
        </div>
      </div>
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 z-10 flex w-[82%] max-w-[420px] -translate-x-[36%] -translate-y-1/2 rotate-[8deg] flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] shadow-[0_18px_40px_-22px_rgba(0,0,0,0.18)]"
      >
        <div className="aspect-[16/9] w-full bg-[color:var(--color-muted)]/60" />
        <div className="flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-12 rounded bg-[color:var(--color-muted)]" />
            <span className="h-3 w-16 rounded bg-[color:var(--color-muted)]" />
          </div>
          <span className="h-3 w-3/4 rounded bg-[color:var(--color-muted)]" />
        </div>
      </div>
      <div
        aria-busy
        className="absolute left-1/2 top-1/2 z-30 flex w-[88%] max-w-[440px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] shadow-[0_24px_60px_-26px_rgba(0,0,0,0.22)]"
      >
        <div className="aspect-[16/9] w-full bg-[color:var(--color-muted)]/60" />
        <div className="flex flex-col gap-2.5 p-5">
          <div className="flex items-center gap-2">
            <span className="h-3 w-14 rounded bg-[color:var(--color-muted)]" />
            <span className="h-3 w-20 rounded bg-[color:var(--color-muted)]" />
          </div>
          <span className="h-4 w-4/5 rounded bg-[color:var(--color-muted)]" />
          <div className="flex flex-col gap-1.5">
            <span className="h-3 w-[94%] rounded bg-[color:var(--color-muted)]" />
            <span className="h-3 w-[80%] rounded bg-[color:var(--color-muted)]" />
          </div>
          <div className="mt-1 flex gap-1.5">
            <span className="h-4 w-14 rounded-full bg-[color:var(--color-muted)]" />
            <span className="h-4 w-14 rounded-full bg-[color:var(--color-muted)]" />
          </div>
        </div>
      </div>
    </>
  );
}
