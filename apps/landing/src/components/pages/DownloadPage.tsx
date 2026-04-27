import {
  Apple,
  ArrowLeft,
  ArrowUpRight,
  Download,
  Github,
  Laptop,
  MonitorPlay,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";
import {
  formatRelativeDate,
  useGithubReleases,
  type GithubAsset,
  type GithubRelease,
} from "@/lib/useGithubReleases";

type PlatformKey = "windows" | "macos" | "linux";

type PlatformMeta = {
  key: PlatformKey;
  label: string;
  subtitle: string;
  icon: LucideIcon;
  accent: string;
  fallbackHint: string;
};

const PLATFORMS: PlatformMeta[] = [
  {
    key: "windows",
    label: "Windows",
    subtitle: "10 or newer",
    icon: MonitorPlay,
    accent: "from-sky-500/20 to-blue-500/5",
    fallbackHint: ".exe · .msi",
  },
  {
    key: "macos",
    label: "macOS",
    subtitle: "12 Monterey or newer",
    icon: Apple,
    accent: "from-zinc-500/20 to-slate-500/5",
    fallbackHint: ".dmg · Universal",
  },
  {
    key: "linux",
    label: "Linux",
    subtitle: "x86_64",
    icon: Laptop,
    accent: "from-amber-500/20 to-orange-500/5",
    fallbackHint: ".AppImage · .deb",
  },
];

function matchPlatform(name: string): PlatformKey | null {
  const n = name.toLowerCase();
  if (/\.(exe|msi)$/.test(n)) return "windows";
  if (/\.(dmg|pkg)$/.test(n)) return "macos";
  if (/\.(appimage|deb|rpm|snap)$/.test(n)) return "linux";
  if (/linux/.test(n) && /\.tar\.gz$/.test(n)) return "linux";
  return null;
}

function detectUserPlatform(): PlatformKey | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator.platform || "").toLowerCase();
  if (ua.includes("mac") || platform.includes("mac")) return "macos";
  if (ua.includes("win") || platform.includes("win")) return "windows";
  if (ua.includes("linux") || platform.includes("linux")) return "linux";
  return null;
}

function formatSize(bytes: number): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 100) return `${Math.round(mb)} MB`;
  return `${mb.toFixed(1)} MB`;
}

function groupAssets(
  assets: GithubAsset[],
): Record<PlatformKey, GithubAsset[]> {
  const out: Record<PlatformKey, GithubAsset[]> = {
    windows: [],
    macos: [],
    linux: [],
  };
  for (const a of assets ?? []) {
    const key = matchPlatform(a.name);
    if (key) out[key].push(a);
  }
  return out;
}

export function DownloadPage() {
  const { releases, loading, error } = useGithubReleases();
  const latest: GithubRelease | undefined = releases?.[0];
  const [userPlatform, setUserPlatform] = useState<PlatformKey | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setUserPlatform(detectUserPlatform());
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const grouped = useMemo(
    () => (latest ? groupAssets(latest.assets) : null),
    [latest],
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[color:var(--color-background)] pb-24 pt-32 lg:pb-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] [background:radial-gradient(ellipse_60%_60%_at_50%_0%,color-mix(in_oklch,var(--color-primary)_18%,transparent),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 text-[color:var(--color-foreground)] opacity-[0.15] [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_55%_55%_at_50%_30%,black_10%,transparent_75%)]"
      />

      <div className="relative mx-auto w-full max-w-5xl px-6 md:px-10">
        <a
          href="#top"
          className={cn(
            "group inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)]/70 px-3 py-1 text-xs font-semibold text-[color:var(--color-muted-foreground)] shadow-sm backdrop-blur-sm transition-all duration-500 hover:border-[color:var(--color-primary)]/30 hover:text-[color:var(--color-foreground)]",
            mounted ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
          )}
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
          Back to home
        </a>

        <div className="mt-8 flex flex-col items-start gap-4">
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-primary)]/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-primary)] transition-all duration-500",
              mounted ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
            )}
            style={{ transitionDelay: "80ms" }}
          >
            <Sparkles className="h-3 w-3" />
            {latest ? `ADT Studio ${latest.tag_name}` : "Latest release"}
            {latest && (
              <span className="font-mono text-[10px] font-medium normal-case tracking-normal text-[color:var(--color-muted-foreground)]">
                · {formatRelativeDate(latest.published_at)}
              </span>
            )}
          </div>

          <h1
            className={cn(
              "text-balance text-4xl font-bold leading-[1.05] tracking-tight transition-all duration-[700ms] ease-[cubic-bezier(0.22,1,0.36,1)] md:text-5xl lg:text-[56px]",
              mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
            )}
            style={{ transitionDelay: "120ms" }}
          >
            Download ADT Studio
          </h1>
          <p
            className={cn(
              "max-w-2xl text-base leading-relaxed text-[color:var(--color-muted-foreground)] transition-opacity duration-[600ms] md:text-lg",
              mounted ? "opacity-100" : "opacity-0",
            )}
            style={{ transitionDelay: "240ms" }}
          >
            Free, open-source, and runs fully on your machine. Pick your
            platform below — installers are built and signed with every
            release.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLATFORMS.map((p, i) => (
            <PlatformCard
              key={p.key}
              meta={p}
              asset={grouped ? pickPreferred(grouped[p.key]) : null}
              release={latest}
              isRecommended={p.key === userPlatform}
              loading={loading && !latest}
              failed={error && !latest}
              mounted={mounted}
              index={i}
            />
          ))}
        </div>

        <div
          className={cn(
            "mt-10 flex flex-col items-start gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 shadow-sm transition-all duration-[600ms] sm:flex-row sm:items-center sm:justify-between",
            mounted ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
          )}
          style={{ transitionDelay: "620ms" }}
        >
          <div>
            <div className="text-sm font-semibold text-[color:var(--color-foreground)]">
              Looking for an older build or full notes?
            </div>
            <div className="mt-0.5 text-sm text-[color:var(--color-muted-foreground)]">
              Every release is published on GitHub with changelog and
              checksums.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              href="https://github.com/unicef/adt-studio/releases"
              target="_blank"
              rel="noreferrer noopener"
              variant="secondary"
              size="md"
            >
              All releases
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button
              href="https://github.com/unicef/adt-studio"
              target="_blank"
              rel="noreferrer noopener"
              variant="ghost"
              size="md"
            >
              <Github className="h-4 w-4" />
              Source code
            </Button>
          </div>
        </div>

        <div
          className={cn(
            "mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[color:var(--color-muted-foreground)] transition-opacity duration-500",
            mounted ? "opacity-100" : "opacity-0",
          )}
          style={{ transitionDelay: "760ms" }}
        >
          <span className="font-mono">MIT licensed</span>
          <span className="h-1 w-1 rounded-full bg-[color:var(--color-border)]" />
          <span className="font-mono">Runs locally</span>
          <span className="h-1 w-1 rounded-full bg-[color:var(--color-border)]" />
          <span className="font-mono">No account needed</span>
        </div>
      </div>
    </div>
  );
}

