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

function ActivityTemplatePreview({ style }: { style: ActivityTemplateStyle }) {
  const normalizedStyle = normalizedTemplateStyle(style)

  if (normalizedStyle === "practice_cards") {
    return (
      <div className="grid h-16 grid-cols-2 gap-2 rounded-md bg-sky-50 p-2">
        <div className="rounded border border-sky-200 bg-white shadow-sm" />
        <div className="rounded border border-sky-200 bg-white shadow-sm" />
        <div className="rounded border border-sky-200 bg-white shadow-sm" />
        <div className="rounded border border-sky-200 bg-white shadow-sm" />
      </div>
    )
  }

  if (normalizedStyle === "quick_check") {
    return (
      <div className="h-16 rounded-md border border-slate-200 bg-white p-2">
        <div className="mb-1 h-2 w-1/2 rounded bg-slate-300" />
        <div className="space-y-1">
          <div className="h-1.5 rounded bg-slate-100" />
          <div className="h-1.5 rounded bg-slate-100" />
          <div className="h-1.5 rounded bg-slate-100" />
          <div className="h-1.5 w-3/4 rounded bg-slate-100" />
        </div>
      </div>
    )
  }

  if (normalizedStyle === "guided_steps") {
    return (
      <div className="h-20 space-y-1 overflow-hidden rounded-md bg-violet-50 p-2">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex h-4 items-center gap-2 rounded border border-violet-100 bg-white px-2">
            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[8px] font-semibold leading-none text-white">
              {step}
            </span>
            <span className="h-1.5 flex-1 rounded bg-violet-100" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="h-16 rounded-md border border-slate-200 bg-white p-2">
      <div className="mb-2 h-2 w-2/5 rounded bg-slate-300" />
      <div className="space-y-1.5">
        <div className="grid grid-cols-[1fr_4rem] gap-2 rounded border border-slate-100 p-1">
          <span className="h-1.5 rounded bg-slate-200" />
          <span className="h-1.5 rounded bg-orange-100" />
        </div>
        <div className="grid grid-cols-[1fr_4rem] gap-2 rounded border border-slate-100 p-1">
          <span className="h-1.5 rounded bg-slate-200" />
          <span className="h-1.5 rounded bg-orange-100" />
        </div>
      </div>
    </div>
  )
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
}: {
  bookLabel: string
  apiKey: string
  hasApiKey: boolean
  providerCredentials?: StageRunProviderCredentials
  initialSelectedPageId?: string
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

  const templateSummary = (template: ActivityTemplate) => {
    switch (normalizedTemplateStyle(template.style)) {
      case "practice_cards":
        return t`Bigger answer cards with more space for younger learners.`
      case "quick_check":
        return t`A compact review page for many short questions.`
      case "guided_steps":
        return t`A short sequence that walks the learner through the page.`
      case "worksheet_rows":
      default:
        return t`A familiar worksheet layout with clear rows and simple spacing.`
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
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="rounded-md border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/20 px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-orange-600" />
          <h2 className="text-sm font-semibold">{t`Generate Activities`}</h2>
          <span className="rounded border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-700">
            {selectedPageIds.length === 1 ? t`1 page` : t`${String(selectedPageIds.length)} pages`}
          </span>
          <span className="rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
            {t`${String(Math.min(20, Math.max(1, Number(questionsPerQuiz) || 1)))} questions`}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={activityType}
            onChange={(e) => setActivityType(e.target.value as QuizActivityType)}
            className="h-8 rounded border border-input bg-background px-2 text-xs"
          >
            {ACTIVITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {activityTypeLabel(option)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!hasApiKey || selectedPageIds.length === 0 || generating}
            className="inline-flex h-8 items-center gap-1.5 rounded bg-orange-600 px-3 text-xs font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {t`Generate`}
          </button>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        <div className="space-y-3 border-b pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-foreground">{t`Choose activity layout`}</div>
              <p className="text-[11px] text-muted-foreground">{t`Pick the format learners will see when they try the activity.`}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {savedTemplates.length > 0 && (
                <label className="flex h-8 items-center gap-2 rounded border border-input bg-background px-2 text-xs">
                  <span className="whitespace-nowrap text-[10px] font-medium text-muted-foreground">{t`Saved styles`}</span>
                  <select
                    value={savedTemplates.some((template) => template.id === selectedTemplateId) ? selectedTemplateId : ""}
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
              {templateNotice && <span className="text-[10px] font-medium text-emerald-700">{templateNotice}</span>}
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {DEFAULT_ACTIVITY_TEMPLATES.map((template) => {
              const isSelected = selectedTemplateId === template.id
              return (
                <button
                  key={template.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => selectTemplate(template.id!)}
                  className={`flex min-h-36 flex-col gap-2 rounded-md border p-3 text-left transition-colors ${
                    isSelected
                      ? "border-orange-500 bg-orange-50 text-orange-950 shadow-sm"
                      : "border-border bg-background hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold">{template.name}</span>
                    <span className="rounded border bg-white px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {generationModeLabel(template.generationMode)}
                    </span>
                  </div>
                  <ActivityTemplatePreview style={template.style} />
                  <p className="text-[11px] leading-4 text-muted-foreground">{templateSummary(template)}</p>
                </button>
              )
            })}
          </div>

          <details className="rounded-md border bg-muted/20 px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-foreground">{t`Customize selected layout`}</summary>
            <div className="mt-3 space-y-2">
              <div className="grid gap-2 lg:grid-cols-[minmax(160px,220px)_minmax(140px,180px)_minmax(150px,190px)_auto]">
                <label className="space-y-1">
                  <span className="text-[10px] font-medium text-muted-foreground">{t`Template name`}</span>
                  <input
                    value={templateName}
                    onChange={(e) => {
                      setTemplateName(e.target.value)
                      setTemplateNotice(null)
                    }}
                    aria-label={t`Template name`}
                    className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-medium text-muted-foreground">{t`Layout`}</span>
                  <select
                    value={normalizedTemplateStyle(templateStyle)}
                    onChange={(e) => {
                      setTemplateStyle(e.target.value as ActivityTemplateStyle)
                      setTemplateNotice(null)
                    }}
                    className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                  >
                    {BUILT_IN_TEMPLATE_STYLES.map((style) => (
                      <option key={style} value={style}>{templateStyleLabel(style)}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-medium text-muted-foreground">{t`Length`}</span>
                  <select
                    value={generationMode}
                    onChange={(e) => {
                      setGenerationMode(e.target.value as ActivityGenerationMode)
                      setTemplateNotice(null)
                    }}
                    className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                  >
                    {(["template_single_page", "template_multi_step"] as ActivityGenerationMode[]).map((mode) => (
                      <option key={mode} value={mode}>{generationModeLabel(mode)}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={saveTemplate}
                  className="mt-auto h-8 rounded border border-input bg-background px-3 text-xs font-medium transition-colors hover:bg-muted/60"
                >
                  {t`Save as reusable style`}
                </button>
              </div>
              <textarea
                value={templateInstructions}
                onChange={(e) => {
                  setTemplateInstructions(e.target.value)
                  setTemplateNotice(null)
                }}
                aria-label={t`Template instructions`}
                placeholder={t`Example: keep answers short, use the same tone as page 4, or make each activity a three-step review.`}
                className="min-h-8 w-full resize-y rounded border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                rows={2}
              />
            </div>
          </details>
        </div>

        <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_auto_minmax(190px,260px)_auto]">
          <input
            value={pageRange}
            onChange={(e) => setPageRange(e.target.value)}
            onBlur={applyRange}
            placeholder={t`1-12, 20, pg045`}
            className="h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <label className="flex h-8 items-center gap-2 rounded border border-input bg-background px-2 text-xs">
            <span className="whitespace-nowrap text-[10px] font-medium text-muted-foreground">
              {t`Questions/quiz`}
            </span>
            <input
              type="number"
              min={1}
              max={20}
              value={questionsPerQuiz}
              onChange={(e) => setQuestionsPerQuiz(e.target.value)}
              className="h-7 w-14 bg-transparent text-xs focus:outline-none"
              aria-label={t`Questions per quiz`}
            />
          </label>
          <label className="flex h-8 min-w-0 items-center gap-2 rounded border border-input bg-background px-2 text-xs">
            <span className="whitespace-nowrap text-[10px] font-medium text-muted-foreground">
              {t`Insert after`}
            </span>
            <select
              value={insertAfterPageId}
              onChange={(e) => setInsertAfterPageId(e.target.value)}
              aria-label={t`Insert activity after`}
              className="min-w-0 flex-1 bg-transparent text-xs focus:outline-none"
            >
              <option value={SMART_INSERT_AFTER}>{smartInsertAfterLabel}</option>
              {pages.map((page) => (
                <option key={page.pageId} value={page.pageId}>
                  {t`Page ${String(page.pageNumber)}`} ({page.pageId})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={applyRange}
            className="h-8 rounded border border-input bg-background px-3 text-xs font-medium transition-colors hover:bg-muted/60"
          >
            {t`Apply range`}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
              className="h-3.5 w-3.5 accent-orange-600"
            />
            {t`Replace existing activities for selected pages`}
          </label>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <button
              type="button"
              onClick={() => setPickerOffset(Math.max(0, pickerOffset - PAGE_PICKER_WINDOW_SIZE))}
              disabled={!canPageBack}
              className="rounded border px-2 py-1 transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {t`Previous`}
            </button>
            <span>
              {pages.length === 0
                ? t`No pages`
                : t`${String(pickerOffset + 1)}-${String(Math.min(pickerOffset + PAGE_PICKER_WINDOW_SIZE, pages.length))} of ${String(pages.length)}`}
            </span>
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

        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  )
}
