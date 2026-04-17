import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-1/3 left-1/2 h-[70vmax] w-[70vmax] -translate-x-1/2 rounded-full opacity-40 blur-[140px] animate-onboarding-drift-a"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--color-primary) 30%, transparent) 0%, transparent 70%)",
        }}
      />
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
