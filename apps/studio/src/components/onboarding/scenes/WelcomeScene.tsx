import { useEffect, useState } from "react"
import { ArrowRight } from "lucide-react"
import { Trans } from "@lingui/react/macro"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { OnboardingStepProps } from "../steps"

export function WelcomeScene({ onNext }: OnboardingStepProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-8 p-8 text-center">
      <div
        aria-hidden
        className={cn(
          "flex h-[104px] w-[104px] items-center justify-center rounded-[22px] transition-all duration-[700ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
          mounted ? "scale-100 opacity-100" : "scale-[0.85] opacity-0",
        )}
        style={{
          background: "linear-gradient(135deg, #3b82f6 0%, #2b7fff 55%, #1e5fd9 100%)",
          boxShadow:
            "0 24px 60px -18px rgba(43,127,255,.55), 0 2px 8px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.25)",
        }}
      >
        <svg
          width="54"
          height="54"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19a1 1 0 0 1 1 1v14.5" />
          <path d="M4 5.5V19a2 2 0 0 0 2 2h14" />
          <path d="M8 8h7M8 11h7M8 14h5" />
        </svg>
      </div>

      <div
        className={cn(
          "text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-opacity duration-500",
          mounted ? "opacity-100" : "opacity-0",
        )}
        style={{ transitionDelay: "200ms" }}
      >
        <Trans>Welcome to ADT Studio</Trans>
      </div>

      <h1
        className={cn(
          "max-w-3xl text-5xl font-semibold leading-[1.1] tracking-tight transition-all duration-[700ms] ease-[cubic-bezier(0.22,1,0.36,1)] md:text-6xl",
          mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        )}
        style={{ transitionDelay: "300ms" }}
      >
        <Trans>
          Accessibility, from the first{" "}
          <span className="text-primary">page.</span>
        </Trans>
      </h1>

      <p
        className={cn(
          "max-w-lg text-lg leading-relaxed text-muted-foreground transition-opacity duration-[600ms]",
          mounted ? "opacity-100" : "opacity-0",
        )}
        style={{ transitionDelay: "600ms" }}
      >
        <Trans>
          Every textbook you publish here ships with audio, structured layouts,
          translations and sign-language — by default, for everyone.
        </Trans>
      </p>

      <div
        className={cn(
          "mt-4 transition-opacity duration-500",
          mounted ? "opacity-100" : "opacity-0",
        )}
        style={{ transitionDelay: "800ms" }}
      >
        <Button size="lg" className="h-12 rounded-full px-8 text-sm" onClick={onNext}>
          <Trans>Get started</Trans>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
