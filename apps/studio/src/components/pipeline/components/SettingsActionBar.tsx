import { ReactNode, createContext, useContext, ComponentProps } from "react"
import { useParams } from "@tanstack/react-router"
import { Trans } from "@lingui/react/macro"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { STAGES } from "@/components/pipeline/stage-config"
import { resolveSettingsStageSlug } from "@/components/pipeline/settings-routing"

type Stage = (typeof STAGES)[number]

const SettingsStageContext = createContext<Stage | null>(null)

function useSettingsStage(): Stage | null {
  const params = useParams({ strict: false }) as { step?: string }
  if (!params.step) return null
  const slug = resolveSettingsStageSlug(params.step)
  if (!slug) return null
  return STAGES.find((s) => s.slug === slug) ?? null
}

export function SettingsActionBar({
  dirty,
  children,
  cleanMessage,
  dirtyMessage,
}: {
  dirty: boolean
  children: ReactNode
  cleanMessage?: ReactNode
  dirtyMessage?: ReactNode
}) {
  const stage = useSettingsStage()
  const bgClass = stage?.bgLight ?? "bg-muted/30"
  const borderColorClass = dirty
    ? (stage?.borderDark ?? "border-foreground/30")
    : (stage?.borderColor ?? "border-border")
  const textColorClass = dirty
    ? cn("font-medium", stage?.textColor ?? "text-foreground")
    : "text-muted-foreground"
  return (
    <SettingsStageContext.Provider value={stage}>
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-2 transition-colors",
          bgClass,
          borderColorClass,
          dirty ? "border-b-2" : "border-b",
        )}
      >
        <span className={cn("text-xs", textColorClass)}>
          {dirty
            ? (dirtyMessage ?? <Trans>Unsaved changes — rerun to apply</Trans>)
            : (cleanMessage ?? <Trans>No unsaved changes</Trans>)}
        </span>
        <div className="shrink-0">{children}</div>
      </div>
    </SettingsStageContext.Provider>
  )
}

type SettingsActionButtonProps = ComponentProps<typeof Button> & { dirty: boolean }

export function SettingsActionButton({
  dirty,
  className,
  children,
  ...buttonProps
}: SettingsActionButtonProps) {
  const stage = useContext(SettingsStageContext)
  if (dirty && stage) {
    return (
      <Button
        size="sm"
        className={cn(
          "h-8 px-3 text-xs font-medium text-white shadow-md border-transparent transition-colors",
          stage.color,
          stage.colorHover,
          className,
        )}
        {...buttonProps}
      >
        {children}
      </Button>
    )
  }
  return (
    <Button
      size="sm"
      variant={dirty ? "default" : "outline"}
      className={cn("h-8 px-3 text-xs font-medium", className)}
      {...buttonProps}
    >
      {children}
    </Button>
  )
}
