import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import {
  api,
  type ActivityGenerationMode,
  type ActivityTemplate,
  type ActivityTemplateStyle,
  type QuizActivityType,
  type StageRunProviderCredentials,
} from "@/api/client"
import { usePages } from "@/hooks/use-pages"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useLingui } from "@lingui/react/macro"
import { SelectQuizPagesDialog } from "./SelectQuizPagesDialog"

const ACTIVITY_OPTIONS: QuizActivityType[] = [
  "multiple_choice",
  "multiple_select",
  "true_false",
  "fill_in_the_blank",
  "open_ended",
  "drag_and_drop",
  "sorting",
]

const BUILT_IN_TEMPLATE_STYLES: ActivityTemplateStyle[] = [
  "worksheet_rows",
  "practice_cards",
  "quick_check",
  "guided_steps",
]

const DEFAULT_ACTIVITY_TEMPLATES: ActivityTemplate[] = [
  {
    id: "worksheet-rows",
    name: "Worksheet rows",
    style: "worksheet_rows",
    generationMode: "template_single_page",
    instructions: "Use a clean worksheet layout with clear rows, simple labels, and restrained spacing.",
  },
  {
    id: "practice-cards",
    name: "Practice cards",
    style: "practice_cards",
    generationMode: "template_single_page",
    instructions: "Use four answer cards with friendly spacing, short standalone choices, and encouraging feedback.",
  },
  {
    id: "quick-check",
    name: "Quick check",
    style: "quick_check",
    generationMode: "template_single_page",
    instructions: "Use a compact review layout for many short questions with minimal decoration.",
  },
  {
    id: "step-by-step",
    name: "Step by step",
    style: "guided_steps",
    generationMode: "template_multi_step",
    instructions: "Use a guided sequence with numbered steps and one clear task per step.",
  },
]

function templateStorageKey(bookLabel: string): string {
  return `adt.activityTemplates.${bookLabel}`
}

function loadSavedTemplates(bookLabel: string): ActivityTemplate[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(templateStorageKey(bookLabel))
    if (!raw) return []
    const parsed = JSON.parse(raw) as ActivityTemplate[]
    return Array.isArray(parsed) ? parsed.filter((template) => template.name && template.style) : []
  } catch {
    return []
  }
}

function saveTemplates(bookLabel: string, templates: ActivityTemplate[]): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(templateStorageKey(bookLabel), JSON.stringify(templates))
}

function normalizedTemplateStyle(style: ActivityTemplateStyle): ActivityTemplateStyle {
  switch (style) {
    case "clean_workbook":
      return "worksheet_rows"
    case "card_practice":
      return "practice_cards"
    case "compact_review":
      return "quick_check"
    default:
      return style
  }
}

