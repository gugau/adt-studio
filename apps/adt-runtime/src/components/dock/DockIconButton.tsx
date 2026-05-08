import { cn } from "@/lib/utils"

export interface DockIconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  ariaLabel: string
  pressed?: boolean
  size?: "sm" | "default"
}

export function DockIconButton({
  ariaLabel,
  pressed,
  size = "default",
  className,
  children,
  ...props
}: DockIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={pressed}
      data-dock-trigger=""
      className={cn(
        "rounded-lg flex items-center justify-center shrink-0",
        "text-foreground/80 hover:bg-accent hover:text-accent-foreground",
        "transition-colors duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:opacity-30 disabled:hover:bg-transparent",
        "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
        "aria-pressed:bg-accent aria-pressed:text-accent-foreground",
        size === "sm" ? "h-7 w-7" : "h-10 w-10",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
