import type { MessageDescriptor } from "@lingui/core"
import type { ElementType } from "react"
import { Trans, useLingui } from "@lingui/react/macro"
import { useStore } from "@tanstack/react-form"
import { cn } from "@/lib/utils"
import { useWizardForm } from "@/components/wizard/wizardForm"
import {
  RENDER_STRATEGIES,
  PRESETS,
  STRATEGY_CATEGORIES,
  type RenderStrategyId,
  type StrategyCategory,
} from "@/components/wizard/constants"

const RADIO_NAME = "renderStrategy"

const CATEGORY_CHIP: Record<StrategyCategory, MessageDescriptor> = {
  template: STRATEGY_CATEGORIES.template.label,
  ai: STRATEGY_CATEGORIES.ai.label,
}

function StrategyRadio({
  id,
  Icon,
  title,
  description,
  category,
  selected,
  onSelect,
}: {
  id: RenderStrategyId
  Icon: ElementType
  title: MessageDescriptor
  description: MessageDescriptor
  category: StrategyCategory
  selected: boolean
  onSelect: () => void
}) {
  const { i18n } = useLingui()
  const chip = CATEGORY_CHIP[category]
  const categoryHint = STRATEGY_CATEGORIES[category].description

  return (
    <label
      htmlFor={`strategy-${id}`}
      className={cn(
        "flex w-full cursor-pointer items-stretch gap-2 rounded-lg p-2 text-left transition-colors",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
        selected
          ? "border border-[#2b7fff] bg-[#eff6ff] hover:bg-[#e0edff]"
          : "border border-[#e5e5e5] bg-white hover:bg-[#fafafa]",
      )}
      title={i18n._(categoryHint)}
    >
      <input
        type="radio"
        id={`strategy-${id}`}
        name={RADIO_NAME}
        value={id}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <div className="flex size-14 shrink-0 items-center justify-center">
        <Icon
          className={cn(
            "size-10 shrink-0 transition-colors",
            selected ? "text-[#2b7fff]" : "text-[#a3a3a3]",
          )}
          strokeWidth={1.5}
          aria-hidden
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 pr-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold leading-5 text-black">{i18n._(title)}</span>
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none",
              category === "template"
                ? "border-border bg-muted/60 text-muted-foreground"
                : "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]",
            )}
          >
            {i18n._(chip)}
          </span>
        </div>
        <span className="text-xs font-normal leading-4 text-[#737373] whitespace-normal">
          {i18n._(description)}
        </span>
      </div>
    </label>
  )
}

export function RenderStrategyPicker() {
  const { i18n } = useLingui()
  const form = useWizardForm()
  const renderStrategy = useStore(form.store, (s) => s.values.renderStrategy)
  const selectedPresetId = useStore(form.store, (s) => s.values.selectedPreset)

  const preset = PRESETS.find((p) => p.id === selectedPresetId)
  const allowedIds = preset?.renderStrategies
  const strategies = allowedIds
    ? RENDER_STRATEGIES.filter((s) => allowedIds.includes(s.id))
    : RENDER_STRATEGIES

  function handleSelect(id: RenderStrategyId) {
    form.setFieldValue("renderStrategy", id)
  }

  return (
    <fieldset className="flex w-full flex-col gap-2 border-0 p-0">
      <legend className="flex w-full items-center gap-1 pb-2">
        <span className="text-sm font-medium leading-[14px] text-[#0a0a0a]">
          <Trans>Render Strategy</Trans>
        </span>
        <span className="text-sm font-medium leading-[14px] text-[#ef4444]" aria-hidden>
          *
        </span>
      </legend>
      <p className="pb-1 text-xs leading-relaxed text-[#737373]">
        <Trans>Pick one layout approach.</Trans>{" "}
        <span className="text-[#525252]">{i18n._(STRATEGY_CATEGORIES.template.label)}</span>{" "}
        <Trans>options are deterministic;</Trans>{" "}
        <span className="text-[#525252]">{i18n._(STRATEGY_CATEGORIES.ai.label)}</span>{" "}
        <Trans>options generate a fresh layout per page.</Trans>
      </p>
      <div className="flex flex-col gap-2">
        {strategies.map((strategy) => (
          <StrategyRadio
            key={strategy.id}
            id={strategy.id}
            Icon={strategy.Icon}
            title={strategy.title}
            description={strategy.description}
            category={strategy.category}
            selected={renderStrategy === strategy.id}
            onSelect={() => handleSelect(strategy.id)}
          />
        ))}
      </div>
    </fieldset>
  )
}
