import type { ComponentType } from "react"
import { WelcomeScene } from "./scenes/WelcomeScene"
import { PitchScene } from "./scenes/PitchScene"
import { CarouselScene } from "./scenes/carousel-scene"
import { ApiKeyStep } from "./steps/ApiKeyStep"
import { FinaleScene } from "./scenes/FinaleScene"

export type OnboardingStepProps = {
  onNext: () => void
  onBack: () => void
  onFinish: () => void
  onSkip: () => void
  isFirst: boolean
  isLast: boolean
}

export type OnboardingStep = {
  id: "welcome" | "pitch" | "carousel" | "api-key" | "finale"
  layout: "centered"
  component: ComponentType<OnboardingStepProps>
}

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  { id: "welcome", layout: "centered", component: WelcomeScene },
  { id: "pitch", layout: "centered", component: PitchScene },
  { id: "carousel", layout: "centered", component: CarouselScene },
  { id: "api-key", layout: "centered", component: ApiKeyStep },
  { id: "finale", layout: "centered", component: FinaleScene },
] as const
