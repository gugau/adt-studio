import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Trans } from "@lingui/react/macro";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { OnboardingLayout, OnboardingStepContainer } from "./OnboardingLayout";
import { OnboardingProgress } from "./OnboardingProgress";
import { ONBOARDING_STEPS } from "./steps";
import { markOnboardingCompleted } from "@/hooks/use-onboarding";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePlatform } from "@/hooks/use-platform";
import { useWindowControls } from "@/hooks/use-window-controls";
import {
  LinuxControls,
  MacOSTrafficLightSpacer,
  WindowsControls,
} from "@/components/title-bar";
import { DRAG_REGION, NO_DRAG_REGION } from "@/constants";

export function OnboardingFlow() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const platform = usePlatform();
  const { available: hasWindowControls } = useWindowControls();
  const showMacOSSpacer = hasWindowControls && platform === "macos";
  const showWindowsControls = hasWindowControls && platform === "windows";
  const showLinuxControls = hasWindowControls && platform === "linux";

  const step = ONBOARDING_STEPS[index];
  const isFirst = index === 0;
  const isLast = index === ONBOARDING_STEPS.length - 1;
  const lastIndex = ONBOARDING_STEPS.length - 1;

  const onNext = useCallback(() => {
    setDirection("forward");
    setIndex((i) => Math.min(i + 1, ONBOARDING_STEPS.length - 1));
  }, []);

  const onBack = useCallback(() => {
    setDirection("back");
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  const onFinish = useCallback(() => {
    markOnboardingCompleted();
    navigate({ to: "/books/new" });
  }, [navigate]);

  const onSkip = useCallback(() => {
    markOnboardingCompleted();
    navigate({ to: "/" });
  }, [navigate]);

  const skipIntro = useCallback(() => {
    setDirection("forward");
    setIndex(lastIndex);
  }, [lastIndex]);

  const StepComponent = step.component;
  const animationClass =
    direction === "forward"
      ? "animate-step-enter-forward"
      : "animate-step-enter-back";

  return (
    <OnboardingLayout>
      <div
        className="absolute inset-x-0 top-0 z-20 flex min-h-11 items-center px-6 animate-onboarding-fade-in [animation-delay:200ms]"
        style={DRAG_REGION}
      >
        {showMacOSSpacer && <MacOSTrafficLightSpacer />}
        <div style={NO_DRAG_REGION}>
          <LocaleSwitcher variant="standalone" />
        </div>
        <div className="flex-1" />
        {!isLast && (
          <button
            type="button"
            onClick={skipIntro}
            style={NO_DRAG_REGION}
            className="rounded-lg border border-border bg-card/80 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur transition-colors hover:text-foreground cursor-pointer"
          >
            <Trans>Skip intro</Trans>
          </button>
        )}
        {showLinuxControls && <LinuxControls className="self-stretch ml-3" />}
        {showWindowsControls && (
          <WindowsControls className="self-stretch ml-3" />
        )}
      </div>

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

      <div className="absolute inset-x-0 min-h-[69px] bottom-0 flex items-center justify-between border-t border-border/50 px-8 py-4 animate-onboarding-fade-in [animation-delay:400ms]">
        <div className="min-w-[230px]">
          <Button
            variant="ghost"
            size="sm"
            className={cn("rounded-lg", isFirst && "hidden")}
            onClick={onBack}
            disabled={isFirst}
          >
            <ArrowLeft className="h-4 w-4" />
            <Trans>Back</Trans>
          </Button>
        </div>

        <OnboardingProgress total={ONBOARDING_STEPS.length} current={index} />

        <div className="flex items-center justify-end gap-2 min-w-[230px]">
          <Button
            size="sm"
            className={cn("rounded-lg", (isFirst || isLast) && "hidden")}
            onClick={onNext}
          >
            <Trans>Continue</Trans>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </OnboardingLayout>
  );
}
