import { cn } from "@/shared/lib/utils"

interface SettingsSectionProps {
  title: string
  description?: string
  className?: string
  children: React.ReactNode
}

/**
 * Grouping wrapper for related settings controls. Replaces the flat,
 * border-separated row list with subtle section headers so users can scan
 * the panel by category (Reading, Toolbar, Behavior, etc.).
 */
export function SettingsSection({
  title,
  description,
  className,
  children,
}: SettingsSectionProps) {
  return (
    <section className={cn("flex flex-col gap-1 py-4", className)}>
      <header className="flex flex-col gap-0.5 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {description ? (
          <p className="text-xs text-muted-foreground/80">{description}</p>
        ) : null}
      </header>
      <div className="flex flex-col rounded-xl border border-border bg-card  px-3">
        {children}
      </div>
    </section>
  )
}
