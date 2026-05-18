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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useLingui } from "@lingui/react/macro"

const ACTIVITY_OPTIONS: QuizActivityType[] = [
  "multiple_choice",
  "multiple_select",
  "true_false",
  "fill_in_the_blank",
  "open_ended",
  "drag_and_drop",
  "sorting",
]

const PAGE_PICKER_WINDOW_SIZE = 40
// eslint-disable-next-line lingui/no-unlocalized-strings -- internal sentinel value, not user-visible
const SMART_INSERT_AFTER = "__last_selected__"
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

function parsePageRange(
  range: string,
  pageIdsByNumber: Map<number, string>,
  pageIdsByLowerId: Map<string, string>
): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const rawPart of range.split(",")) {
    const part = rawPart.trim()
    if (!part) continue

    const directPageId = pageIdsByLowerId.get(part.toLowerCase())
    if (directPageId && !seen.has(directPageId)) {
      ids.push(directPageId)
      seen.add(directPageId)
      continue
    }

    const match = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!match) continue
    const start = Number(match[1])
    const end = Number(match[2] ?? match[1])
    const min = Math.min(start, end)
    const max = Math.max(start, end)
    for (let pageNumber = min; pageNumber <= max; pageNumber++) {
      const pageId = pageIdsByNumber.get(pageNumber)
      if (pageId && !seen.has(pageId)) {
        ids.push(pageId)
        seen.add(pageId)
      }
    }
  }
  return ids
}

