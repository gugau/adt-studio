import { Apple, Github, Laptop, Lock, MonitorPlay, ShieldCheck } from "lucide-react";

const ITEMS = [
  { Icon: ShieldCheck, label: "MIT licensed" },
  { Icon: Lock, label: "Runs locally" },
  { Icon: Github, label: "Open source" },
  { Icon: Apple, label: "macOS" },
  { Icon: MonitorPlay, label: "Windows" },
  { Icon: Laptop, label: "Linux" },
];

export function TrustStrip() {
  return (
    <section
      aria-label="Trust"
      className="relative border-y border-[color:var(--color-border)] bg-[color:var(--color-muted)]/40"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 py-5">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-muted-foreground)]">
          Built with UNICEF
        </span>
        <span aria-hidden className="hidden h-3 w-px bg-[color:var(--color-border)] sm:block" />
        {ITEMS.map(({ Icon, label }) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--color-muted-foreground)]"
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}
