import { useEffect, useState } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import {
  AlertTriangle,
  RotateCw,
  RefreshCw,
  Home,
  ChevronDown,
  Copy,
  Check,
} from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TopBar } from "./title-bar/TopBar";

type ErrorScreenVariant = "app" | "route";

interface ErrorScreenProps {
  error: unknown;
  reset?: () => void;
  variant?: ErrorScreenVariant;
  /** Optional title override (otherwise a sensible default is used per variant). */
  title?: string;
  /** Optional description override (otherwise a sensible default is used per variant). */
  description?: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error && error.stack) return error.stack;
  return undefined;
}

export function ErrorScreen({
  error,
  reset,
  variant = "route",
  title,
  description,
}: ErrorScreenProps) {
  const { t } = useLingui();
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Surface the error to the console for transparency / debugging.
    console.error("[ErrorScreen]", error);
  }, [error]);

  const message = getErrorMessage(error);
  const stack = getErrorStack(error);

  const handleReloadApp = () => {
    window.location.reload();
  };

  const handleCopy = async () => {
    const payload = stack ? `${message}\n\n${stack}` : message;
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy error details", err);
    }
  };

  const isApp = variant === "app";
  const defaultTitle = isApp
    ? t`Something went wrong`
    : t`This screen couldn’t load`;
  const defaultDescription = isApp
    ? t`The application ran into an unexpected error. You can try reloading — your work in progress is saved on disk.`
    : t`We hit a snag while loading this view. You can try this screen again or reload the whole app.`;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "relative flex w-full items-center justify-center bg-background text-foreground",
        isApp
          ? "min-h-screen p-6 animate-wizard-enter"
          : "min-h-0 flex-1 p-6 animate-wizard-enter",
      )}
    >
      <TopBar className="absolute left-0 top-0 drag-region" />
      <div
        className={cn(
          "flex w-full flex-col items-center text-center",
          isApp ? "max-w-lg" : "max-w-md",
        )}
      >
        <div
          className={cn(
            "relative flex items-center justify-center rounded-full bg-destructive/10 text-destructive animate-onboarding-fade-up [animation-delay:0ms]",
            isApp ? "h-16 w-16 mb-5" : "h-12 w-12 mb-4",
          )}
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-destructive/20 animate-fade-ring"
          />
          <AlertTriangle
            className={cn(
              "transition-transform",
              isApp ? "h-8 w-8" : "h-6 w-6",
            )}
            aria-hidden="true"
          />
        </div>

        <h1
          className={cn(
            "font-semibold tracking-tight animate-onboarding-fade-up [animation-delay:80ms]",
            isApp ? "text-2xl" : "text-lg",
          )}
        >
          {title ?? defaultTitle}
        </h1>

        <p
          className={cn(
            "mt-2 text-muted-foreground animate-onboarding-fade-up [animation-delay:160ms]",
            isApp ? "text-sm leading-relaxed" : "text-sm",
          )}
        >
          {description ?? defaultDescription}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 animate-onboarding-fade-up [animation-delay:240ms]">
          {reset && (
            <Button
              type="button"
              onClick={reset}
              variant={isApp ? "outline" : "default"}
              size={isApp ? "default" : "sm"}
              className="transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <RotateCw aria-hidden="true" />
              <Trans>Try this screen again</Trans>
            </Button>
          )}
          <Button
            type="button"
            onClick={handleReloadApp}
            variant={isApp ? "default" : "outline"}
            size={isApp ? "default" : "sm"}
            className="transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <RefreshCw aria-hidden="true" />
            <Trans>Reload app</Trans>
          </Button>
          {isApp && (
            <Button
              type="button"
              variant="ghost"
              size="default"
              asChild
              className="transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Link to="/">
                <Home aria-hidden="true" />
                <Trans>Go to home</Trans>
              </Link>
            </Button>
          )}
        </div>

        {(message || stack) && (
          <div className="mt-6 w-full flex items-center flex-col text-left animate-onboarding-fade-up [animation-delay:320ms]">
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              aria-expanded={showDetails}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground mx-auto"
            >
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-300 ease-out",
                  showDetails && "rotate-180",
                )}
              />
              {showDetails ? (
                <Trans>Hide error details</Trans>
              ) : (
                <Trans>Show error details</Trans>
              )}
            </button>

            <div
              className={cn(
                "grid w-full transition-[grid-template-rows,opacity,margin-top] duration-300 ease-out",
                showDetails
                  ? "grid-rows-[1fr] opacity-100 mt-3"
                  : "grid-rows-[0fr] opacity-0 mt-0",
              )}
            >
              <div className="overflow-hidden">
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <p className="break-words text-xs font-mono text-destructive">
                      {message}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCopy}
                      aria-label={t`Copy error details`}
                      className="h-7 shrink-0 px-2 text-xs transition-transform active:scale-95"
                    >
                      <span
                        key={copied ? "copied" : "idle"}
                        className="flex items-center gap-1 animate-btn-label-enter"
                      >
                        {copied ? (
                          <>
                            <Check aria-hidden="true" />
                            <Trans>Copied</Trans>
                          </>
                        ) : (
                          <>
                            <Copy aria-hidden="true" />
                            <Trans>Copy</Trans>
                          </>
                        )}
                      </span>
                    </Button>
                  </div>
                  {stack && (
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted-foreground wizard-scroll">
                      {stack}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
