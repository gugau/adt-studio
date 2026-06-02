import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Banner color tones. Activities use `violet` to match the purple sectioning /
 * section-preview chrome; quizzes use `orange` to match the quiz theme.
 */
const TONE_CLASSES = {
  orange: { disc: "bg-orange-500", title: "text-orange-600" },
  violet: { disc: "bg-violet-500", title: "text-violet-600" },
} as const

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
  tone = "orange",
}: {
  icon: ReactNode
  title: ReactNode
  subtitle: ReactNode
  action?: ReactNode
  className?: string
  tone?: keyof typeof TONE_CLASSES
}) {
  const toneClasses = TONE_CLASSES[tone]
  return (
    <div className={cn("mb-4 pb-3 border-b", className)}>
      <div className="flex items-center gap-3">
        <div className={cn("flex items-center justify-center w-9 h-9 rounded-full text-white shrink-0 shadow-sm", toneClasses.disc)}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn("text-sm font-semibold leading-tight", toneClasses.title)}>{title}</div>
          <div className="text-xs text-muted-foreground leading-snug mt-0.5">{subtitle}</div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  )
}
