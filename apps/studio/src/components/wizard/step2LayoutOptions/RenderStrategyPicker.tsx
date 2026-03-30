/* eslint-disable lingui/no-unlocalized-strings */
import type { ElementType } from "react"
import { useStore } from "@tanstack/react-form"
import { cn } from "@/lib/utils"
import { useWizardForm } from "@/components/wizard/wizardForm"
import {
  RENDER_STRATEGIES,
  STRATEGY_CATEGORIES,
  type RenderStrategyId,
  type StrategyCategory,
} from "@/components/wizard/constants"

const RADIO_NAME = "renderStrategy"

function StrategyRadio({
  id,
  Icon,
  title,
  description,
  selected,
  onSelect,
}: {
  id: RenderStrategyId
  Icon: ElementType
  title: string
  description: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <label
      htmlFor={`strategy-${id}`}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 text-left transition-colors",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
        selected
          ? "border border-[#2b7fff] bg-[#eff6ff] hover:bg-[#e0edff]"
          : "border border-[#e5e5e5] bg-white hover:bg-[#fafafa]",
      )}
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
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 pr-1">
        <span className="text-sm font-semibold leading-5 text-black">
          {title}
        </span>
        <span className="text-xs font-normal leading-4 text-[#737373] whitespace-normal">
          {description}
        </span>
      </div>
    </label>
  )
}

function CategoryGroup({
  category,
  selected,
  onSelect,
}: {
  category: StrategyCategory
  selected: RenderStrategyId | ""
  onSelect: (id: RenderStrategyId) => void
}) {
  const meta = STRATEGY_CATEGORIES[category]
  const strategies = RENDER_STRATEGIES.filter((s) => s.category === category)

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="flex flex-col gap-0.5 pb-1">
        <span className="text-sm font-semibold text-[#0a0a0a]">
          {meta.label}
        </span>
        <span className="text-xs text-[#a3a3a3]">
          {meta.description}
        </span>
      </legend>
      <div className="flex flex-col gap-2">
        {strategies.map((strategy) => (
          <StrategyRadio
            key={strategy.id}
            id={strategy.id}
            Icon={strategy.Icon}
            title={strategy.title}
            description={strategy.description}
            selected={selected === strategy.id}
            onSelect={() => onSelect(strategy.id)}
          />
        ))}
      </div>
    </fieldset>
  )
}

export function RenderStrategyPicker() {
  const form = useWizardForm()
  const renderStrategy = useStore(form.store, (s) => s.values.renderStrategy)

  function handleSelect(id: RenderStrategyId) {
    form.setFieldValue("renderStrategy", id)
  }

  return (
    <div className="flex w-full max-w-[33.8rem] flex-col gap-2">
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium leading-[14px] text-[#0a0a0a]">
          Render Strategy
        </span>
        <span className="text-sm font-medium leading-[14px] text-[#ef4444]" aria-hidden>
          *
        </span>
      </div>
      <div className="flex flex-col gap-5">
        <CategoryGroup category="ai" selected={renderStrategy} onSelect={handleSelect} />
        <CategoryGroup category="template" selected={renderStrategy} onSelect={handleSelect} />
      </div>
    </div>
  )
}
