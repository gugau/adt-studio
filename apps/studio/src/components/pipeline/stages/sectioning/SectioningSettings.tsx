import { useState, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "@tanstack/react-router"
import { Play, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PruneToggle } from "@/components/pipeline/components/PruneToggle"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useBookConfig, useUpdateBookConfig } from "@/hooks/use-book-config"
import { useActiveConfig } from "@/hooks/use-debug"
import { useApiKey } from "@/hooks/use-api-key"
import { api } from "@/api/client"
import { PromptViewer } from "@/components/pipeline/components/PromptViewer"
import { useBookRun } from "@/hooks/use-book-run"
import { useStepConfig } from "@/hooks/use-step-config"
import { Trans } from "@lingui/react/macro"
import { msg } from "@lingui/core/macro"
import { useLingui } from "@lingui/react/macro"
import { i18n } from "@lingui/core"
import { listSelectableRenderStrategies } from "@/lib/render-strategy"
import { getSectionTypeLabel } from "@/lib/section-constants"

const STRATEGY_LABEL_MSGS: Record<string, ReturnType<typeof msg>> = {
  llm: msg`AI Generated`,
  "llm-overlay": msg`AI Overlay`,
}

function titleCase(slug: string): string {
  return slug.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

function strategyDisplayName(slug: string): string {
  const descriptor = STRATEGY_LABEL_MSGS[slug]
  if (descriptor) return i18n._(descriptor)
  return titleCase(slug.replace(/_/g, " "))
}

function getSectionTypeDisplayLabel(value: string): string {
  const label = getSectionTypeLabel(value)
  return label || value.replace(/_/g, " ")
}

export function SectioningSettings({ bookLabel, headerTarget, tab = "general" }: { bookLabel: string; headerTarget?: HTMLDivElement | null; tab?: string }) {
  const { t } = useLingui()
  const { data: bookConfigData } = useBookConfig(bookLabel)
  const { data: activeConfigData } = useActiveConfig(bookLabel)
  const updateConfig = useUpdateBookConfig()
  const { apiKey, hasApiKey } = useApiKey()
  const { queueRun } = useBookRun()
  const navigate = useNavigate()
  const [showRerunDialog, setShowRerunDialog] = useState(false)

  // Section Types state
  const [sectionTypes, setSectionTypes] = useState<Record<string, string>>({})
  const [prunedSectionTypes, setPrunedSectionTypes] = useState<Set<string>>(new Set())
  const [disabledSectionTypes, setDisabledSectionTypes] = useState<Set<string>>(new Set())
  const [sectionRenderStrategies, setSectionRenderStrategies] = useState<Record<string, string>>({})
  const [allStrategyNames, setAllStrategyNames] = useState<string[]>([])

  // Structure Types state
  const [structureTypes, setStructureTypes] = useState<Record<string, string>>({})
  // Text (role) Types state
  const [roleTypes, setRoleTypes] = useState<Record<string, string>>({})

  // Sectioning state
  const [sectioningMode, setSectioningMode] = useState("dynamic")
  const [maxRefinements, setMaxRefinements] = useState("")
  const [sectioningPromptDraft, setSectioningPromptDraft] = useState<string | null>(null)

  // Track dirty state
  const [dirty, setDirty] = useState<Record<string, boolean>>({})
  const markDirty = (field: string) => setDirty((prev) => ({ ...prev, [field]: true }))

  const merged = activeConfigData?.merged as Record<string, unknown> | undefined
  const sectioning = useStepConfig(merged, "page_sectioning", markDirty)

  // Load from merged config
  useEffect(() => {
    if (!activeConfigData) return
    const m = activeConfigData.merged as Record<string, unknown>
    if (m.section_types && typeof m.section_types === "object") {
      setSectionTypes(m.section_types as Record<string, string>)
    }
    if (Array.isArray(m.pruned_section_types)) {
      setPrunedSectionTypes(new Set(m.pruned_section_types as string[]))
    }
    if (Array.isArray(m.disabled_section_types)) {
      setDisabledSectionTypes(new Set(m.disabled_section_types as string[]))
    }
    if (m.section_render_strategies && typeof m.section_render_strategies === "object") {
      setSectionRenderStrategies(m.section_render_strategies as Record<string, string>)
    }
    if (m.structure_types && typeof m.structure_types === "object") {
      setStructureTypes(m.structure_types as Record<string, string>)
    }
    if (m.role_types && typeof m.role_types === "object") {
      setRoleTypes(m.role_types as Record<string, string>)
    }
    const strategies = (
      m.render_strategies && typeof m.render_strategies === "object" ? m.render_strategies : {}
    ) as Record<string, { render_type?: string; config?: Record<string, unknown> }>
    setAllStrategyNames(listSelectableRenderStrategies(strategies))

    if (m.page_sectioning && typeof m.page_sectioning === "object") {
      const ps = m.page_sectioning as Record<string, unknown>
      if (ps.mode) setSectioningMode(String(ps.mode))
      setMaxRefinements(ps.max_refinements != null ? String(ps.max_refinements) : "")
    }
  }, [activeConfigData])

  // Section Types handlers
  const [newTypeKey, setNewTypeKey] = useState("")
  const [newTypeDesc, setNewTypeDesc] = useState("")

  const togglePruned = (key: string) => {
    markDirty("pruned_section_types")
    setPrunedSectionTypes((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const updateSectionDescription = (key: string, description: string) => {
    markDirty("section_types")
    setSectionTypes((prev) => ({ ...prev, [key]: description }))
  }

  const updateRenderOverride = (key: string, strategy: string) => {
    markDirty("section_render_strategies")
    setSectionRenderStrategies((prev) => {
      if (!strategy) {
        const next = { ...prev }
        delete next[key]
        return next
      }
      return { ...prev, [key]: strategy }
    })
  }

  const toggleDisabled = (key: string) => {
    markDirty("disabled_section_types")
    setDisabledSectionTypes((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const addSectionType = () => {
    const key = newTypeKey.trim().toLowerCase().replace(/\s+/g, "_")
    if (!key || key in sectionTypes) return
    markDirty("section_types")
    setSectionTypes((prev) => ({ ...prev, [key]: newTypeDesc.trim() }))
    setNewTypeKey("")
    setNewTypeDesc("")
  }

  // Structure Types handlers
  const [newStructKey, setNewStructKey] = useState("")
  const [newStructDesc, setNewStructDesc] = useState("")

  const updateStructureDescription = (key: string, description: string) => {
    markDirty("structure_types")
    setStructureTypes((prev) => ({ ...prev, [key]: description }))
  }

  const removeStructureType = (key: string) => {
    markDirty("structure_types")
    setStructureTypes((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const addStructureType = () => {
    const key = newStructKey.trim().toLowerCase().replace(/\s+/g, "_")
    if (!key || key in structureTypes) return
    markDirty("structure_types")
    setStructureTypes((prev) => ({ ...prev, [key]: newStructDesc.trim() }))
    setNewStructKey("")
    setNewStructDesc("")
  }

  // Text (role) Types handlers
  const [newRoleKey, setNewRoleKey] = useState("")
  const [newRoleDesc, setNewRoleDesc] = useState("")

  const updateRoleDescription = (key: string, description: string) => {
    markDirty("role_types")
    setRoleTypes((prev) => ({ ...prev, [key]: description }))
  }

  const removeRoleType = (key: string) => {
    markDirty("role_types")
    setRoleTypes((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const addRoleType = () => {
    const key = newRoleKey.trim().toLowerCase().replace(/\s+/g, "_")
    if (!key || key in roleTypes) return
    markDirty("role_types")
    setRoleTypes((prev) => ({ ...prev, [key]: newRoleDesc.trim() }))
    setNewRoleKey("")
    setNewRoleDesc("")
  }

  const shouldWrite = (field: string) =>
    dirty[field] || (bookConfigData?.config && field in bookConfigData.config)

  const buildOverrides = () => {
    const overrides: Record<string, unknown> = {}
    const m = (activeConfigData?.merged as Record<string, unknown> | undefined)

    if (bookConfigData?.config) {
      Object.assign(overrides, bookConfigData.config)
    }

    if (shouldWrite("section_types")) {
      const baseSectionTypes = (m?.section_types ?? {}) as Record<string, string>
      const withDeletions: Record<string, string | null> = { ...sectionTypes }
      for (const key of Object.keys(baseSectionTypes)) {
        if (!(key in sectionTypes)) withDeletions[key] = null
      }
      overrides.section_types = withDeletions
    }
    if (shouldWrite("pruned_section_types")) {
      overrides.pruned_section_types = Array.from(prunedSectionTypes)
    }
    if (shouldWrite("disabled_section_types")) {
      overrides.disabled_section_types = Array.from(disabledSectionTypes)
    }
    if (shouldWrite("section_render_strategies")) {
      const baseStrategies = (m?.section_render_strategies ?? {}) as Record<string, string>
      const stratWithDeletions: Record<string, string | null> = { ...sectionRenderStrategies }
      for (const key of Object.keys(baseStrategies)) {
        if (!(key in sectionRenderStrategies)) stratWithDeletions[key] = null
      }
      overrides.section_render_strategies = Object.keys(stratWithDeletions).length > 0
        ? stratWithDeletions
        : undefined
    }
    if (shouldWrite("structure_types")) {
      const baseStructureTypes = (m?.structure_types ?? {}) as Record<string, string>
      const withDeletions: Record<string, string | null> = { ...structureTypes }
      for (const key of Object.keys(baseStructureTypes)) {
        if (!(key in structureTypes)) withDeletions[key] = null
      }
      overrides.structure_types = withDeletions
    }
    if (shouldWrite("role_types")) {
      const baseRoleTypes = (m?.role_types ?? {}) as Record<string, string>
      const withDeletions: Record<string, string | null> = { ...roleTypes }
      for (const key of Object.keys(baseRoleTypes)) {
        if (!(key in roleTypes)) withDeletions[key] = null
      }
      overrides.role_types = withDeletions
    }
    if (shouldWrite("page_sectioning") || shouldWrite("max_refinements")) {
      const existing = (bookConfigData?.config?.page_sectioning ?? {}) as Record<string, unknown>
      const ps: Record<string, unknown> = { ...existing, ...sectioning.configOverrides, mode: sectioningMode }
      if (shouldWrite("max_refinements")) {
        ps.max_refinements = maxRefinements.trim() ? Number(maxRefinements) : undefined
      }
      overrides.page_sectioning = ps
    }

    return overrides
  }

  const confirmSaveAndRerun = async () => {
    if (sectioningPromptDraft != null) {
      await api.updatePrompt("page_sectioning", sectioningPromptDraft, bookLabel)
    }

    const overrides = buildOverrides()
    updateConfig.mutate(
      { label: bookLabel, config: overrides },
      {
        onSuccess: () => {
          setDirty({})
          setSectioningPromptDraft(null)
          setShowRerunDialog(false)
          queueRun({ fromStage: "sectioning", toStage: "storyboard", apiKey })
          navigate({ to: "/books/$label/$step", params: { label: bookLabel, step: "sectioning" } })
        },
      }
    )
  }

  const orderedStructureEntries = useMemo(
    () => Object.entries(structureTypes).sort(([a], [b]) => a.localeCompare(b)),
    [structureTypes]
  )

  const orderedRoleEntries = useMemo(
    () => Object.entries(roleTypes).sort(([a], [b]) => a.localeCompare(b)),
    [roleTypes]
  )

  return (
    <div className={tab === "section-refinement" ? "h-full" : "p-4 space-y-6"}>
      {tab === "general" && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            {<Trans>Section Types</Trans>}
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            {<Trans>Types used during page sectioning. Pruned types are classified but excluded from rendering. Disabled types are hidden from the LLM entirely.</Trans>}
          </p>
          <div className="rounded-md border divide-y">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50">
              <span className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs font-medium text-muted-foreground shrink-0 w-40">{<Trans>Type</Trans>}</span>
              <span className="text-xs font-medium text-muted-foreground flex-1 min-w-0">{<Trans>Description</Trans>}</span>
              <span className="text-xs font-medium text-muted-foreground shrink-0 w-48 text-left">{<Trans>Render Strategy</Trans>}</span>
              <span className="shrink-0 w-5" />
            </div>
            {Object.entries(sectionTypes).map(([key, description]) => {
              const pruned = prunedSectionTypes.has(key)
              const disabled = disabledSectionTypes.has(key)
              const renderOverride = sectionRenderStrategies[key] ?? ""
              return (
                <div
                  key={key}
                  className={`flex items-center gap-2 px-3 py-1.5 group ${disabled ? "opacity-50" : pruned ? "bg-muted/30" : ""}`}
                >
                  <PruneToggle pruned={pruned} onToggle={() => togglePruned(key)} />
                  <span className={`text-xs shrink-0 w-40 truncate font-mono ${disabled ? "text-muted-foreground line-through" : pruned ? "text-muted-foreground line-through" : "font-medium"}`}>
                    {getSectionTypeDisplayLabel(key)}
                  </span>
                  <Input
                    value={description}
                    onChange={(e) => updateSectionDescription(key, e.target.value)}
                    className="h-7 text-xs flex-1 min-w-0"
                    placeholder={t`Description...`}
                  />
                  <Select
                    value={renderOverride || "__default__"}
                    onValueChange={(v) => updateRenderOverride(key, v === "__default__" ? "" : v)}
                  >
                    <SelectTrigger className="h-7 w-48 shrink-0 text-xs text-left">
                      <SelectValue>
                        {renderOverride ? strategyDisplayName(renderOverride) : <Trans>Default</Trans>}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent align="start">
                      <SelectItem value="__default__">
                        <span className="text-muted-foreground">{<Trans>Default</Trans>}</span>
                      </SelectItem>
                      {allStrategyNames.map((name) => (
                        <SelectItem key={name} value={name}>
                          {strategyDisplayName(name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    onClick={() => toggleDisabled(key)}
                    className={`shrink-0 p-0.5 rounded transition-colors ${disabled ? "text-amber-500 hover:text-amber-600" : "text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-destructive"}`}
                    title={disabled ? t`Re-enable type` : t`Disable type`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
            <div className="flex items-center gap-2 px-3 py-1.5">
              <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <Input
                value={newTypeKey}
                onChange={(e) => setNewTypeKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSectionType()}
                className="h-7 text-xs w-40 shrink-0"
                placeholder={t`new_type_key`}
              />
              <Input
                value={newTypeDesc}
                onChange={(e) => setNewTypeDesc(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSectionType()}
                className="h-7 text-xs flex-1 min-w-0"
                placeholder={t`Description...`}
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs shrink-0"
                onClick={addSectionType}
                disabled={!newTypeKey.trim() || newTypeKey.trim().toLowerCase().replace(/\s+/g, "_") in sectionTypes}
              >
                {<Trans>Add</Trans>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {tab === "section-refinement" && (
        <div className="flex flex-col h-full">
          <div className="shrink-0 p-4 pb-0 space-y-4">
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                {<Trans>Sectioning Mode</Trans>}
              </h3>
              <Select
                value={sectioningMode}
                onValueChange={(v) => {
                  setSectioningMode(v)
                  markDirty("page_sectioning")
                }}
              >
                <SelectTrigger className="w-72 h-fit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="dynamic">
                    <div className="flex flex-col items-start">
                      <span>{<Trans>Dynamic</Trans>}</span>
                      <span className="text-xs text-muted-foreground">
                        {<Trans>Keeps pages whole unless mixed activity types require splitting</Trans>}
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="section">
                    <div className="flex flex-col items-start">
                      <span>{<Trans>By Section</Trans>}</span>
                      <span className="text-xs text-muted-foreground">
                        {<Trans>Groups content into logical sections</Trans>}
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="page">
                    <div className="flex flex-col items-start">
                      <span>{<Trans>By Page</Trans>}</span>
                      <span className="text-xs text-muted-foreground">
                        {<Trans>Treats each page as a single section</Trans>}
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1.5">
                {<Trans>Controls how page content is grouped during the sectioning step.</Trans>}
              </p>
            </div>

            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                {<Trans>Max Refinements</Trans>}
              </h3>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={10}
                  step={1}
                  value={maxRefinements}
                  onChange={(e) => {
                    setMaxRefinements(e.target.value)
                    markDirty("max_refinements")
                  }}
                  placeholder="0"
                  className="h-9 w-24 text-sm"
                />
                <Label className="text-xs text-muted-foreground">
                  {<Trans>0 = single pass, higher values allow iterative LLM refinement</Trans>}
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {<Trans>Number of refinement iterations performed after the initial sectioning pass.</Trans>}
              </p>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <PromptViewer
              promptName="page_sectioning"
              bookLabel={bookLabel}
              title={t`Page Sectioning Prompt`}
              description={t`The prompt template used to split each page into logical sections. This is a Liquid template processed with page context.`}
              model={sectioning.model}
              onModelChange={sectioning.onModelChange}
              maxRetries={sectioning.maxRetries}
              onMaxRetriesChange={sectioning.onMaxRetriesChange}
              onContentChange={setSectioningPromptDraft}
            />
          </div>
        </div>
      )}

      {tab === "structure-types" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              {<Trans>Structure Types</Trans>}
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              {<Trans>Container node types the LLM may produce in the content tree during sectioning. Each type has a description shown to the model.</Trans>}
            </p>
            <div className="rounded-md border divide-y">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50">
                <span className="text-xs font-medium text-muted-foreground shrink-0 w-40">{<Trans>Type</Trans>}</span>
                <span className="text-xs font-medium text-muted-foreground flex-1 min-w-0">{<Trans>Description</Trans>}</span>
                <span className="shrink-0 w-5" />
              </div>
              {orderedStructureEntries.map(([key, description]) => (
                <div key={key} className="flex items-center gap-2 px-3 py-1.5 group">
                  <span className="text-xs shrink-0 w-40 truncate font-mono font-medium">{key}</span>
                  <Input
                    value={description}
                    onChange={(e) => updateStructureDescription(key, e.target.value)}
                    className="h-7 text-xs flex-1 min-w-0"
                    placeholder={t`Description...`}
                  />
                  <button
                    type="button"
                    onClick={() => removeStructureType(key)}
                    className="shrink-0 p-0.5 rounded transition-colors text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-destructive"
                    title={t`Remove type`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 px-3 py-1.5">
                <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <Input
                  value={newStructKey}
                  onChange={(e) => setNewStructKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addStructureType()}
                  className="h-7 text-xs w-36 shrink-0"
                  placeholder={t`new_type_key`}
                />
                <Input
                  value={newStructDesc}
                  onChange={(e) => setNewStructDesc(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addStructureType()}
                  className="h-7 text-xs flex-1 min-w-0"
                  placeholder={t`Description...`}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs shrink-0"
                  onClick={addStructureType}
                  disabled={!newStructKey.trim() || newStructKey.trim().toLowerCase().replace(/\s+/g, "_") in structureTypes}
                >
                  {<Trans>Add</Trans>}
                </Button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              {<Trans>Text Types</Trans>}
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              {<Trans>Leaf node roles the LLM may assign to text and image leaves in the content tree. Each role has a description shown to the model.</Trans>}
            </p>
            <div className="rounded-md border divide-y">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50">
                <span className="text-xs font-medium text-muted-foreground shrink-0 w-40">{<Trans>Type</Trans>}</span>
                <span className="text-xs font-medium text-muted-foreground flex-1 min-w-0">{<Trans>Description</Trans>}</span>
                <span className="shrink-0 w-5" />
              </div>
              {orderedRoleEntries.map(([key, description]) => (
                <div key={key} className="flex items-center gap-2 px-3 py-1.5 group">
                  <span className="text-xs shrink-0 w-40 truncate font-mono font-medium">{key}</span>
                  <Input
                    value={description}
                    onChange={(e) => updateRoleDescription(key, e.target.value)}
                    className="h-7 text-xs flex-1 min-w-0"
                    placeholder={t`Description...`}
                  />
                  <button
                    type="button"
                    onClick={() => removeRoleType(key)}
                    className="shrink-0 p-0.5 rounded transition-colors text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-destructive"
                    title={t`Remove type`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 px-3 py-1.5">
                <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <Input
                  value={newRoleKey}
                  onChange={(e) => setNewRoleKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addRoleType()}
                  className="h-7 text-xs w-36 shrink-0"
                  placeholder={t`new_type_key`}
                />
                <Input
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addRoleType()}
                  className="h-7 text-xs flex-1 min-w-0"
                  placeholder={t`Description...`}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs shrink-0"
                  onClick={addRoleType}
                  disabled={!newRoleKey.trim() || newRoleKey.trim().toLowerCase().replace(/\s+/g, "_") in roleTypes}
                >
                  {<Trans>Add</Trans>}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {headerTarget && createPortal(
        <Button
          size="sm"
          className="h-7 px-2.5 text-xs bg-black/15 text-white hover:bg-black/25"
          onClick={() => setShowRerunDialog(true)}
          disabled={updateConfig.isPending || !hasApiKey}
        >
          <Play className="mr-1.5 h-3.5 w-3.5" />
          {<Trans>Save & Rerun</Trans>}
        </Button>,
        headerTarget
      )}

      <Dialog open={showRerunDialog} onOpenChange={setShowRerunDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{<Trans>Save & Rerun Sectioning</Trans>}</DialogTitle>
            <DialogDescription>
              {<Trans>This will save your settings and re-run sectioning and storyboard rendering for all pages.</Trans>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRerunDialog(false)}>
              {<Trans>Cancel</Trans>}
            </Button>
            <Button onClick={confirmSaveAndRerun} disabled={updateConfig.isPending}>
              {updateConfig.isPending ? t`Saving...` : t`Confirm Rerun`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
