import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-background text-foreground">
      <div className="relative flex h-full w-full flex-col">{children}</div>
    </div>
  )
}

export function OnboardingStepContainer({
  children,
  variant,
  animationClass,
  stepKey,
}: {
  children: ReactNode
  variant: "centered" | "split"
  animationClass: string
  stepKey: string | number
}) {
  return (
    <div
      key={stepKey}
      className={cn(
        "relative mx-auto flex min-h-0 flex-1",
        animationClass,
        variant === "split"
          ? "grid max-w-7xl grid-cols-1 md:grid-cols-2"
          : "items-center justify-center",
      )}
    >
      {children}
    </div>
  )
}
