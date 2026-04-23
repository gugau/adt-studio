import { createFileRoute } from "@tanstack/react-router"
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow"

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
})

function OnboardingPage() {
  return <OnboardingFlow />
}
