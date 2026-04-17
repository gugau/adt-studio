import { useCallback, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Trans } from "@lingui/react/macro"
import { OnboardingLayout, OnboardingStepContainer } from "./OnboardingLayout"
import { OnboardingProgress } from "./OnboardingProgress"
import { ONBOARDING_STEPS } from "./steps"
import { markOnboardingCompleted } from "@/hooks/use-onboarding"
import { LocaleSwitcher } from "@/components/LocaleSwitcher"

export function OnboardingFlow() {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState<"forward" | "back">("forward")

  const step = ONBOARDING_STEPS[index]
  const isFirst = index === 0
  const isLast = index === ONBOARDING_STEPS.length - 1
  const lastIndex = ONBOARDING_STEPS.length - 1

  const onNext = useCallback(() => {
    setDirection("forward")
    setIndex((i) => Math.min(i + 1, ONBOARDING_STEPS.length - 1))
  }, [])

  const onBack = useCallback(() => {
    setDirection("back")
    setIndex((i) => Math.max(i - 1, 0))
  }, [])

  const onFinish = useCallback(() => {
    markOnboardingCompleted()
    navigate({ to: "/books/new" })
  }, [navigate])

  const onSkip = useCallback(() => {
    markOnboardingCompleted()
    navigate({ to: "/" })
  }, [navigate])

  const skipIntro = useCallback(() => {
    setDirection("forward")
    setIndex(lastIndex)
  }, [lastIndex])

  const StepComponent = step.component
  const animationClass =
    direction === "forward"
      ? "animate-step-enter-forward"
      : "animate-step-enter-back"

  return (
    <OnboardingLayout>
      <OnboardingStepContainer
        variant={step.layout}
        animationClass={animationClass}
        stepKey={step.id}
      >
        <StepComponent
          onNext={onNext}
          onBack={onBack}
          onFinish={onFinish}
          onSkip={onSkip}
          isFirst={isFirst}
          isLast={isLast}
        />
      </OnboardingStepContainer>

      <LocaleSwitcher
        variant="standalone"
        className="absolute left-6 top-6 animate-onboarding-fade-in [animation-delay:200ms]"
      />

      {!isLast && (
        <button
          type="button"
          onClick={skipIntro}
          className="absolute right-6 top-6 rounded-full border border-border bg-card/80 px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground animate-onboarding-fade-in [animation-delay:200ms] cursor-pointer"
        >
          <Trans>Skip intro</Trans>
        </button>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center animate-onboarding-fade-in [animation-delay:400ms]">
        <OnboardingProgress
          total={ONBOARDING_STEPS.length}
          current={index}
        />
      </div>
    </OnboardingLayout>
  )
}
