import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Banner shown at the top of the storyboard content area to flag a generated
 * page as an interactive Activity or a Quiz — distinguishing it from a plain
 * narrative page. Icon sits in a colored disc, with a bold colored title and
 * a muted subtitle, above a divider.
 */
export function StorySectionBanner({
  icon,
  title,
  subtitle,
  action,
  className,
}: {
  icon: ReactNode
  title: ReactNode
  subtitle: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("mb-4 pb-3 border-b", className)}>
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-orange-500 text-white shrink-0 shadow-sm">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-tight text-orange-600">{title}</div>
          <div className="text-xs text-muted-foreground leading-snug mt-0.5">{subtitle}</div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  )
}
