import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronRight, FlaskConical, RotateCcw, Save } from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import {
  DEFAULT_TRANSLATION_EVALUATION_BATCH_SIZE,
  type TranslationEvaluationConfig as TranslationEvaluationConfigData,
  DEFAULT_TRANSLATION_EVALUATION_JUDGE_INSTRUCTIONS,
  DEFAULT_TRANSLATION_EVALUATION_JUDGE_MODEL,
  DEFAULT_TRANSLATION_EVALUATION_MAX_RETRIES,
  resolveTranslationEvaluationConfig,
  type TranslationEvaluationSamplingMethod,
  type TranslationEvaluationScopeMode,
} from "@adt/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useBookConfig, useUpdateBookConfig } from "@/hooks/use-book-config"

function SectionHeader({ title, description }: { title: React.ReactNode; description: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function SettingsSection({
  title,
  description,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  title: React.ReactNode
  description: React.ReactNode
  children: React.ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="rounded-2xl border bg-card p-5">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="flex w-full items-start justify-between gap-4 text-left"
        >
          <div className="space-y-1">
            <SectionHeader title={title} description={description} />
          </div>
          <div className="mt-1 text-muted-foreground">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </button>
      ) : (
        <div className="space-y-1">
          <SectionHeader title={title} description={description} />
        </div>
      )}
      {(!collapsible || isOpen) ? <div className="mt-5">{children}</div> : null}
    </div>
  )
}

interface TranslationEvaluationSettingsState {
  enable_translation_evaluation: boolean
  judge_model: string
  max_retries: string
  evaluation_scope_mode: TranslationEvaluationScopeMode
  evaluation_scope_count: string
  sampling_method: TranslationEvaluationSamplingMethod
  sampling_seed: string
  batch_size: string
  judge_instructions: string
  additional_guidance: string
}

function buildSettingsState(config: Record<string, unknown> | null | undefined): TranslationEvaluationSettingsState {
  const translationEvaluation = config?.translation_evaluation
    && typeof config.translation_evaluation === "object"
      ? config.translation_evaluation as Record<string, unknown>
      : null
  const resolved = resolveTranslationEvaluationConfig(
    (translationEvaluation ?? undefined) as TranslationEvaluationConfigData | undefined,
  )

  return {
    enable_translation_evaluation: resolved.enable_translation_evaluation,
    judge_model: resolved.judge_model,
    max_retries: String(resolved.max_retries),
    evaluation_scope_mode: resolved.evaluation_scope_mode,
    evaluation_scope_count: resolved.evaluation_scope_count === null ? "" : String(resolved.evaluation_scope_count),
    sampling_method: resolved.sampling_method,
    sampling_seed: resolved.sampling_seed === null ? "" : String(resolved.sampling_seed),
    batch_size: String(resolved.batch_size),
    judge_instructions: resolved.judge_instructions,
    additional_guidance: resolved.additional_guidance ?? "",
  }
}

