import { useState, useEffect } from "react"
import { Link } from "@tanstack/react-router"
import { Plus, Settings2, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useBookConfig, useUpdateBookConfig } from "@/hooks/use-book-config"
import { useActiveConfig } from "@/hooks/use-debug"
import { useLingui } from "@lingui/react/macro"
import { SelectQuizPagesDialog } from "./SelectQuizPagesDialog"

type Mode = "auto" | "custom"

/** Local editor state for one quiz group. */
interface QuizGroupDraft {
  source_page_ids: string[]
  insert_after?: string | "end"
}

// eslint-disable-next-line lingui/no-unlocalized-strings -- internal sentinel value, not user-visible
const PLACEMENT_AFTER_LAST = "__after_last__"
const PLACEMENT_END = "end"

function placementValue(group: QuizGroupDraft): string {
  if (group.insert_after === "end") return PLACEMENT_END
  return PLACEMENT_AFTER_LAST
}

/**
 * Compact configuration block shown on the quizzes landing page (inside the
 * StageRunCard). Lets the user pick auto-batching or define a list of custom
 * quizzes (source pages + placement) before running quiz generation.
 */
export function QuizzesLandingConfig({ bookLabel }: { bookLabel: string }) {
  const { t } = useLingui()
  const { data: bookConfigData } = useBookConfig(bookLabel)
  const { data: activeConfigData } = useActiveConfig(bookLabel)
  const updateConfig = useUpdateBookConfig()

  const [mode, setMode] = useState<Mode>("auto")
  const [pagesPerQuiz, setPagesPerQuiz] = useState("3")
  const [groups, setGroups] = useState<QuizGroupDraft[]>([])
  const [pickerForIndex, setPickerForIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!activeConfigData) return
    const m = activeConfigData.merged as Record<string, unknown>
    if (m.quiz_generation && typeof m.quiz_generation === "object") {
      const qg = m.quiz_generation as Record<string, unknown>
      if (qg.pages_per_quiz != null) setPagesPerQuiz(String(qg.pages_per_quiz))
      if (Array.isArray(qg.quiz_groups)) {
        const parsed = (qg.quiz_groups as Array<Record<string, unknown>>)
          .map((g): QuizGroupDraft | null => {
            if (!Array.isArray(g.source_page_ids)) return null
            return {
              source_page_ids: g.source_page_ids as string[],
              insert_after: g.insert_after as string | "end" | undefined,
            }
          })
          .filter((g): g is QuizGroupDraft => g !== null)
        setGroups(parsed)
        if (parsed.length > 0) setMode("custom")
      }
    }
  }, [activeConfigData])

  const persist = (next: { mode?: Mode; pagesPerQuiz?: string; groups?: QuizGroupDraft[] }) => {
    const effectiveMode = next.mode ?? mode
    const effectivePages = next.pagesPerQuiz ?? pagesPerQuiz
    const effectiveGroups = next.groups ?? groups
    const existing = (bookConfigData?.config?.quiz_generation ?? {}) as Record<string, unknown>
    const cleanGroups = effectiveGroups
      .filter((g) => g.source_page_ids.length > 0)
      .map((g) => ({
        source_page_ids: g.source_page_ids,
        insert_after: g.insert_after,
      }))
    const overrides: Record<string, unknown> = {
      ...(bookConfigData?.config ?? {}),
      quiz_generation: {
        ...existing,
        pages_per_quiz: effectivePages ? Number(effectivePages) : undefined,
        quiz_groups:
          effectiveMode === "custom" && cleanGroups.length > 0 ? cleanGroups : undefined,
      },
    }
    updateConfig.mutate({ label: bookLabel, config: overrides })
  }

  const handleModeChange = (next: Mode) => {
    setMode(next)
    persist({ mode: next })
  }

  const updateGroup = (index: number, patch: Partial<QuizGroupDraft>) => {
    const next = groups.map((g, i) => (i === index ? { ...g, ...patch } : g))
    setGroups(next)
    persist({ groups: next })
  }

  const addGroup = () => {
    const next = [...groups, { source_page_ids: [] }]
    setGroups(next)
    // Open picker immediately for the new group
    setPickerForIndex(next.length - 1)
  }

  const removeGroup = (index: number) => {
    const next = groups.filter((_, i) => i !== index)
    setGroups(next)
    persist({ groups: next })
  }

  const handlePagesConfirmed = (ids: string[]) => {
    if (pickerForIndex == null) return
    const idx = pickerForIndex
    const exists = groups[idx] !== undefined
    let next: QuizGroupDraft[]
    if (exists) {
      next = groups.map((g, i) => (i === idx ? { ...g, source_page_ids: ids } : g))
    } else {
      next = [...groups, { source_page_ids: ids }]
    }
    // Drop empty groups (cancelled new entries)
    next = next.filter((g, i) => i === idx || g.source_page_ids.length > 0)
    setGroups(next)
    setPickerForIndex(null)
    persist({ groups: next })
  }

  const closePicker = () => {
    // If the open picker was for a freshly-added empty group, drop it.
    if (pickerForIndex != null && groups[pickerForIndex]?.source_page_ids.length === 0) {
      const next = groups.filter((_, i) => i !== pickerForIndex)
      setGroups(next)
    }
    setPickerForIndex(null)
  }

  const initialPickerSelection =
    pickerForIndex != null ? groups[pickerForIndex]?.source_page_ids ?? [] : []

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs font-semibold">{t`How should quiz pages be chosen?`}</Label>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="radio"
            name="quiz-page-mode"
            checked={mode === "auto"}
            onChange={() => handleModeChange("auto")}
            className="mt-0.5 h-3.5 w-3.5 accent-primary cursor-pointer"
          />
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{t`Every`}</span>
              <Input
                type="number"
                min={1}
                value={pagesPerQuiz}
                onChange={(e) => setPagesPerQuiz(e.target.value)}
                onBlur={() => persist({ pagesPerQuiz })}
                onClick={(e) => e.stopPropagation()}
                disabled={mode !== "auto"}
                className="w-16 h-7 text-xs"
              />
              <span className="text-xs font-medium">{t`pages`}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t`Group every N eligible pages in order into one quiz.`}
            </p>
          </div>
        </label>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="radio"
            name="quiz-page-mode"
            checked={mode === "custom"}
            onChange={() => handleModeChange("custom")}
            className="mt-0.5 h-3.5 w-3.5 accent-primary cursor-pointer"
          />
          <div className="flex-1 space-y-1">
            <span className="text-xs font-medium">{t`Custom — define each quiz yourself`}</span>
            <p className="text-[11px] text-muted-foreground">
              {t`Pick the source pages for each quiz and where it should appear in the book.`}
            </p>
          </div>
        </label>
      </div>

      {mode === "custom" && (
        <div className="space-y-2 pl-6">
          {groups.length === 0 && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              {t`Add at least one quiz to run.`}
            </p>
          )}
          {groups.map((group, index) => (
            <div
              key={index}
              className="rounded-md border bg-background p-2.5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t`Quiz ${String(index + 1)}`}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                  onClick={() => removeGroup(index)}
                  title={t`Remove quiz`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-[11px] font-normal">
                  {group.source_page_ids.length === 1
                    ? t`1 page selected`
                    : t`${String(group.source_page_ids.length)} pages selected`}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  className="h-7 text-xs"
                  onClick={() => setPickerForIndex(index)}
                >
                  {group.source_page_ids.length > 0 ? t`Edit pages...` : t`Choose pages...`}
                </Button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Label className="text-[11px] text-muted-foreground">{t`Place quiz:`}</Label>
                <select
                  value={placementValue(group)}
                  onChange={(e) => {
                    const v = e.target.value
                    updateGroup(index, {
                      insert_after: v === PLACEMENT_END ? "end" : undefined,
                    })
                  }}
                  className="h-7 rounded border border-input bg-background px-2 text-xs"
                >
                  <option value={PLACEMENT_AFTER_LAST}>{t`After the last selected page`}</option>
                  <option value={PLACEMENT_END}>{t`At the end of the book`}</option>
                </select>
              </div>
            </div>
          ))}

          <Button
            size="sm"
            variant="outline"
            type="button"
            className="h-7 text-xs"
            onClick={addGroup}
          >
            <Plus className="h-3 w-3 mr-1" />
            {t`Add another quiz`}
          </Button>
        </div>
      )}

      <div className="pt-2 border-t border-border/40 flex justify-end">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <Link
            to="/books/$label/$step/settings"
            params={{ label: bookLabel, step: "quizzes" }}
            search={{ tab: "general" }}
          >
            <Settings2 className="h-3 w-3 mr-1" />
            {t`Advanced settings`}
          </Link>
        </Button>
      </div>

      {pickerForIndex != null && (
        <SelectQuizPagesDialog
          bookLabel={bookLabel}
          initialSelected={initialPickerSelection}
          onConfirm={handlePagesConfirmed}
          onClose={closePicker}
        />
      )}
    </div>
  )
}