function formatPageRange(pageIds: string[], pageNumberById: Map<string, number>): string {
  const parts: string[] = []
  let runStart: number | null = null
  let runEnd: number | null = null

  const flushRun = () => {
    if (runStart == null || runEnd == null) return
    parts.push(runStart === runEnd ? String(runStart) : `${runStart}-${runEnd}`)
    runStart = null
    runEnd = null
  }

  for (const pageId of pageIds) {
    const pageNumber = pageNumberById.get(pageId)
    if (pageNumber == null) {
      flushRun()
      parts.push(pageId)
      continue
    }

    if (runStart == null || runEnd == null) {
      runStart = pageNumber
      runEnd = pageNumber
    } else if (pageNumber === runEnd + 1) {
      runEnd = pageNumber
    } else {
      flushRun()
      runStart = pageNumber
      runEnd = pageNumber
    }
  }

  flushRun()
  return parts.join(", ")
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
  const [pageRange, setPageRange] = useState("")
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>(
    initialSelectedPageId ? [initialSelectedPageId] : []
  )
  const [insertAfterPageId, setInsertAfterPageId] = useState(SMART_INSERT_AFTER)
  const [replaceExisting, setReplaceExisting] = useState(true)
  const [pickerOffset, setPickerOffset] = useState(0)
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
  const autoFilledForOpenRef = useRef(false)

  const pages = pagesQuery.data ?? []
  const pageIdsByNumber = useMemo(() => {
    const map = new Map<number, string>()
    for (const page of pages) map.set(page.pageNumber, page.pageId)
    return map
  }, [pages])
  const pageIdsByLowerId = useMemo(() => {
    const map = new Map<string, string>()
    for (const page of pages) map.set(page.pageId.toLowerCase(), page.pageId)
    return map
  }, [pages])
  const pageNumberById = useMemo(() => {
    const map = new Map<string, number>()
    for (const page of pages) map.set(page.pageId, page.pageNumber)
    return map
  }, [pages])
  const pageOrder = useMemo(() => new Map(pages.map((page, index) => [page.pageId, index])), [pages])
  const contentPageIds = useMemo(
    () => pages.filter((page) => page.sectionCount > page.prunedSections.length).map((p) => p.pageId),
    [pages]
  )
  const visiblePages = pages.slice(pickerOffset, pickerOffset + PAGE_PICKER_WINDOW_SIZE)
  const canPageBack = pickerOffset > 0
  const canPageForward = pickerOffset + PAGE_PICKER_WINDOW_SIZE < pages.length
  const resolvedInsertAfterPageId =
    insertAfterPageId === SMART_INSERT_AFTER
      ? selectedPageIds[selectedPageIds.length - 1] ?? ""
      : insertAfterPageId
  const resolvedInsertAfterPage = pages.find((page) => page.pageId === resolvedInsertAfterPageId)
  const smartInsertAfterLabel = resolvedInsertAfterPage
    ? t`Smart: after page ${String(resolvedInsertAfterPage.pageNumber)}`
    : t`Smart: last selected page`
  const allTemplates = [...DEFAULT_ACTIVITY_TEMPLATES, ...savedTemplates]
  const selectedTemplate: ActivityTemplate = {
    id: selectedTemplateId,
    name: templateName.trim() || t`Untitled template`,
    style: normalizedTemplateStyle(templateStyle),
    generationMode,
    ...(templateInstructions.trim() ? { instructions: templateInstructions.trim() } : {}),
  }

  const orderedSelectedPageIds = (ids: string[]) =>
    ids.slice().sort((a, b) => (pageOrder.get(a) ?? Number.MAX_SAFE_INTEGER) - (pageOrder.get(b) ?? Number.MAX_SAFE_INTEGER))

  // When the dialog opens, default the range to the whole book if the user
  // hasn't already picked something. Lazy users can then press Generate
  // without touching anything else.
  useEffect(() => {
    if (!open) {
      autoFilledForOpenRef.current = false
      return
    }
    if (autoFilledForOpenRef.current) return
    if (selectedPageIds.length > 0) {
      autoFilledForOpenRef.current = true
      return
    }
    if (contentPageIds.length === 0) return
    autoFilledForOpenRef.current = true
    setSelectedPageIds(contentPageIds)
    setPageRange(formatPageRange(contentPageIds, pageNumberById))
  }, [open, selectedPageIds.length, contentPageIds, pageNumberById])

  useEffect(() => {
    if (!initialSelectedPageId) return
    const formattedRange = formatPageRange([initialSelectedPageId], pageNumberById) || initialSelectedPageId
    if (appliedInitialPageIdRef.current !== initialSelectedPageId) {
      appliedInitialPageIdRef.current = initialSelectedPageId
      setSelectedPageIds([initialSelectedPageId])
      setPageRange(formattedRange)
    } else if (pageRange === initialSelectedPageId && formattedRange !== initialSelectedPageId) {
      setPageRange(formattedRange)
    }
  }, [initialSelectedPageId, pageNumberById, pageRange])

  const activityTypeLabel = (value: QuizActivityType) => {
    switch (value) {
      case "multiple_select":
        return t`MCQ Multiple Select`
      case "true_false":
        return t`True/False`
      case "fill_in_the_blank":
        return t`Fill Blanks`
      case "open_ended":
        return t`Open Ended`
      case "drag_and_drop":
        return t`Matching Pairs`
      case "sorting":
        return t`Sorting`
      case "multiple_choice":
      default:
        return t`MCQ`
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

  const applyRange = () => {
    const ids = parsePageRange(pageRange, pageIdsByNumber, pageIdsByLowerId)
    const orderedIds = orderedSelectedPageIds(ids)
    setSelectedPageIds(orderedIds)
    setPageRange(formatPageRange(orderedIds, pageNumberById))
  }

  const setRangeToWholeBook = () => {
    setSelectedPageIds(contentPageIds)
    setPageRange(formatPageRange(contentPageIds, pageNumberById))
  }

  const togglePage = (pageId: string, enabled: boolean) => {
    if (!enabled) return
    const next = selectedPageIds.includes(pageId)
      ? selectedPageIds.filter((id) => id !== pageId)
      : [...selectedPageIds, pageId]
    const orderedIds = orderedSelectedPageIds(next)
    setSelectedPageIds(orderedIds)
    setPageRange(formatPageRange(orderedIds, pageNumberById))
  }

  const handleGenerate = async () => {
    if (!hasApiKey || selectedPageIds.length === 0 || generating) return
    setGenerating(true)
    setError(null)
    try {
      await api.generateQuizzes(
        bookLabel,
        apiKey,
        {
          pageIds: selectedPageIds,
          activityType,
          template: selectedTemplate,
          insertAfterPageId: resolvedInsertAfterPageId || undefined,
          questionsPerQuiz: Math.min(20, Math.max(1, Number(questionsPerQuiz) || 1)),
          replaceExistingForPages: replaceExisting,
        },
        providerCredentials
      )
      await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "quizzes"] })
      await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "debug"] })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(false)
    }
  }

  const selectedCount = selectedPageIds.length
  const questionsCount = Math.min(20, Math.max(1, Number(questionsPerQuiz) || 1))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-orange-600" />
            {t`Generate activity`}
          </DialogTitle>
          <DialogDescription>
            {t`Pick a type and the pages to base the activity on. You can add more activities one at a time.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Simple, always-visible controls */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium">{t`Activity type`}</span>
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
            <label className="space-y-1.5">
              <span className="text-xs font-medium">{t`Pages`}</span>
              <div className="flex items-center gap-1.5">
                <input
                  value={pageRange}
                  onChange={(e) => setPageRange(e.target.value)}
                  onBlur={applyRange}
                  placeholder={t`1-12, 20, pg045`}
                  className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={setRangeToWholeBook}
                  className="h-9 shrink-0 rounded-md border border-input bg-background px-2.5 text-xs font-medium transition-colors hover:bg-muted/60"
                >
                  {t`Whole book`}
                </button>
              </div>
            </label>
          </div>

          {selectedCount === 0 ? (
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              {t`Type a page range above, or click "Whole book" to use every content page.`}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {selectedCount === 1
                ? t`1 source page selected • ${String(questionsCount)} question(s) will be generated.`
                : t`${String(selectedCount)} source pages selected • ${String(questionsCount)} question(s) will be generated.`}
            </p>
          )}

          {/* Advanced — progressive disclosure */}
          <details className="rounded-md border bg-muted/20">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium">
              {t`More options`}
            </summary>
            <div className="space-y-4 px-3 pb-3 pt-1">
              {/* Placement + questions per quiz */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {t`Questions per quiz`}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={questionsPerQuiz}
                    onChange={(e) => setQuestionsPerQuiz(e.target.value)}
                    className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {t`Insert after`}
                  </span>
                  <select
                    value={insertAfterPageId}
                    onChange={(e) => setInsertAfterPageId(e.target.value)}
                    className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                  >
                    <option value={SMART_INSERT_AFTER}>{smartInsertAfterLabel}</option>
                    {pages.map((page) => (
                      <option key={page.pageId} value={page.pageId}>
                        {t`Page ${String(page.pageNumber)}`} ({page.pageId})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

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

              {/* Per-page picker grid — also disclosed */}
              <details className="rounded-md border bg-background">
                <summary className="cursor-pointer px-3 py-2 text-[11px] font-medium text-muted-foreground">
                  {t`Pick pages individually`}
                </summary>
                <div className="space-y-2 px-3 pb-3 pt-1">
                  <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span>
                      {pages.length === 0
                        ? t`No pages`
                        : t`${String(pickerOffset + 1)}-${String(Math.min(pickerOffset + PAGE_PICKER_WINDOW_SIZE, pages.length))} of ${String(pages.length)}`}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPickerOffset(Math.max(0, pickerOffset - PAGE_PICKER_WINDOW_SIZE))}
                        disabled={!canPageBack}
                        className="rounded border px-2 py-1 transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {t`Previous`}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPickerOffset(pickerOffset + PAGE_PICKER_WINDOW_SIZE)}
                        disabled={!canPageForward}
                        className="rounded border px-2 py-1 transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {t`Next`}
                      </button>
                    </div>
                  </div>
                  <div className="grid max-h-44 grid-cols-2 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
                    {visiblePages.map((page) => {
                      const isSelected = selectedPageIds.includes(page.pageId)
                      const isContent = page.sectionCount > page.prunedSections.length
                      return (
                        <button
                          key={page.pageId}
                          type="button"
                          disabled={!isContent}
                          onClick={() => togglePage(page.pageId, isContent)}
                          className={`rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                            isSelected
                              ? "border-orange-500 bg-orange-50 text-orange-800"
                              : "border-border bg-background hover:bg-muted/60"
                          } ${!isContent ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`}
                        >
                          <span className="block font-medium">{t`Page ${String(page.pageNumber)}`}</span>
                          <span className="block truncate font-mono text-[10px] opacity-70">{page.pageId}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </details>
            </div>
          </details>

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
            disabled={!hasApiKey || selectedPageIds.length === 0 || generating}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-orange-600 px-4 text-xs font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {t`Generate`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