export function QuizzesLandingConfig({
  bookLabel,
  apiKey,
  hasApiKey,
  providerCredentials,
  initialSelectedPageId,
  open,
  onOpenChange,
}: {
  bookLabel: string
  apiKey: string
  hasApiKey: boolean
  providerCredentials?: StageRunProviderCredentials
  initialSelectedPageId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const pagesQuery = usePages(bookLabel)
  const [activityType, setActivityType] = useState<QuizActivityType>("multiple_choice")
  const [questionsPerQuiz, setQuestionsPerQuiz] = useState("1")
  type SourceMode = "every_n" | "select"
  type PlacementMode = "after_source" | "end_of_book" | "specific"
  const [sourceMode, setSourceMode] = useState<SourceMode>(
    initialSelectedPageId ? "select" : "every_n"
  )
  const [everyN, setEveryN] = useState("3")
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>(
    initialSelectedPageId ? [initialSelectedPageId] : []
  )
  const [showPagePicker, setShowPagePicker] = useState(false)
  const [placementMode, setPlacementMode] = useState<PlacementMode>("after_source")
  const [placementPageId, setPlacementPageId] = useState("")
  const [replaceExisting, setReplaceExisting] = useState(true)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedTemplates, setSavedTemplates] = useState<ActivityTemplate[]>(() => loadSavedTemplates(bookLabel))
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_ACTIVITY_TEMPLATES[0].id!)
  const [templateName, setTemplateName] = useState(DEFAULT_ACTIVITY_TEMPLATES[0].name)
  const [templateStyle, setTemplateStyle] = useState<ActivityTemplateStyle>(DEFAULT_ACTIVITY_TEMPLATES[0].style)
  const [generationMode, setGenerationMode] = useState<ActivityGenerationMode>(DEFAULT_ACTIVITY_TEMPLATES[0].generationMode)
  const [templateInstructions, setTemplateInstructions] = useState(DEFAULT_ACTIVITY_TEMPLATES[0].instructions ?? "")
  const [templateNotice, setTemplateNotice] = useState<string | null>(null)
  const appliedInitialPageIdRef = useRef<string | null>(null)

  const pages = pagesQuery.data ?? []
  const contentPageIds = useMemo(
    () => pages.filter((page) => page.sectionCount > page.prunedSections.length).map((p) => p.pageId),
    [pages]
  )
  const lastBookPageId = pages.length > 0 ? pages[pages.length - 1].pageId : ""
  const allTemplates = [...DEFAULT_ACTIVITY_TEMPLATES, ...savedTemplates]
  const selectedTemplate: ActivityTemplate = {
    id: selectedTemplateId,
    name: templateName.trim() || t`Untitled template`,
    style: normalizedTemplateStyle(templateStyle),
    generationMode,
    ...(templateInstructions.trim() ? { instructions: templateInstructions.trim() } : {}),
  }

  // Auto-select the page the user came from (if any) the first time.
  useEffect(() => {
    if (!initialSelectedPageId) return
    if (appliedInitialPageIdRef.current === initialSelectedPageId) return
    appliedInitialPageIdRef.current = initialSelectedPageId
    setSelectedPageIds([initialSelectedPageId])
    setSourceMode("select")
  }, [initialSelectedPageId])

  const activityTypeLabel = (value: QuizActivityType) => {
    switch (value) {
      case "multiple_select":
        return t`Multiple Select Quiz`
      case "true_false":
        return t`True or False Quiz`
      case "fill_in_the_blank":
        return t`Fill in the Blanks`
      case "open_ended":
        return t`Open-Ended Question`
      case "drag_and_drop":
        return t`Matching Pairs`
      case "sorting":
        return t`Sort into Groups`
      case "multiple_choice":
      default:
        return t`Multiple Choice Quiz`
    }
  }

  const templateStyleLabel = (value: ActivityTemplateStyle) => {
    switch (value) {
      case "worksheet_rows":
        return t`Worksheet rows`
      case "practice_cards":
        return t`Practice cards`
      case "quick_check":
        return t`Quick check`
      case "guided_steps":
        return t`Step by step`
      case "card_practice":
        return t`Practice cards`
      case "compact_review":
        return t`Quick check`
      case "clean_workbook":
      default:
        return t`Worksheet rows`
    }
  }

  const generationModeLabel = (value: ActivityGenerationMode) => {
    switch (value) {
      case "template_multi_step":
        return t`Step by step`
      case "ai_generated_layout":
        return t`AI-generated layout`
      case "template_single_page":
      default:
        return t`One activity page`
    }
  }

  const selectTemplate = (templateId: string) => {
    const template = allTemplates.find((candidate) => candidate.id === templateId)
    if (!template) return
    setSelectedTemplateId(template.id ?? templateId)
    setTemplateName(template.name)
    setTemplateStyle(template.style)
    setGenerationMode(template.generationMode)
    setTemplateInstructions(template.instructions ?? "")
    if (template.generationMode === "template_multi_step") {
      setQuestionsPerQuiz((current) => {
        const parsed = Number(current)
        return Number.isFinite(parsed) && parsed > 1 ? current : "3"
      })
    }
    setTemplateNotice(null)
  }

  const saveTemplate = () => {
    const template: ActivityTemplate = {
      ...selectedTemplate,
      id: selectedTemplate.id?.startsWith("custom-") ? selectedTemplate.id : `custom-${Date.now()}`,
    }
    const next = [
      ...savedTemplates.filter((candidate) => candidate.id !== template.id),
      template,
    ]
    setSavedTemplates(next)
    saveTemplates(bookLabel, next)
    setSelectedTemplateId(template.id!)
    setTemplateNotice(t`Template saved for this book`)
  }

  function resolveInsertAfter(batchPageIds: string[]): string {
    if (placementMode === "end_of_book") return lastBookPageId
    if (placementMode === "specific") return placementPageId || lastBookPageId
    return batchPageIds[batchPageIds.length - 1] ?? ""
  }

  const handleGenerate = async () => {
    if (!hasApiKey || generating) return
    const n = Math.max(1, Math.floor(Number(everyN) || 3))
    const groups: string[][] = []
    if (sourceMode === "every_n") {
      for (let i = 0; i < contentPageIds.length; i += n) {
        groups.push(contentPageIds.slice(i, i + n))
      }
    } else if (selectedPageIds.length > 0) {
      groups.push(selectedPageIds)
    }
    if (groups.length === 0) {
      setError(t`Pick at least one page to base the activity on.`)
      return
    }
    setGenerating(true)
    setError(null)
    setProgress({ done: 0, total: groups.length })
    try {
      for (let i = 0; i < groups.length; i++) {
        const pageIds = groups[i]
        await api.generateQuizzes(
          bookLabel,
          apiKey,
          {
            pageIds,
            activityType,
            template: selectedTemplate,
            insertAfterPageId: resolveInsertAfter(pageIds) || undefined,
            questionsPerQuiz: Math.min(20, Math.max(1, Number(questionsPerQuiz) || 1)),
            replaceExistingForPages: replaceExisting,
          },
          providerCredentials
        )
        setProgress({ done: i + 1, total: groups.length })
      }
      await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "quizzes"] })
      await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "debug"] })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(false)
      setProgress(null)
    }
  }

  const selectedCount = selectedPageIds.length
  const selectedPageNumbers = selectedPageIds
    .map((id) => pages.find((p) => p.pageId === id)?.pageNumber)
    .filter((n): n is number => typeof n === "number")
    .sort((a, b) => a - b)
  const selectedSummary = selectedPageNumbers.length === 0
    ? null
    : selectedPageNumbers.length === 1
      ? t`Page ${String(selectedPageNumbers[0])}`
      : t`Pages ${String(selectedPageNumbers[0])} – ${String(selectedPageNumbers[selectedPageNumbers.length - 1])} (${String(selectedPageNumbers.length)} total)`

  const isValid =
    (sourceMode === "every_n" && contentPageIds.length > 0 && Number(everyN) >= 1) ||
    (sourceMode === "select" && selectedCount > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-orange-600" />
            {t`Add an activity`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sentence-style form */}
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t`Activity type`}</span>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value as QuizActivityType)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {ACTIVITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {activityTypeLabel(option)}
                  </option>
                ))}
              </select>
            </label>

            {/* Source pages — segmented control */}
            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">{t`Source pages`}</span>
              <div className="flex rounded-md border overflow-hidden w-full">
                <button
                  type="button"
                  onClick={() => setSourceMode("every_n")}
                  className={`flex-1 px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                    sourceMode === "every_n"
                      ? "bg-orange-600 text-white"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  {t`Every N pages`}
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode("select")}
                  className={`flex-1 px-3 py-1.5 text-xs cursor-pointer transition-colors border-l ${
                    sourceMode === "select"
                      ? "bg-orange-600 text-white"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  {t`Select pages`}
                </button>
              </div>

              {sourceMode === "every_n" && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">{t`Add an activity every`}</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={everyN}
                    onChange={(e) => setEveryN(e.target.value)}
                    className="h-8 w-16 rounded-md border border-input bg-background px-2 text-center text-sm"
                  />
                  <span className="text-xs text-muted-foreground">
                    {Number(everyN) === 1 ? t`page` : t`pages`}
                  </span>
                </div>
              )}

              {sourceMode === "select" && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPagePicker(true)}
                    className="h-8 rounded-md border border-input bg-background px-3 text-xs font-medium transition-colors hover:bg-muted/60"
                  >
                    {selectedCount > 0 ? t`Edit selection…` : t`Choose pages…`}
                  </button>
                  {selectedSummary && (
                    <span className="text-[11px] text-muted-foreground">{selectedSummary}</span>
                  )}
                </div>
              )}
            </div>

            {/* Placement */}
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t`Place quiz`}</span>
              <select
                value={placementMode}
                onChange={(e) => setPlacementMode(e.target.value as PlacementMode)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="after_source">{t`On the next page after the source pages`}</option>
                <option value="end_of_book">{t`At the end of the book`}</option>
                <option value="specific">{t`Choose a specific page…`}</option>
              </select>
              {placementMode === "specific" && (
                <select
                  value={placementPageId}
                  onChange={(e) => setPlacementPageId(e.target.value)}
                  className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">{t`— pick a page —`}</option>
                  {pages.map((page) => (
                    <option key={page.pageId} value={page.pageId}>
                      {t`Page ${String(page.pageNumber)}`}
                    </option>
                  ))}
                </select>
              )}
            </label>
          </div>

          {/* Advanced — progressive disclosure */}
          <details className="rounded-md border bg-muted/20">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium">
              {t`Advanced`}
            </summary>
            <div className="space-y-4 px-3 pb-3 pt-1">
              <label className="block space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {t`Questions per quiz`}
                </span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={questionsPerQuiz}
                  onChange={(e) => setQuestionsPerQuiz(e.target.value)}
                  className="h-8 w-32 rounded border border-input bg-background px-2 text-xs"
                />
              </label>

              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="h-3.5 w-3.5 accent-orange-600"
                />
                {t`Replace existing activities for selected pages`}
              </label>

              {/* Template / layout — collapsed by default */}
              <details className="rounded-md border bg-background">
                <summary className="cursor-pointer px-3 py-2 text-[11px] font-medium text-muted-foreground">
                  {t`Layout style (advanced)`}
                </summary>
                <div className="space-y-3 px-3 pb-3 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex h-8 items-center gap-2 rounded border border-input bg-background px-2 text-xs">
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {t`Layout`}
                      </span>
                      <select
                        value={normalizedTemplateStyle(templateStyle)}
                        onChange={(e) => {
                          setTemplateStyle(e.target.value as ActivityTemplateStyle)
                          setTemplateNotice(null)
                        }}
                        className="bg-transparent text-xs focus:outline-none"
                      >
                        {BUILT_IN_TEMPLATE_STYLES.map((style) => (
                          <option key={style} value={style}>{templateStyleLabel(style)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex h-8 items-center gap-2 rounded border border-input bg-background px-2 text-xs">
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {t`Length`}
                      </span>
                      <select
                        value={generationMode}
                        onChange={(e) => {
                          setGenerationMode(e.target.value as ActivityGenerationMode)
                          setTemplateNotice(null)
                        }}
                        className="bg-transparent text-xs focus:outline-none"
                      >
                        {(["template_single_page", "template_multi_step"] as ActivityGenerationMode[]).map((mode) => (
                          <option key={mode} value={mode}>{generationModeLabel(mode)}</option>
                        ))}
                      </select>
                    </label>
                    {savedTemplates.length > 0 && (
                      <label className="flex h-8 items-center gap-2 rounded border border-input bg-background px-2 text-xs">
                        <span className="text-[10px] font-medium text-muted-foreground">{t`Saved`}</span>
                        <select
                          value={savedTemplates.some((tpl) => tpl.id === selectedTemplateId) ? selectedTemplateId : ""}
                          onChange={(e) => {
                            if (e.target.value) selectTemplate(e.target.value)
                          }}
                          className="bg-transparent text-xs focus:outline-none"
                        >
                          <option value="">{t`Choose saved`}</option>
                          {savedTemplates.map((template) => (
                            <option key={template.id ?? template.name} value={template.id ?? template.name}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={saveTemplate}
                      className="h-8 rounded border border-input bg-background px-2.5 text-xs font-medium transition-colors hover:bg-muted/60"
                    >
                      {t`Save as reusable style`}
                    </button>
                    {templateNotice && (
                      <span className="text-[10px] font-medium text-emerald-700">{templateNotice}</span>
                    )}
                  </div>
                  <label className="block space-y-1">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {t`Style instructions (optional)`}
                    </span>
                    <textarea
                      value={templateInstructions}
                      onChange={(e) => {
                        setTemplateInstructions(e.target.value)
                        setTemplateNotice(null)
                      }}
                      placeholder={t`Example: keep answers short, use the same tone as page 4.`}
                      className="min-h-8 w-full resize-y rounded border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      rows={2}
                    />
                  </label>
                </div>
              </details>

            </div>
          </details>

          {progress && (
            <p className="text-xs text-muted-foreground">
              {t`Generating ${String(progress.done)} of ${String(progress.total)}…`}
            </p>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs font-medium transition-colors hover:bg-muted/60"
          >
            {t`Cancel`}
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!hasApiKey || !isValid || generating}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-orange-600 px-4 text-xs font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {t`Generate`}
          </button>
        </DialogFooter>

        {showPagePicker && (
          <SelectQuizPagesDialog
            bookLabel={bookLabel}
            initialSelected={selectedPageIds}
            onConfirm={(ids) => {
              setSelectedPageIds(ids)
              setShowPagePicker(false)
            }}
            onClose={() => setShowPagePicker(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
