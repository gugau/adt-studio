import { useState } from "react"
import { Check, ChevronsUpDown, Filter, X } from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { getStageLabelI18n } from "@/components/pipeline/pipeline-i18n"
import type { PipelineStageDefinition } from "@/components/pipeline/stage-config"

const MAX_VISIBLE_FILTER_BADGES = 3

interface StageFilterComboboxProps {
  pipelineStages: readonly PipelineStageDefinition[]
  selectedStages: Set<string>
  onToggle: (slug: string) => void
  onClear: () => void
}

export function StageFilterCombobox({
  pipelineStages,
  selectedStages,
  onToggle,
  onClear,
}: StageFilterComboboxProps) {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  const hasActiveFilter = selectedStages.size > 0
  const selectedCount = selectedStages.size

  const selectedStageDefs = pipelineStages.filter((s) =>
    selectedStages.has(s.slug),
  )
  const visibleSelected = selectedStageDefs.slice(0, MAX_VISIBLE_FILTER_BADGES)
  const overflowCount = selectedStageDefs.length - visibleSelected.length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          role="combobox"
          aria-expanded={open}
          aria-label={t`Filter books by completed stage`}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              setOpen((prev) => !prev)
            }
          }}
          className="flex h-8 min-w-[160px] cursor-pointer items-center justify-between gap-1.5 rounded-md border border-input bg-background px-2 text-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {hasActiveFilter ? (
            <span className="flex flex-1 flex-wrap items-center gap-1">
              {visibleSelected.map((stage) => {
                const Icon = stage.icon
                const label = getStageLabelI18n(stage.slug)
                return (
                  <span
                    key={stage.slug}
                    className={`inline-flex items-center gap-1 rounded-full border py-0.5 pl-1.5 pr-0.5 text-[10px] font-medium transition-colors ${stage.bgLight} ${stage.textColor} ${stage.borderColor}`}
                  >
                    <Icon className="h-2.5 w-2.5" />
                    {label}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        onToggle(stage.slug)
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      aria-label={t`Remove ${label} filter`}
                      className="ml-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/10 dark:hover:bg-white/20"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                )
              })}
              {overflowCount > 0 && (
                <span className="inline-flex items-center rounded-full border border-dashed border-muted-foreground/40 bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  +{overflowCount}
                </span>
              )}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <Trans>Filter stages</Trans>
            </span>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </div>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <Command>
          <CommandInput placeholder={t`Search stages...`} className="text-xs" />
          <CommandList>
            <CommandEmpty>
              <Trans>No stages found.</Trans>
            </CommandEmpty>
            <CommandGroup>
              {pipelineStages.map((stage) => {
                const Icon = stage.icon
                const label = getStageLabelI18n(stage.slug)
                const isSelected = selectedStages.has(stage.slug)
                return (
                  <CommandItem
                    key={stage.slug}
                    value={`${stage.slug} ${label}`}
                    onSelect={() => onToggle(stage.slug)}
                    className="gap-2 text-xs"
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${stage.color} text-white`}
                    >
                      <Icon className="h-3 w-3" />
                    </span>
                    <span className="flex-1 truncate font-medium">{label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
          <div className="flex items-center justify-between border-t px-2 py-1.5">
            <span className="text-[10px] text-muted-foreground">
              {selectedCount > 0 ? (
                <Trans>{selectedCount} selected</Trans>
              ) : (
                <Trans>Select stages to filter</Trans>
              )}
            </span>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={onClear}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3 w-3" />
                <Trans>Clear</Trans>
              </button>
            )}
          </div>
          <p className="border-t px-2 py-1.5 text-[10px] text-muted-foreground">
            <Trans>Books must have all selected stages completed.</Trans>
          </p>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
