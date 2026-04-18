import { useState } from "react";
import { KeyRound, Eye, EyeOff, Check } from "lucide-react";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react/macro";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiKey } from "@/hooks/use-api-key";
import type { OnboardingStepProps } from "../steps";

type TabKey = "openai" | "anthropic" | "google" | "custom" | "azure";

function isValidOpenAIKey(key: string): boolean {
  const trimmed = key.trim();
  return trimmed.length > 0 && trimmed.startsWith("sk-");
}

export function ApiKeyStep(_props: OnboardingStepProps) {
  const { t } = useLingui();
  const {
    apiKey,
    anthropicKey,
    googleKey,
    customBaseUrl,
    customApiKey,
    azureKey,
    azureRegion,
  } = useApiKey();

  const [tab, setTab] = useState<TabKey>("openai");
  const [showKey, setShowKey] = useState(false);
  const [openaiDraft, setOpenaiDraft] = useState(apiKey);
  const [anthropicDraft, setAnthropicDraft] = useState(anthropicKey);
  const [googleDraft, setGoogleDraft] = useState(googleKey);
  const [customBaseUrlDraft, setCustomBaseUrlDraft] = useState(customBaseUrl);
  const [customApiKeyDraft, setCustomApiKeyDraft] = useState(customApiKey);
  const [azureKeyDraft, setAzureKeyDraft] = useState(azureKey);
  const [azureRegionDraft, setAzureRegionDraft] = useState(azureRegion);

  const tabs: { key: TabKey; label: string; isSaved: boolean }[] = [
    { key: "openai", label: t`OpenAI`, isSaved: apiKey.length > 0 },
    { key: "anthropic", label: t`Anthropic`, isSaved: anthropicKey.length > 0 },
    { key: "google", label: t`Google`, isSaved: googleKey.length > 0 },
    { key: "custom", label: t`Custom`, isSaved: customBaseUrl.length > 0 },
    { key: "azure", label: t`Azure`, isSaved: azureKey.length > 0 },
  ];

  const passwordInputClass = "h-11 rounded-xl pr-10";
  const eyeToggle = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="absolute right-0 top-0 h-11 w-11"
      onClick={() => setShowKey((v) => !v)}
      tabIndex={-1}
    >
      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </Button>
  );

  return (
    <div className="relative flex h-full w-full items-center justify-center p-8">
      <div className="flex w-full max-w-xl flex-col items-center gap-8 text-center">
        <div className="animate-onboarding-icon-float flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
          <KeyRound className="h-8 w-8" />
        </div>

        <div className="space-y-3 flex flex-col items-center">
          <h2 className="animate-onboarding-fade-up text-4xl font-semibold tracking-tight text-foreground md:text-5xl [animation-delay:100ms]">
            <Trans>Connect an AI provider</Trans>
          </h2>
          <p className="animate-onboarding-fade-up max-w-lg text-base leading-relaxed text-muted-foreground [animation-delay:220ms]">
            <Trans>
              ADT Studio uses your own API keys to run the pipeline. Keys are
              stored locally on this device and never sent anywhere else.
            </Trans>
          </p>
        </div>

        <div className="animate-onboarding-fade-up flex w-full flex-col gap-4 text-left [animation-delay:340ms]">
          <div className="flex flex-wrap gap-1 border-b border-border">
            {tabs.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setTab(item.key);
                  setShowKey(false);
                }}
                className={cn(
                  "-mb-px flex items-center gap-1 whitespace-nowrap border-b-2 px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                  tab === item.key
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
                {item.isSaved && <Check className="h-3 w-3 text-primary" />}
              </button>
            ))}
          </div>

          {tab === "openai" && (
            <div className="space-y-2">
              <Label htmlFor="onb-openai-key">
                <Trans>OpenAI API Key</Trans>
              </Label>
              <div className="relative">
                <Input
                  id="onb-openai-key"
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={t`sk-...`}
                  value={openaiDraft}
                  onChange={(e) => setOpenaiDraft(e.target.value)}
                  className={passwordInputClass}
                />
                {eyeToggle}
              </div>
              {openaiDraft.length > 0 && !isValidOpenAIKey(openaiDraft) && (
                <p className="text-xs text-destructive">
                  <Trans>Key must start with sk-</Trans>
                </p>
              )}
            </div>
          )}

          {tab === "anthropic" && (
            <div className="space-y-2">
              <Label htmlFor="onb-anthropic-key">
                <Trans>Anthropic API Key</Trans>
              </Label>
              <div className="relative">
                <Input
                  id="onb-anthropic-key"
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={t`sk-ant-...`}
                  value={anthropicDraft}
                  onChange={(e) => setAnthropicDraft(e.target.value)}
                  className={passwordInputClass}
                />
                {eyeToggle}
              </div>
              <p className="text-xs text-muted-foreground">
                <Trans>
                  Used for Claude models (claude-opus-4-6, claude-sonnet-4-6,
                  etc.)
                </Trans>
              </p>
            </div>
          )}

          {tab === "google" && (
            <div className="space-y-2">
              <Label htmlFor="onb-google-key">
                <Trans>Google AI API Key</Trans>
              </Label>
              <div className="relative">
                <Input
                  id="onb-google-key"
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={t`AIza...`}
                  value={googleDraft}
                  onChange={(e) => setGoogleDraft(e.target.value)}
                  className={passwordInputClass}
                />
                {eyeToggle}
              </div>
              <p className="text-xs text-muted-foreground">
                <Trans>
                  Used for Gemini models — both LLM (gemini-2.5-pro, etc.) and
                  TTS (gemini-2.5-pro-preview-tts, etc.)
                </Trans>
              </p>
            </div>
          )}

          {tab === "custom" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="onb-custom-base-url">
                  <Trans>Base URL</Trans>
                </Label>
                <Input
                  id="onb-custom-base-url"
                  placeholder={t`e.g. http://localhost:11434/v1`}
                  value={customBaseUrlDraft}
                  onChange={(e) => setCustomBaseUrlDraft(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onb-custom-api-key">
                  <Trans>API Key (optional)</Trans>
                </Label>
                <div className="relative">
                  <Input
                    id="onb-custom-api-key"
                    type={showKey ? "text" : "password"}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={t`Leave empty if not required`}
                    value={customApiKeyDraft}
                    onChange={(e) => setCustomApiKeyDraft(e.target.value)}
                    className={passwordInputClass}
                  />
                  {eyeToggle}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                <Trans>
                  Any OpenAI-compatible endpoint (Ollama, vLLM, Together AI,
                  etc.). Use the "custom:" prefix when selecting models, e.g.
                  custom:llama3.
                </Trans>
              </p>
            </div>
          )}

          {tab === "azure" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="onb-azure-key">
                  <Trans>Azure Speech Subscription Key</Trans>
                </Label>
                <div className="relative">
                  <Input
                    id="onb-azure-key"
                    type={showKey ? "text" : "password"}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={t`Azure Speech subscription key`}
                    value={azureKeyDraft}
                    onChange={(e) => setAzureKeyDraft(e.target.value)}
                    className={passwordInputClass}
                  />
                  {eyeToggle}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="onb-azure-region">
                  <Trans>Region</Trans>
                </Label>
                <Input
                  id="onb-azure-region"
                  placeholder={t`e.g. eastus, westeurope`}
                  value={azureRegionDraft}
                  onChange={(e) => setAzureRegionDraft(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                <Trans>Used for Azure Speech TTS provider.</Trans>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