function pickPreferred(assets: GithubAsset[]): GithubAsset | null {
  if (!assets || assets.length === 0) return null;
  const priority = [/\.exe$/i, /\.dmg$/i, /\.AppImage$/i, /\.msi$/i, /\.deb$/i];
  for (const re of priority) {
    const hit = assets.find((a) => re.test(a.name));
    if (hit) return hit;
  }
  return assets[0];
}

function PlatformCard({
  meta,
  asset,
  release,
  isRecommended,
  loading,
  failed,
  mounted,
  index,
}: {
  meta: PlatformMeta;
  asset: GithubAsset | null;
  release: GithubRelease | undefined;
  isRecommended: boolean;
  loading: boolean;
  failed: boolean;
  mounted: boolean;
  index: number;
}) {
  const Icon = meta.icon;
  const fallbackHref = release?.html_url
    ?? "https://github.com/unicef/adt-studio/releases/latest";
  const href = asset?.browser_download_url ?? fallbackHref;
  const isExternal = !asset;

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-[color:var(--color-card)] p-6 transition-all duration-[700ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,0.18)]",
        isRecommended
          ? "border-[color:var(--color-primary)]/40 shadow-[0_12px_40px_-20px_color-mix(in_oklch,var(--color-primary)_55%,transparent)]"
          : "border-[color:var(--color-border)] hover:border-[color:var(--color-primary)]/30",
        mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
      )}
      style={{ transitionDelay: `${320 + index * 120}ms` }}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b opacity-60 transition-opacity duration-500 group-hover:opacity-100",
          meta.accent,
        )}
      />

      <div className="relative flex items-start justify-between">
        <span className="grid h-11 w-11 place-items-center rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-background)] text-[color:var(--color-foreground)]">
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </span>
        {isRecommended && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-primary)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-primary)]">
            <Sparkles className="h-3 w-3" />
            Your system
          </span>
        )}
      </div>

      <div className="relative mt-4">
        <h3 className="text-lg font-semibold tracking-tight text-[color:var(--color-foreground)]">
          {meta.label}
        </h3>
        <div className="mt-0.5 text-xs text-[color:var(--color-muted-foreground)]">
          {meta.subtitle}
        </div>
      </div>

      <div className="relative mt-5 flex flex-1 flex-col justify-end gap-3">
        <div className="min-h-[32px]">
          {loading ? (
            <div className="flex flex-col gap-1.5">
              <span className="block h-2.5 w-4/5 rounded bg-[color:var(--color-muted)]" />
              <span className="block h-2 w-2/5 rounded bg-[color:var(--color-muted)]" />
            </div>
          ) : asset ? (
            <div className="font-mono text-[11px] text-[color:var(--color-muted-foreground)]">
              <div className="truncate text-[color:var(--color-foreground)]">
                {asset.name}
              </div>
              <div className="mt-0.5">
                {formatSize(asset.size)}
                {release?.tag_name ? ` · ${release.tag_name}` : ""}
              </div>
            </div>
          ) : (
            <div className="text-xs text-[color:var(--color-muted-foreground)]">
              {failed
                ? "Couldn't reach GitHub — try the release page."
                : `No prebuilt installer yet (${meta.fallbackHint}). See all releases on GitHub.`}
            </div>
          )}
        </div>

        <Button
          href={href}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noreferrer noopener" : undefined}
          variant={isRecommended ? "primary" : "secondary"}
          size="md"
          className="w-full"
        >
          {isExternal ? (
            <>
              View release
              <ArrowUpRight className="h-4 w-4" />
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Download
            </>
          )}
        </Button>
      </div>
    </article>
  );
}
