import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useBookConfig } from "@/hooks/use-book-config"
import { useActiveConfig } from "@/hooks/use-debug"
import { api } from "@/api/client"
import { PromptViewer } from "@/components/pipeline/components/PromptViewer"
import { useStepConfig } from "@/hooks/use-step-config"
import {
  useSaveAndRerun,
  useDirtyConfig,
  StageRerunBar,
} from "@/components/pipeline/components/stage-rerun"
import { useLingui } from "@lingui/react/macro"
import { getSectionTypeLabel, getSectionTypeDescription } from "@/lib/section-constants"

function getSectionTypeDisplayLabel(value: string): string {
  return getSectionTypeLabel(value) || value.replace(/_/g, " ")
}

function getSectionTypeDisplayDescription(value: string, configDesc: string): string {
  return getSectionTypeDescription(value) ?? configDesc
}

export function QuizzesSettings({ bookLabel, tab = "general" }: { bookLabel: string; tab?: string }) {
  const { t } = useLingui()
  const { data: bookConfigData } = useBookConfig(bookLabel)
  const { data: activeConfigData } = useActiveConfig(bookLabel)

  const [pagesPerQuiz, setPagesPerQuiz] = useState("")
  const [promptDraft, setPromptDraft] = useState<string | null>(null)
  const [sectionTypes, setSectionTypes] = useState<Record<string, string>>({})
  const [quizSectionTypes, setQuizSectionTypes] = useState<Set<string>>(new Set())

  const { dirty, markDirty, isDirty, shouldWrite, reset } = useDirtyConfig(bookConfigData?.config)

  const merged = activeConfigData?.merged as Record<string, unknown> | undefined
  const quiz = useStepConfig(merged, "quiz_generation", markDirty)

  useEffect(() => {
    if (!activeConfigData) return
    setSectionTypes({})
    setQuizSectionTypes(new Set())
    const m = activeConfigData.merged as Record<string, unknown>
    if (m.quiz_generation && typeof m.quiz_generation === "object") {
      const qg = m.quiz_generation as Record<string, unknown>
      if (qg.pages_per_quiz != null) setPagesPerQuiz(String(qg.pages_per_quiz))
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

  const buildOverrides = () => {
    const overrides: Record<string, unknown> = {}
    if (bookConfigData?.config) Object.assign(overrides, bookConfigData.config)

    if (shouldWrite("quiz_generation")) {
      const existing = (bookConfigData?.config?.quiz_generation ?? {}) as Record<string, unknown>
      const nextQuizGeneration: Record<string, unknown> = {
        ...existing,
        ...quiz.configOverrides,
        pages_per_quiz: pagesPerQuiz ? Number(pagesPerQuiz) : undefined,
      }
      if (dirty.quiz_section_types || "quiz_section_types" in existing) {
        nextQuizGeneration.quiz_section_types = Array.from(quizSectionTypes)
      }
      overrides.quiz_generation = nextQuizGeneration
    }
    return overrides
  }

  const rerun = useSaveAndRerun({
    bookLabel,
    stage: "quizzes",
    hasPendingChanges: isDirty || promptDraft != null,
    buildOverrides,
    savePrompts: async () => {
      if (promptDraft != null) await api.updatePrompt("quiz_generation", promptDraft, bookLabel)
    },
    onSaved: () => {
      reset()
      setPromptDraft(null)
    },
    dialogTitle: t`Save & Rerun Quizzes`,
    dialogDescription: t`This will save your settings and re-run quiz generation.`,
  })

  const sectionTypeKeys = Object.keys(sectionTypes).filter((k) => !k.startsWith("activity_"))

  return (
    <>
      <StageRerunBar controller={rerun} />
      <div className={tab === "prompt" ? "h-full max-w-4xl" : "p-4 max-w-2xl space-y-6"}>
      {tab === "general" && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">{t`Pages per Quiz`}</Label>
            <Input
              type="number"
              min={1}
              value={pagesPerQuiz}
              onChange={(e) => { setPagesPerQuiz(e.target.value); markDirty("quiz_generation") }}
              placeholder="3"
              className="w-32 h-8 text-xs"
            />
            <p className="text-xs text-muted-foreground">
              {t`Number of pages of content to include per quiz question.`}
            </p>
          </div>

          {sectionTypeKeys.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">{t`Quiz Section Types`}</Label>
              <p className="text-xs text-muted-foreground">
                {t`Only pages containing these section types are counted when grouping pages for quiz generation.`}
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
          title={t`Quiz Generation Prompt`}
          description={t`The prompt template used to generate quiz questions from page content.`}
          model={quiz.model}
          onModelChange={quiz.onModelChange}
          maxRetries={quiz.maxRetries}
          onMaxRetriesChange={quiz.onMaxRetriesChange}
          onContentChange={setPromptDraft}
          enabled={tab === "prompt"}
        />
      )}

      </div>
    </>
  )
}