export function TranslationEvaluationSettingsTab({ label }: { label: string }) {
  const { t } = useLingui()
  const { data: bookConfigData, isLoading, error } = useBookConfig(label)
  const updateConfig = useUpdateBookConfig()
  const [settings, setSettings] = useState<TranslationEvaluationSettingsState>(() => buildSettingsState(null))
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!bookConfigData || dirty) return
    setSettings(buildSettingsState(bookConfigData.config))
  }, [bookConfigData, dirty])

  const hasOverride = useMemo(() => {
    const currentConfig = bookConfigData?.config?.translation_evaluation
    return Boolean(currentConfig && typeof currentConfig === "object" && Object.keys(currentConfig).length > 0)
  }, [bookConfigData?.config])

  const maxRetriesValue = settings.max_retries.trim() ? Number(settings.max_retries) : null
  const scopeCountValue = settings.evaluation_scope_count.trim() ? Number(settings.evaluation_scope_count) : null
  const samplingSeedValue = settings.sampling_seed.trim() ? Number(settings.sampling_seed) : null
  const batchSizeValue = settings.batch_size.trim() ? Number(settings.batch_size) : null

  const hasInvalidMaxRetries = maxRetriesValue !== null && (!Number.isInteger(maxRetriesValue) || maxRetriesValue < 0)
  const hasInvalidScopeCount = settings.evaluation_scope_mode === "sample"
    && (scopeCountValue === null || !Number.isInteger(scopeCountValue) || scopeCountValue < 1)
  const hasInvalidSamplingSeed = samplingSeedValue !== null && !Number.isInteger(samplingSeedValue)
  const hasInvalidBatchSize = batchSizeValue === null || !Number.isInteger(batchSizeValue) || batchSizeValue < 1
  const hasInvalidJudgeInstructions = settings.judge_instructions.trim().length === 0
  const hasValidationError = hasInvalidMaxRetries
    || hasInvalidScopeCount
    || hasInvalidSamplingSeed
    || hasInvalidBatchSize
    || hasInvalidJudgeInstructions

  const setField = <K extends keyof TranslationEvaluationSettingsState>(field: K, value: TranslationEvaluationSettingsState[K]) => {
    setSettings((current) => ({ ...current, [field]: value }))
    setDirty(true)
  }

  const setEvaluationScopeMode = (value: TranslationEvaluationScopeMode) => {
    setSettings((current) => ({
      ...current,
      evaluation_scope_mode: value,
      sampling_method: value === "all" ? "sequential" : current.sampling_method,
    }))
    setDirty(true)
  }

  const saveSettings = () => {
    const currentConfig = { ...(bookConfigData?.config ?? {}) } as Record<string, unknown>
    currentConfig.translation_evaluation = {
      enable_translation_evaluation: settings.enable_translation_evaluation,
      enabled: settings.enable_translation_evaluation,
      judge_model: settings.judge_model.trim() || DEFAULT_TRANSLATION_EVALUATION_JUDGE_MODEL,
      max_retries: maxRetriesValue ?? DEFAULT_TRANSLATION_EVALUATION_MAX_RETRIES,
      evaluation_scope_mode: settings.evaluation_scope_mode,
      ...(settings.evaluation_scope_mode === "sample" && scopeCountValue !== null
        ? { evaluation_scope_count: scopeCountValue }
        : {}),
      sampling_method: settings.sampling_method,
      ...(samplingSeedValue !== null ? { sampling_seed: samplingSeedValue } : {}),
      batch_size: batchSizeValue ?? DEFAULT_TRANSLATION_EVALUATION_BATCH_SIZE,
      judge_instructions: settings.judge_instructions.trim() || DEFAULT_TRANSLATION_EVALUATION_JUDGE_INSTRUCTIONS,
      ...(settings.additional_guidance.trim()
        ? { additional_guidance: settings.additional_guidance.trim() }
        : {}),
    }

    updateConfig.mutate({ label, config: currentConfig })
    setDirty(false)
  }

  const resetSettings = () => {
    const currentConfig = { ...(bookConfigData?.config ?? {}) } as Record<string, unknown>
    delete currentConfig.translation_evaluation
    updateConfig.mutate({ label, config: currentConfig })
    setSettings(buildSettingsState(null))
    setDirty(false)
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground"><Trans>Loading translation evaluation settings…</Trans></div>
  }

  if (error || !bookConfigData) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error instanceof Error ? error.message : t`Unable to load translation evaluation settings.`}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            <SectionHeader
              title={t`Translation evaluation settings`}
              description={t`Configure LLM-based translation evaluation for this book, including evaluation scope, execution controls, and judge instructions.`}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={hasOverride ? "secondary" : "outline"}>
            {hasOverride ? t`Book override` : t`Inherited defaults`}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={resetSettings}
            disabled={updateConfig.isPending || (!dirty && !hasOverride)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <Trans>Reset</Trans>
          </Button>
          <Button
            size="sm"
            onClick={saveSettings}
            disabled={updateConfig.isPending || !dirty || hasValidationError}
          >
            <Save className="h-3.5 w-3.5" />
            <Trans>Save changes</Trans>
          </Button>
        </div>
      </div>

      {hasValidationError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {hasInvalidMaxRetries ? <div><Trans>Max retries must be an integer greater than or equal to 0.</Trans></div> : null}
          {hasInvalidScopeCount ? <div><Trans>Evaluation scope count must be an integer greater than or equal to 1 when sampling is enabled.</Trans></div> : null}
          {hasInvalidSamplingSeed ? <div><Trans>Sampling seed must be an integer.</Trans></div> : null}
          {hasInvalidBatchSize ? <div><Trans>Batch size must be an integer greater than or equal to 1.</Trans></div> : null}
          {hasInvalidJudgeInstructions ? <div><Trans>Judge instructions cannot be empty.</Trans></div> : null}
        </div>
      ) : null}

      <SettingsSection
        title={t`General`}
        description={t`Turn translation evaluation on or off for this book and choose the judge model used to review translations.`}
      >
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-2">
            <Label htmlFor="translation-evaluation-judge-model"><Trans>Judge model</Trans></Label>
            <Input
              id="translation-evaluation-judge-model"
              value={settings.judge_model}
              onChange={(event) => setField("judge_model", event.target.value)}
              placeholder={DEFAULT_TRANSLATION_EVALUATION_JUDGE_MODEL}
              disabled={updateConfig.isPending}
            />
            <p className="text-xs text-muted-foreground">
              <Trans>Model identifier used by the API when asking the judge to review translations.</Trans>
            </p>
          </div>

          <div className="space-y-2 md:min-w-52">
            <Label htmlFor="translation-evaluation-enabled"><Trans>Enable translation evaluation</Trans></Label>
            <div className="flex items-center justify-between rounded-xl border px-3 py-3">
              <div className="pr-3 text-sm text-muted-foreground">
                <Trans>Existing evaluation history remains stored even if you disable new runs.</Trans>
              </div>
              <Switch
                id="translation-evaluation-enabled"
                checked={settings.enable_translation_evaluation}
                onCheckedChange={(checked) => setField("enable_translation_evaluation", checked)}
                disabled={updateConfig.isPending}
                aria-label={settings.enable_translation_evaluation ? t`Disable translation evaluation` : t`Enable translation evaluation`}
              />
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title={t`Evaluation Scope`}
        description={t`Control how many entries are evaluated in one run and how sampled entries are selected.`}
        collapsible
        defaultOpen={false}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="translation-evaluation-scope-mode"><Trans>Scope mode</Trans></Label>
            <Select
              value={settings.evaluation_scope_mode}
              onValueChange={(value) => setEvaluationScopeMode(value as TranslationEvaluationScopeMode)}
            >
              <SelectTrigger id="translation-evaluation-scope-mode">
                <SelectValue placeholder={t`Select scope mode`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><Trans>All entries</Trans></SelectItem>
                <SelectItem value="sample"><Trans>Sample entries</Trans></SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              <Trans>Use scope mode to choose whether the evaluation should inspect the full translation catalog or only a subset.</Trans>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="translation-evaluation-scope-count"><Trans>Evaluation scope count</Trans></Label>
            <Input
              id="translation-evaluation-scope-count"
              type="number"
              min={1}
              value={settings.evaluation_scope_count}
              onChange={(event) => setField("evaluation_scope_count", event.target.value)}
              placeholder="50"
              disabled={updateConfig.isPending || settings.evaluation_scope_mode !== "sample"}
            />
            <p className="text-xs text-muted-foreground">
              <Trans>Total number of entries to evaluate when scope mode is set to sample.</Trans>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="translation-evaluation-sampling-method"><Trans>Sampling method</Trans></Label>
            <Select
              value={settings.sampling_method}
              onValueChange={(value) => setField("sampling_method", value as TranslationEvaluationSamplingMethod)}
            >
              <SelectTrigger
                id="translation-evaluation-sampling-method"
                disabled={updateConfig.isPending || settings.evaluation_scope_mode !== "sample"}
              >
                <SelectValue placeholder={t`Select sampling method`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sequential"><Trans>Sequential</Trans></SelectItem>
                <SelectItem value="random"><Trans>Random</Trans></SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              <Trans>Sequential takes entries in catalog order. Random shuffles the available entries first.</Trans>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="translation-evaluation-sampling-seed"><Trans>Sampling seed</Trans></Label>
            <Input
              id="translation-evaluation-sampling-seed"
              type="number"
              value={settings.sampling_seed}
              onChange={(event) => setField("sampling_seed", event.target.value)}
              placeholder="12345"
              disabled={updateConfig.isPending || settings.evaluation_scope_mode !== "sample" || settings.sampling_method !== "random"}
            />
            <p className="text-xs text-muted-foreground">
              <Trans>Optional integer seed for reproducible random sampling.</Trans>
            </p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title={t`Execution`}
        description={t`Tune retry behavior and batch processing. Scope count controls the total entries selected; batch size controls how many selected entries are processed per chunk.`}
        collapsible
        defaultOpen={false}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="translation-evaluation-max-retries"><Trans>Max retries</Trans></Label>
            <Input
              id="translation-evaluation-max-retries"
              type="number"
              min={0}
              value={settings.max_retries}
              onChange={(event) => setField("max_retries", event.target.value)}
              placeholder={String(DEFAULT_TRANSLATION_EVALUATION_MAX_RETRIES)}
              disabled={updateConfig.isPending}
            />
            <p className="text-xs text-muted-foreground">
              <Trans>Retry budget for temporary judge or provider failures.</Trans>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="translation-evaluation-batch-size"><Trans>Batch size</Trans></Label>
            <Input
              id="translation-evaluation-batch-size"
              type="number"
              min={1}
              value={settings.batch_size}
              onChange={(event) => setField("batch_size", event.target.value)}
              placeholder={String(DEFAULT_TRANSLATION_EVALUATION_BATCH_SIZE)}
              disabled={updateConfig.isPending}
            />
            <p className="text-xs text-muted-foreground">
              <Trans>Entries are selected first using the scope settings, then processed in batches of this size.</Trans>
            </p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title={t`Judge Configuration`}
        description={t`Customize the instructions sent to the translation judge. The API supplies the source text, translated text, and language context for each entry.`}
        collapsible
        defaultOpen={false}
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="translation-evaluation-judge-instructions"><Trans>Judge instructions</Trans></Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setField("judge_instructions", DEFAULT_TRANSLATION_EVALUATION_JUDGE_INSTRUCTIONS)}
                disabled={updateConfig.isPending}
              >
                <Trans>Reset to default</Trans>
              </Button>
            </div>
            <Textarea
              id="translation-evaluation-judge-instructions"
              value={settings.judge_instructions}
              onChange={(event) => setField("judge_instructions", event.target.value)}
              rows={12}
              disabled={updateConfig.isPending}
            />
            <p className="text-xs text-muted-foreground">
              <Trans>This text is used as the base instruction for the judge. Existing configs with old input/output placeholders remain valid.</Trans>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="translation-evaluation-additional-guidance"><Trans>Additional guidance</Trans></Label>
            <Textarea
              id="translation-evaluation-additional-guidance"
              value={settings.additional_guidance}
              onChange={(event) => setField("additional_guidance", event.target.value)}
              rows={4}
              disabled={updateConfig.isPending}
            />
            <p className="text-xs text-muted-foreground">
              <Trans>Optional extra context appended to the judge prompt, such as terminology reminders or audience-specific guidance.</Trans>
            </p>
          </div>
        </div>
      </SettingsSection>
    </div>
  )
}
