import {
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  Download,
  FileDown,
  Github,
  Package,
  Tag,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";
import {
  formatAbsoluteDate,
  formatRelativeDate,
  useGithubRelease,
  type GithubAsset,
} from "@/lib/useGithubReleases";

export function ReleasePage({ tag }: { tag: string }) {
  const { release, loading, error } = useGithubRelease(tag);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const title = release?.name?.trim() || release?.tag_name || tag;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[color:var(--color-background)] pb-24 pt-32 lg:pb-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] [background:radial-gradient(ellipse_55%_55%_at_50%_0%,color-mix(in_oklch,var(--color-primary)_14%,transparent),transparent_70%)]"
      />

      <div className="relative mx-auto w-full max-w-3xl px-6 md:px-8">
        <div
          className={cn(
            "flex items-center gap-2 transition-all duration-500",
            mounted ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
          )}
        >
          <a
            href="#releases"
            className="group inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)]/70 px-3 py-1 text-xs font-semibold text-[color:var(--color-muted-foreground)] shadow-sm backdrop-blur-sm transition-all hover:border-[color:var(--color-primary)]/30 hover:text-[color:var(--color-foreground)]"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
            All releases
          </a>
        </div>

        <header className="mt-8 flex flex-col gap-4">
          <div
            className={cn(
              "flex flex-wrap items-center gap-2 transition-all duration-500",
              mounted ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
            )}
            style={{ transitionDelay: "80ms" }}
          >
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--color-primary)]/10 px-2 py-0.5 font-mono text-[11px] font-bold text-[color:var(--color-primary)]">
              <Tag className="h-3 w-3" />
              {tag}
            </span>
            {release?.prerelease && (
              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Beta
              </span>
            )}
            {release && (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[color:var(--color-muted-foreground)]">
                <Calendar className="h-3 w-3" />
                {formatAbsoluteDate(release.published_at)}
                <span className="opacity-60">
                  · {formatRelativeDate(release.published_at)}
                </span>
              </span>
            )}
          </div>

          <h1
            className={cn(
              "text-balance text-3xl font-bold leading-[1.1] tracking-tight transition-all duration-[700ms] ease-[cubic-bezier(0.22,1,0.36,1)] md:text-[44px]",
              mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
            )}
            style={{ transitionDelay: "140ms" }}
          >
            {title}
          </h1>
        </header>

        <div className="mt-10 flex flex-col gap-10">
          {loading && !release ? (
            <BodySkeleton />
          ) : error && !release ? (
            <ErrorCard tag={tag} />
          ) : release ? (
            <>
              <AssetList assets={release.assets} mounted={mounted} />
              <ReleaseBody body={release.body} mounted={mounted} />
              <div
                className={cn(
                  "flex flex-wrap items-center gap-2 border-t border-[color:var(--color-border)] pt-6 transition-opacity duration-500",
                  mounted ? "opacity-100" : "opacity-0",
                )}
                style={{ transitionDelay: "400ms" }}
              >
                <Button
                  href={release.html_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  variant="secondary"
                  size="md"
                >
                  <Github className="h-4 w-4" />
                  View on GitHub
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
                <Button href="#/download" variant="ghost" size="md">
                  <FileDown className="h-4 w-4" />
                  Platform downloads
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 100) return `${Math.round(mb)} MB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${Math.round(kb)} KB`;
}

function AssetList({
  assets,
  mounted,
}: {
  assets: GithubAsset[];
  mounted: boolean;
}) {
  if (!assets || assets.length === 0) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-muted)]/30 p-5 text-sm text-[color:var(--color-muted-foreground)] transition-opacity duration-500",
          mounted ? "opacity-100" : "opacity-0",
        )}
        style={{ transitionDelay: "200ms" }}
      >
        No prebuilt assets for this release.
      </div>
    );
  }
  return (
    <section
      aria-label="Release assets"
      className={cn(
        "rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5 shadow-sm transition-all duration-[600ms]",
        mounted ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      )}
      style={{ transitionDelay: "200ms" }}
    >
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-muted-foreground)]">
        <Package className="h-3.5 w-3.5" />
        Downloads
      </div>
      <ul className="mt-3 flex flex-col divide-y divide-[color:var(--color-border)]">
        {assets.map((a) => (
          <li
            key={a.name}
            className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <div className="truncate font-mono text-[12px] text-[color:var(--color-foreground)]">
                {a.name}
              </div>
              <div className="mt-0.5 text-[11px] text-[color:var(--color-muted-foreground)]">
                {formatSize(a.size)}
                {typeof a.download_count === "number"
                  ? ` · ${a.download_count.toLocaleString()} downloads`
                  : ""}
              </div>
            </div>
            <a
              href={a.browser_download_url}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-background)] px-3 py-1.5 text-xs font-semibold text-[color:var(--color-foreground)] transition-all hover:-translate-y-0.5 hover:border-[color:var(--color-primary)]/40 hover:shadow-sm"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReleaseBody({
  body,
  mounted,
}: {
  body: string | null | undefined;
  mounted: boolean;
}) {
  return (
    <section
      aria-label="Release notes"
      className={cn(
        "transition-all duration-[600ms]",
        mounted ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      )}
      style={{ transitionDelay: "300ms" }}
    >
      {body && body.trim() ? (
        <Markdown source={body} />
      ) : (
        <p className="text-sm text-[color:var(--color-muted-foreground)]">
          No release notes were provided for this version.
        </p>
      )}
    </section>
  );
}

function BodySkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5">
        <div className="h-3 w-24 rounded bg-[color:var(--color-muted)]" />
        <div className="mt-3 flex flex-col gap-2">
          <div className="h-3 w-full rounded bg-[color:var(--color-muted)]" />
          <div className="h-3 w-11/12 rounded bg-[color:var(--color-muted)]" />
          <div className="h-3 w-3/4 rounded bg-[color:var(--color-muted)]" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="h-3 w-5/6 rounded bg-[color:var(--color-muted)]" />
        <div className="h-3 w-4/5 rounded bg-[color:var(--color-muted)]" />
        <div className="h-3 w-2/3 rounded bg-[color:var(--color-muted)]" />
      </div>
    </div>
  );
}

function ErrorCard({ tag }: { tag: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 text-sm text-[color:var(--color-muted-foreground)]">
      <div className="text-base font-semibold text-[color:var(--color-foreground)]">
        Couldn't load this release
      </div>
      <p className="mt-1">
        We couldn't reach GitHub to fetch{" "}
        <span className="font-mono">{tag}</span>. The release page on GitHub
        has the full changelog and assets.
      </p>
      <div className="mt-4">
        <Button
          href={`https://github.com/unicef/adt-studio/releases/tag/${encodeURIComponent(tag)}`}
          target="_blank"
          rel="noreferrer noopener"
          variant="secondary"
          size="md"
        >
          <Github className="h-4 w-4" />
          Open on GitHub
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// --- Tiny markdown renderer (headings, lists, paragraphs, inline bold/code/link) ---

type Block =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "para"; text: string };

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paraBuf: string[] = [];
  let listBuf: string[] = [];

  const flushPara = () => {
    if (paraBuf.length > 0) {
      blocks.push({ kind: "para", text: paraBuf.join(" ").trim() });
      paraBuf = [];
    }
  };
  const flushList = () => {
    if (listBuf.length > 0) {
      blocks.push({ kind: "list", items: listBuf.slice() });
      listBuf = [];
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/g, "");
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    const h3 = /^###\s+(.*)$/.exec(line);
    if (h3) {
      flushPara();
      flushList();
      blocks.push({ kind: "heading", level: 3, text: h3[1] });
      continue;
    }
    const h2 = /^##\s+(.*)$/.exec(line);
    if (h2) {
      flushPara();
      flushList();
      blocks.push({ kind: "heading", level: 2, text: h2[1] });
      continue;
    }
    const h1 = /^#\s+(.*)$/.exec(line);
    if (h1) {
      flushPara();
      flushList();
      blocks.push({ kind: "heading", level: 2, text: h1[1] });
      continue;
    }
    const li = /^\s*[-*]\s+(.*)$/.exec(line);
    if (li) {
      flushPara();
      listBuf.push(li[1]);
      continue;
    }
    flushList();
    paraBuf.push(line.trim());
  }
  flushPara();
  flushList();
  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex =
    /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))|(https?:\/\/[^\s)]+)|(@([A-Za-z0-9-]+))|((?:^|(?<=\s))#(\d+))/g;
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const start = match.index;
    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }
    if (match[1]) {
      nodes.push(
        <strong key={`b-${key++}`} className="font-semibold">
          {match[2]}
        </strong>,
      );
    } else if (match[3]) {
      nodes.push(
        <code
          key={`c-${key++}`}
          className="rounded bg-[color:var(--color-muted)] px-1 py-0.5 font-mono text-[0.85em] text-[color:var(--color-foreground)]"
        >
          {match[4]}
        </code>,
      );
    } else if (match[5]) {
      nodes.push(
        <a
          key={`l-${key++}`}
          href={match[7]}
          target="_blank"
          rel="noreferrer noopener"
          className="font-medium text-[color:var(--color-primary)] underline-offset-2 hover:underline"
        >
          {match[6]}
        </a>,
      );
    } else if (match[8]) {
      nodes.push(
        <a
          key={`u-${key++}`}
          href={match[8]}
          target="_blank"
          rel="noreferrer noopener"
          className="font-medium text-[color:var(--color-primary)] underline-offset-2 hover:underline break-all"
        >
          {match[8]}
        </a>,
      );
    } else if (match[9]) {
      nodes.push(
        <a
          key={`m-${key++}`}
          href={`https://github.com/${match[10]}`}
          target="_blank"
          rel="noreferrer noopener"
          className="font-medium text-[color:var(--color-primary)] hover:underline"
        >
          @{match[10]}
        </a>,
      );
    } else if (match[11]) {
      nodes.push(
        <a
          key={`i-${key++}`}
          href={`https://github.com/unicef/adt-studio/issues/${match[12]}`}
          target="_blank"
          rel="noreferrer noopener"
          className="font-medium text-[color:var(--color-primary)] hover:underline"
        >
          #{match[12]}
        </a>,
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function Markdown({ source }: { source: string }) {
  const cleaned = source
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const blocks = parseBlocks(cleaned);
  return (
    <div className="flex flex-col gap-5 text-[15px] leading-relaxed text-[color:var(--color-foreground)]">
      {blocks.map((b, i) => {
        if (b.kind === "heading") {
          if (b.level === 2) {
            return (
              <h2
                key={i}
                className="mt-2 text-xl font-semibold tracking-tight"
              >
                {renderInline(b.text)}
              </h2>
            );
          }
          return (
            <h3
              key={i}
              className="mt-1 text-base font-semibold tracking-tight text-[color:var(--color-foreground)]"
            >
              {renderInline(b.text)}
            </h3>
          );
        }
        if (b.kind === "list") {
          return (
            <ul
              key={i}
              className="ml-5 flex list-disc flex-col gap-1.5 text-[color:var(--color-foreground)] marker:text-[color:var(--color-muted-foreground)]"
            >
              {b.items.map((item, j) => (
                <li key={j} className="leading-relaxed">
                  {renderInline(item)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p
            key={i}
            className="text-[color:var(--color-foreground)]/90"
          >
            {renderInline(b.text)}
          </p>
        );
      })}
    </div>
  );
}
