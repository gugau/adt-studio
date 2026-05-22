import type { ReactNode } from "react"

interface SectionProps {
  title: ReactNode
  /** Optional trailing-slot actions (add-field, copy styles, more menu). */
  actions?: ReactNode
  children: ReactNode
}

export function Section({ title, actions, children }: SectionProps) {
  return (
    <section className="border-b last:border-b-0 py-2">
      <header className="flex items-stretch">
        <div className="flex flex-1 items-center text-left h-8 text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
          {title}
        </div>
        {actions ? (
          <div className="flex items-center pl-2">{actions}</div>
        ) : null}
      </header>
      <div className="space-y-3 pt-1 pb-2">{children}</div>
    </section>
  )
}
