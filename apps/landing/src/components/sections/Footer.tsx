import { Github } from "lucide-react";

type LinkCol = {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
};

const COLUMNS: LinkCol[] = [
  {
    title: "Product",
    links: [
      {
        label: "Download",
        href: "https://github.com/unicef/adt-studio/releases/latest",
        external: true,
      },
      { label: "What it does", href: "#pitch" },
      { label: "How it works", href: "#carousel" },
      { label: "Get started", href: "#finale" },
    ],
  },
  {
    title: "Project",
    links: [
      {
        label: "GitHub",
        href: "https://github.com/unicef/adt-studio",
        external: true,
      },
      {
        label: "Issues",
        href: "https://github.com/unicef/adt-studio/issues",
        external: true,
      },
      {
        label: "Releases",
        href: "https://github.com/unicef/adt-studio/releases",
        external: true,
      },
    ],
  },
  {
    title: "Docs",
    links: [
      {
        label: "Guidelines",
        href: "https://github.com/unicef/adt-studio/blob/main/docs/GUIDELINES.md",
        external: true,
      },
      {
        label: "Architecture",
        href: "https://github.com/unicef/adt-studio/blob/main/docs/DECISIONS.md",
        external: true,
      },
      { label: "License", href: "https://opensource.org/licenses/MIT", external: true },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-[color:var(--color-border)] bg-[color:var(--color-muted)]/40">
      <div className="mx-auto w-full max-w-6xl px-6 pb-10 pt-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-4">
            <a href="#top" className="flex items-center gap-2.5">
              <img
                src="/favicon.svg"
                alt=""
                width={28}
                height={28}
                className="rounded-md"
              />
              <span className="text-[15px] font-bold tracking-tight">
                ADT Studio
              </span>
            </a>
            <p className="max-w-xs text-sm leading-relaxed text-[color:var(--color-muted-foreground)]">
              Open-source desktop pipeline for turning PDFs into accessible
              books — built with UNICEF.
            </p>
            <a
              href="https://github.com/unicef/adt-studio"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex w-fit items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-3 py-2 text-xs font-semibold text-[color:var(--color-foreground)] transition-colors hover:bg-[color:var(--color-accent)]"
            >
              <Github className="h-3.5 w-3.5" />
              Star on GitHub
            </a>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title} className="flex flex-col gap-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--color-foreground)]">
                {col.title}
              </div>
              <ul className="flex flex-col gap-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      target={l.external ? "_blank" : undefined}
                      rel={l.external ? "noreferrer noopener" : undefined}
                      className="text-sm text-[color:var(--color-muted-foreground)] transition-colors hover:text-[color:var(--color-foreground)]"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-[color:var(--color-border)] pt-6 text-xs text-[color:var(--color-muted-foreground)] sm:flex-row sm:items-center">
          <div>
            &copy; {new Date().getFullYear()} ADT Studio — MIT licensed.
          </div>
          <div className="flex items-center gap-2 font-mono">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            All systems operational
          </div>
        </div>
      </div>
    </footer>
  );
}
