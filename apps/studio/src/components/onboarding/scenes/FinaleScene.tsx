import { Trans } from "@lingui/react/macro";
import { Button } from "@/components/ui/button";
import type { OnboardingStepProps } from "../steps";

export function FinaleScene({ onFinish }: OnboardingStepProps) {
  return (
    <div className="relative flex h-full w-full items-center justify-center p-8">
      <div className="flex max-w-2xl flex-col items-center gap-10 text-center">
        <span className="animate-onboarding-fade-up text-xs uppercase tracking-[0.25em] text-muted-foreground [animation-delay:60ms]">
          <Trans>Ready when you are</Trans>
        </span>

        <div className="space-y-3">
          <h2 className="animate-onboarding-fade-up text-6xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-7xl [animation-delay:160ms]">
            <Trans>Let's build</Trans>
            <br />
            <span className="text-primary">
              <Trans>something calm.</Trans>
            </span>
          </h2>
          <p className="animate-onboarding-fade-up max-w-lg text-base leading-relaxed text-muted-foreground [animation-delay:280ms]">
            <Trans>
              Drop in your first PDF and watch the pipeline do its thing. You
              can always come back to this tour.
            </Trans>
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Button
            size="lg"
            className="animate-onboarding-fade-up h-12 rounded-lg px-10 text-sm [animation-delay:420ms]"
            onClick={onFinish}
          >
            <Trans>Create your first book</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
}
