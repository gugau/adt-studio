import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { api, type QuizActivityType, type StageRunProviderCredentials } from "@/api/client"
import { usePages } from "@/hooks/use-pages"
import { useLingui } from "@lingui/react/macro"

const ACTIVITY_OPTIONS: QuizActivityType[] = [
  "multiple_choice",
  "true_false",
  "fill_in_the_blank",
  "drag_and_drop",
]

const PAGE_PICKER_WINDOW_SIZE = 40

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
  const [replaceExisting, setReplaceExisting] = useState(true)
  const [pickerOffset, setPickerOffset] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
      case "true_false":
        return t`True/False`
      case "fill_in_the_blank":
        return t`Fill Blanks`
      case "drag_and_drop":
        return t`Drag & Drop`
      case "multiple_choice":
      default:
        return t`MCQ`
    }
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
        <div className="grid gap-2 lg:grid-cols-[minmax(260px,1fr)_auto_auto]">
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
            {t`Replace existing quizzes for selected pages`}
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
