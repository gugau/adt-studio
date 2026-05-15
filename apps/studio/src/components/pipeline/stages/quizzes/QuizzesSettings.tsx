import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "@tanstack/react-router"
import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useBookConfig, useUpdateBookConfig } from "@/hooks/use-book-config"
import { useActiveConfig } from "@/hooks/use-debug"
import { useApiKey } from "@/hooks/use-api-key"
import { api } from "@/api/client"
import { PromptViewer } from "@/components/pipeline/components/PromptViewer"
import { useBookRun } from "@/hooks/use-book-run"
import { useStepConfig } from "@/hooks/use-step-config"
import { useLingui } from "@lingui/react/macro"
import { getSectionTypeLabel, getSectionTypeDescription } from "@/lib/section-constants"

function getSectionTypeDisplayLabel(value: string): string {
  return getSectionTypeLabel(value) || value.replace(/_/g, " ")
}

function getSectionTypeDisplayDescription(value: string, configDesc: string): string {
  return getSectionTypeDescription(value) ?? configDesc
}

function boundedNumber(value: string, min: number, max: number): number | undefined {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined
  return Math.min(max, Math.max(min, Math.trunc(parsed)))
}

export function QuizzesSettings({ bookLabel, headerTarget, tab = "general" }: { bookLabel: string; headerTarget?: HTMLDivElement | null; tab?: string }) {
  const { t } = useLingui()
  const { data: bookConfigData } = useBookConfig(bookLabel)
  const { data: activeConfigData } = useActiveConfig(bookLabel)
  const updateConfig = useUpdateBookConfig()
  const { apiKey, hasApiKey } = useApiKey()
  const { queueRun } = useBookRun()
  const navigate = useNavigate()
  const [showRerunDialog, setShowRerunDialog] = useState(false)

  const [mcqOptionCount, setMcqOptionCount] = useState("4")
  const [openEndedCharacterLimit, setOpenEndedCharacterLimit] = useState("250")
  const [matchingPairCount, setMatchingPairCount] = useState("6")
  const [sortingItemCount, setSortingItemCount] = useState("6")
  const [promptDraft, setPromptDraft] = useState<string | null>(null)
  const [sectionTypes, setSectionTypes] = useState<Record<string, string>>({})
  const [quizSectionTypes, setQuizSectionTypes] = useState<Set<string>>(new Set())

  const [dirty, setDirty] = useState<Record<string, boolean>>({})
  const markDirty = (field: string) => setDirty((prev) => ({ ...prev, [field]: true }))

  const merged = activeConfigData?.merged as Record<string, unknown> | undefined
  const quiz = useStepConfig(merged, "quiz_generation", markDirty)

  useEffect(() => {
    if (!activeConfigData) return
    setSectionTypes({})
    setQuizSectionTypes(new Set())
    setMcqOptionCount("4")
    setOpenEndedCharacterLimit("250")
    setMatchingPairCount("6")
    setSortingItemCount("6")
    const m = activeConfigData.merged as Record<string, unknown>
    if (m.quiz_generation && typeof m.quiz_generation === "object") {
      const qg = m.quiz_generation as Record<string, unknown>
      setMcqOptionCount(qg.multiple_choice_option_count != null ? String(qg.multiple_choice_option_count) : "4")
      setOpenEndedCharacterLimit(qg.open_ended_character_limit != null ? String(qg.open_ended_character_limit) : "250")
      setMatchingPairCount(qg.matching_pair_count != null ? String(qg.matching_pair_count) : "6")
      setSortingItemCount(qg.sorting_item_count != null ? String(qg.sorting_item_count) : "6")
      if (Array.isArray(qg.quiz_section_types)) {
        setQuizSectionTypes(new Set(qg.quiz_section_types as string[]))
      }
    }
    if (m.section_types && typeof m.section_types === "object") {
      const all = m.section_types as Record<string, string>
      const disabled = new Set(Array.isArray(m.disabled_section_types) ? m.disabled_section_types as string[] : [])
      setSectionTypes(Object.fromEntries(Object.entries(all).filter(([k]) => !disabled.has(k))))
    }
  }, [activeConfigData])

  const toggleQuizSectionType = (key: string) => {
    markDirty("quiz_generation")
    markDirty("quiz_section_types")
    setQuizSectionTypes((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const shouldWrite = (field: string) =>
    dirty[field] || (bookConfigData?.config && field in bookConfigData.config)

  const buildOverrides = () => {
    const overrides: Record<string, unknown> = {}
    if (bookConfigData?.config) Object.assign(overrides, bookConfigData.config)

    if (shouldWrite("quiz_generation")) {
      const existing = (bookConfigData?.config?.quiz_generation ?? {}) as Record<string, unknown>
      const nextQuizGeneration: Record<string, unknown> = {
        ...existing,
        ...quiz.configOverrides,
        multiple_choice_option_count: boundedNumber(mcqOptionCount, 2, 6),
        open_ended_character_limit: boundedNumber(openEndedCharacterLimit, 50, 2000),
        matching_pair_count: boundedNumber(matchingPairCount, 2, 6),
        sorting_item_count: boundedNumber(sortingItemCount, 2, 6),
      }
      if (dirty.quiz_section_types || "quiz_section_types" in existing) {
        nextQuizGeneration.quiz_section_types = Array.from(quizSectionTypes)
      }
      overrides.quiz_generation = nextQuizGeneration
    }
    return overrides
  }

  const confirmSaveAndRerun = async () => {
    const promptSaves: Promise<unknown>[] = []
    if (promptDraft != null) promptSaves.push(api.updatePrompt("quiz_generation", promptDraft, bookLabel))
    if (promptSaves.length > 0) await Promise.all(promptSaves)

    const overrides = buildOverrides()
    updateConfig.mutate(
      { label: bookLabel, config: overrides },
      {
        onSuccess: async () => {
          setDirty({})
          setPromptDraft(null)
          setShowRerunDialog(false)
          queueRun({ fromStage: "quizzes", toStage: "quizzes", apiKey })
          navigate({ to: "/books/$label/$step", params: { label: bookLabel, step: "quizzes" } })
        },
      }
    )
  }

  const sectionTypeKeys = Object.keys(sectionTypes).filter((k) => !k.startsWith("activity_"))

  return (
    <div className={tab === "prompt" ? "h-full max-w-4xl" : "p-4 max-w-2xl space-y-6"}>
      {tab === "general" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t`MCQ options`}</Label>
              <Input
                type="number"
                min={2}
                max={6}
                value={mcqOptionCount}
                onChange={(e) => { setMcqOptionCount(e.target.value); markDirty("quiz_generation") }}
                placeholder="4"
                className="w-32 h-8 text-xs"
              />
              <p className="text-xs text-muted-foreground">
                {t`Number of answer options to generate for each MCQ activity.`}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t`Open-ended character limit`}</Label>
              <Input
                type="number"
                min={50}
                max={2000}
                value={openEndedCharacterLimit}
                onChange={(e) => { setOpenEndedCharacterLimit(e.target.value); markDirty("quiz_generation") }}
                placeholder="250"
                className="w-32 h-8 text-xs"
              />
              <p className="text-xs text-muted-foreground">
                {t`Maximum characters learners can type for open-ended responses.`}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t`Matching pairs`}</Label>
              <Input
                type="number"
                min={2}
                max={6}
                value={matchingPairCount}
                onChange={(e) => { setMatchingPairCount(e.target.value); markDirty("quiz_generation") }}
                placeholder="6"
                className="w-32 h-8 text-xs"
              />
              <p className="text-xs text-muted-foreground">
                {t`Maximum number of matching pairs to generate.`}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t`Sorting items`}</Label>
              <Input
                type="number"
                min={2}
                max={6}
                value={sortingItemCount}
                onChange={(e) => { setSortingItemCount(e.target.value); markDirty("quiz_generation") }}
                placeholder="6"
                className="w-32 h-8 text-xs"
              />
              <p className="text-xs text-muted-foreground">
                {t`Maximum number of sorting items to generate.`}
              </p>
            </div>
          </div>

          {sectionTypeKeys.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">{t`Activity Source Section Types`}</Label>
              <p className="text-xs text-muted-foreground">
                {t`Only pages containing these section types are counted when grouping pages for activity generation.`}
              </p>
              <div className="rounded-md border divide-y">
                {sectionTypeKeys.map((key) => {
                  const checked = quizSectionTypes.has(key)
                  return (
                    <label
                      key={key}
                      className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleQuizSectionType(key)}
                        className="h-3.5 w-3.5 rounded border-border accent-primary"
                      />
                      <span className="text-xs font-mono">{getSectionTypeDisplayLabel(key)}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {getSectionTypeDisplayDescription(key, sectionTypes[key])}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {tab === "prompt" && (
        <PromptViewer
          promptName="quiz_generation"
          bookLabel={bookLabel}
          title={t`Activity Generation Prompt`}
          description={t`The prompt template used to generate activities from page content.`}
          model={quiz.model}
          onModelChange={quiz.onModelChange}
          maxRetries={quiz.maxRetries}
          onMaxRetriesChange={quiz.onMaxRetriesChange}
          onContentChange={setPromptDraft}
          enabled={tab === "prompt"}
        />
      )}

      {headerTarget && createPortal(
        <Button
          size="sm"
          className="h-7 px-2.5 text-xs bg-black/15 text-white hover:bg-black/25"
          onClick={() => setShowRerunDialog(true)}
          disabled={updateConfig.isPending || !hasApiKey}
        >
          <Play className="mr-1.5 h-3.5 w-3.5" />
          {t`Save & Rerun`}
        </Button>,
        headerTarget
      )}

      <Dialog open={showRerunDialog} onOpenChange={setShowRerunDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t`Save & Rerun Activities`}</DialogTitle>
            <DialogDescription>
              {t`This will save your settings and re-run activity generation.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRerunDialog(false)}>
              {t`Cancel`}
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
