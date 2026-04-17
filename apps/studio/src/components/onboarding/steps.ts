import type { ComponentType } from "react"
import { TitleScene } from "./scenes/TitleScene"
import { DemoScene } from "./scenes/DemoScene"
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
  id: "title" | "demo" | "api-key" | "finale"
  layout: "centered"
  component: ComponentType<OnboardingStepProps>
}

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  { id: "title", layout: "centered", component: TitleScene },
  { id: "demo", layout: "centered", component: DemoScene },
  { id: "api-key", layout: "centered", component: ApiKeyStep },
  { id: "finale", layout: "centered", component: FinaleScene },
] as const
