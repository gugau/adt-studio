import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Check, ChevronDown, ExternalLink, LayoutTemplate, Loader2 } from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import { api } from "@/api/client"
import type { ActivityItem } from "@/api/client"
import { BookPreviewFrame } from "../../storyboard/components/BookPreviewFrame"
import {
  SECTION_TYPE_GROUPS,
  getSectionTypeDescription,
  getSectionTypeLabel,
} from "@/lib/section-constants"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useApiKey } from "@/hooks/use-api-key"
import { useBookTasks } from "@/hooks/use-book-tasks"

type ActivityRow = Extract<ActivityItem, { kind: "section-activity" }>

type AnswerValue = string | boolean | number

interface ActivityFormProps {
  bookLabel: string
  item: ActivityRow
}

const ACTIVITY_TEMPLATES = SECTION_TYPE_GROUPS.find((g) => g.id === "activities")?.types ?? []

export function ActivityForm({ bookLabel, item }: ActivityFormProps) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const { apiKey, hasApiKey } = useApiKey()
  const { getTask } = useBookTasks(bookLabel)

  const [pending, setPending] = useState<Record<string, AnswerValue> | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState<string | null>(null)
  const [convertTaskId, setConvertTaskId] = useState<string | null>(null)

  const convertTask = convertTaskId ? getTask(convertTaskId) : null
  const convertTaskRunning =
    !!convertTask && (convertTask.status === "running" || convertTask.status === "queued")

  useEffect(() => {
    setPending(null)
    setError(null)
    setConvertError(null)
  }, [item.pageId, item.sectionIndex])

  useEffect(() => {
    if (!convertTaskId) return
    if (!convertTask) return
    if (convertTaskRunning) return
    queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "activities"] })
    queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "pages", item.pageId] })
    if (convertTask.status !== "completed") {
      setConvertError(convertTask.error ?? t`Conversion failed.`)
    }
    setConvertTaskId(null)
    setConverting(false)
  }, [convertTaskId, convertTask, convertTaskRunning, bookLabel, item.pageId, queryClient, t])

  const effective = pending ?? item.activityAnswers
  const dirty = pending != null

  const entries = Object.entries(effective).sort(([a], [b]) => {
    const numA = parseInt(a.replace(/\D/g, ""), 10) || 0
    const numB = parseInt(b.replace(/\D/g, ""), 10) || 0
    return numA - numB
  })

  const handleSave = async () => {
    if (!pending) return
    setSaving(true)
    setError(null)
    try {
      await api.updateActivityAnswers(bookLabel, item.pageId, item.sectionIndex, pending)
      await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "activities"] })
      await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "pages", item.pageId] })
      setPending(null)
      setSavedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleConvert = async (newType: string) => {
    if (newType === item.sectionType) {
      setTemplatesOpen(false)
      return
    }
    setTemplatesOpen(false)
    setConvertError(null)
    setConverting(true)
    try {
      await api.updateSectionType(bookLabel, item.pageId, item.sectionIndex, newType)
      const result = await api.reRenderPage(
        bookLabel,
        item.pageId,
        apiKey,
        item.sectionIndex,
      )
      if (result.taskId) {
        setConvertTaskId(result.taskId)
      } else {
        queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "activities"] })
        queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "pages", item.pageId] })
        setConverting(false)
      }
    } catch (err) {
      setConvertError(err instanceof Error ? err.message : String(err))
      setConverting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Popover open={templatesOpen} onOpenChange={setTemplatesOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={converting || !hasApiKey}
                title={!hasApiKey ? t`API key required to convert templates` : undefined}
                className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs font-medium hover:bg-muted hover:border-orange-300 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LayoutTemplate className="h-3.5 w-3.5 text-violet-600" />
                <span className="text-foreground">{getSectionTypeLabel(item.sectionType)}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={6} className="w-72 p-1">
              <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b mb-1">
                <Trans>Convert template</Trans>
              </div>
              <div className="flex flex-col max-h-72 overflow-y-auto">
                {ACTIVITY_TEMPLATES.map((tpl) => {
                  const isCurrent = tpl.value === item.sectionType
                  return (
                    <button
                      key={tpl.value}
                      type="button"
                      disabled={isCurrent}
                      onClick={() => handleConvert(tpl.value)}
                      className={`text-left rounded px-2 py-1.5 transition-colors cursor-pointer ${
                        isCurrent
                          ? "bg-orange-50 cursor-default"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-foreground">
                          {getSectionTypeLabel(tpl.value)}
                        </span>
                        {isCurrent && <Check className="h-3 w-3 text-orange-600" />}
                      </div>
                      <div className="text-[10px] text-muted-foreground line-clamp-2 leading-snug mt-0.5">
                        {getSectionTypeDescription(tpl.value) ?? ""}
                      </div>
                    </button>
                  )
                })}
              </div>
              <p className="px-2 pt-1.5 pb-1 text-[10px] text-muted-foreground border-t mt-1">
                <Trans>
                  Converting regenerates the activity HTML and answer key using the new template.
                </Trans>
              </p>
            </PopoverContent>
          </Popover>
          <span className="text-[10px] text-muted-foreground truncate">
            {t`Page ${item.pageId}`}
          </span>
        </div>
        <Link
          to="/books/$label/$step/$pageId"
          params={{ label: bookLabel, step: "storyboard", pageId: item.pageId }}
          className="shrink-0 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Trans>View in Storyboard</Trans>
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {converting && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <Trans>Converting template — regenerating activity…</Trans>
        </div>
      )}

      {convertError && (
        <p className="mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          {convertError}
        </p>
      )}

      <div className="rounded-md border overflow-hidden bg-muted/20 mb-4">
        <BookPreviewFrame
          html={item.html}
          bookLabel={bookLabel}
          className="min-h-[280px]"
        />
      </div>

      {entries.length > 0 ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <Trans>Answer key</Trans>
            </div>
            {dirty && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  disabled={saving}
                  className="text-[10px] font-medium rounded px-2 py-0.5 hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Trans>Discard</Trans>
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1 text-[10px] font-medium rounded px-2 py-0.5 bg-orange-600 text-white hover:bg-orange-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  <Trans>Save answers</Trans>
                </button>
              </div>
            )}
            {!dirty && savedAt && (
              <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                <Check className="h-3 w-3" />
                <Trans>Saved</Trans>
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {entries.map(([key, value]) => (
              <div
                key={key}
                className="flex items-center gap-2 px-3 py-1.5 rounded border bg-amber-50/60"
              >
                <span className="shrink-0 text-[10px] font-medium text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">
                  {key}
                </span>
                <input
                  type="text"
                  value={String(value)}
                  disabled={saving}
                  onChange={(e) =>
                    setPending({
                      ...(pending ?? item.activityAnswers),
                      [key]: e.target.value,
                    })
                  }
                  className="flex-1 min-w-0 text-xs rounded border border-transparent bg-transparent px-1.5 py-1 hover:border-border hover:bg-white focus:border-ring focus:bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors disabled:opacity-50"
                />
              </div>
            ))}
          </div>
          {error && (
            <p className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
              {error}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          <Trans>No answer key for this activity.</Trans>
        </p>
      )}

      {item.activityReasoning && (
        <p className="mt-3 text-xs italic text-muted-foreground border-l-2 border-violet-200 pl-3">
          {item.activityReasoning}
        </p>
      )}
    </div>
  )
}
