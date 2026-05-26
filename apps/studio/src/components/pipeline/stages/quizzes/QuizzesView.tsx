import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Loader2 } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useSearch } from "@tanstack/react-router"
import { useLingui } from "@lingui/react/macro"
import { Trans } from "@lingui/react/macro"
import { api } from "@/api/client"
import type {
  ActivityItem,
  QuizGenerationOutput,
  QuizItem,
  VersionEntry,
} from "@/api/client"
import { useQuizzes } from "@/hooks/use-quizzes"
import { useStepHeader } from "../../components/StepViewRouter"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { StageRunCard } from "../../components/StageRunCard"
import { useActivities } from "./hooks/use-activities"
import { activityItemKey } from "./components/ActivitiesIndex"
import { QuizForm } from "./components/QuizForm"
import { ActivityForm } from "./components/ActivityForm"
import { AiChatPanel } from "./components/AiChatPanel"
import { PageLightbox } from "./components/PageThumb"

type QuizData = QuizGenerationOutput

function VersionPicker({
  currentVersion,
  saving,
  dirty,
  bookLabel,
  onPreview,
  onSave,
  onDiscard,
}: {
  currentVersion: number | null
  saving: boolean
  dirty: boolean
  bookLabel: string
  onPreview: (data: unknown) => void
  onSave: () => void
  onDiscard: () => void
}) {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  const [versions, setVersions] = useState<VersionEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const handleOpen = async () => {
    if (saving || currentVersion == null) return
    setOpen(true)
    setLoading(true)
    const res = await api.getVersionHistory(bookLabel, "quiz-generation", "book", true)
    setVersions(res.versions)
    setLoading(false)
  }

  const handlePick = (v: VersionEntry) => {
    if (v.version === currentVersion && !dirty) {
      setOpen(false)
      return
    }
    setOpen(false)
    onPreview(v.data)
  }

  if (saving) {
    return <Loader2 className="h-3 w-3 animate-spin" />
  }

  if (currentVersion == null) return null

  if (dirty) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onDiscard}
          className="text-[10px] font-medium rounded px-2 py-0.5 bg-black/15 text-black hover:bg-black/25 cursor-pointer transition-colors"
        >
          {t`Discard`}
        </button>
        <button
          type="button"
          onClick={onSave}
          className="flex items-center gap-1 text-[10px] font-medium rounded px-2 py-0.5 bg-white text-orange-800 hover:bg-white/80 cursor-pointer transition-colors"
        >
          <Check className="h-3 w-3" />
          {t`Save`}
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-0.5 text-[10px] font-normal normal-case tracking-normal bg-white/20 text-white hover:bg-white/30 rounded px-1.5 py-0.5 transition-colors"
      >
        v{currentVersion}
        <ChevronDown className="h-2.5 w-2.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-popover border rounded shadow-md min-w-[80px] py-1">
          {loading ? (
            <div className="flex items-center justify-center py-2 px-3">
              <Loader2 className="h-3 w-3 animate-spin" />
            </div>
          ) : versions && versions.length > 0 ? (
            versions.map((v) => (
              <button
                key={v.version}
                type="button"
                onClick={() => handlePick(v)}
                className={`w-full text-left px-3 py-1 text-xs hover:bg-accent transition-colors ${
                  v.version === currentVersion ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                v{v.version}
              </button>
            ))
          ) : (
            <div className="px-3 py-1 text-xs text-muted-foreground">{t`No versions`}</div>
          )}
        </div>
      )}
    </div>
  )
}

export function QuizzesView({ bookLabel }: { bookLabel: string; selectedPageId?: string }) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const { data: quizData, isLoading: quizzesLoading } = useQuizzes(bookLabel)
  const { data: activitiesData, isLoading: activitiesLoading } = useActivities(bookLabel)
  const { setExtra } = useStepHeader()
  const { stageState, queueRun } = useBookRun()
  const { apiKey, hasApiKey } = useApiKey()
  const search = useSearch({ strict: false }) as { activity?: string }
  const activeKey = search.activity ?? null

  const quizzesState = stageState("quizzes")
  const quizzesDone = quizzesState === "done"
  const quizzesRunning = quizzesState === "running" || quizzesState === "queued"
  const showRunCard = !quizzesDone || quizzesRunning

  const [pending, setPending] = useState<QuizData | null>(null)
  const [saving, setSaving] = useState(false)
  const [lightboxPageId, setLightboxPageId] = useState<string | null>(null)

  useEffect(() => {
    setPending(null)
  }, [quizData?.version])

  const effectiveQuizzes = pending ?? quizData?.quizzes ?? null
  const dirty = pending != null

  const activityItems: ActivityItem[] = useMemo(() => {
    if (!activitiesData) return []
    return activitiesData.items.map((item) => {
      if (item.kind !== "quiz") return item
      const pendingMatch = effectiveQuizzes?.quizzes.find(
        (q) => q.quizIndex === item.quizIndex,
      )
      return pendingMatch ? { ...item, quiz: pendingMatch } : item
    })
  }, [activitiesData, effectiveQuizzes])

  const selectedItem = useMemo(
    () => activityItems.find((item) => activityItemKey(item) === activeKey) ?? null,
    [activityItems, activeKey],
  )

  const saveQuizzes = useCallback(async () => {
    if (!pending) return
    setSaving(true)
    const minDelay = new Promise((r) => setTimeout(r, 400))
    await api.updateQuizzes(bookLabel, pending)
    setPending(null)
    await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "quizzes"] })
    await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "activities"] })
    await minDelay
    setSaving(false)
  }, [pending, bookLabel, queryClient])

  const saveRef = useRef(saveQuizzes)
  saveRef.current = saveQuizzes

  const handleQuizChange = useCallback(
    (next: QuizItem) => {
      const base = pending ?? quizData?.quizzes
      if (!base) return
      setPending({
        ...base,
        quizzes: base.quizzes.map((q) =>
          q.quizIndex === next.quizIndex ? next : q,
        ),
      })
    },
    [pending, quizData],
  )

  const handleRunQuizzes = useCallback(() => {
    if (!hasApiKey || quizzesRunning) return
    queueRun({ fromStage: "quizzes", toStage: "quizzes", apiKey })
  }, [hasApiKey, quizzesRunning, apiKey, queueRun])

  useEffect(() => {
    if (!quizData?.quizzes) return
    setExtra(
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5">
          {t`${String(activityItems.length)} items`}
        </span>
        <VersionPicker
          currentVersion={quizData.version}
          saving={saving}
          dirty={dirty}
          bookLabel={bookLabel}
          onPreview={(d) => setPending(d as QuizData)}
          onSave={() => saveRef.current()}
          onDiscard={() => setPending(null)}
        />
      </div>,
    )
    return () => setExtra(null)
  }, [quizData, activityItems.length, saving, dirty, bookLabel, setExtra, t])

  if (!showRunCard && (quizzesLoading || activitiesLoading)) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span className="text-sm">{t`Loading activities...`}</span>
      </div>
    )
  }

  if (showRunCard) {
    return (
      <div className="p-4">
        <StageRunCard
          stageSlug="quizzes"
          isRunning={quizzesRunning}
          completed={quizzesDone}
          onRun={handleRunQuizzes}
          disabled={!hasApiKey || quizzesRunning}
        />
      </div>
    )
  }

  if (!selectedItem) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Trans>Select an activity from the sidebar to edit it.</Trans>
      </div>
    )
  }

  const selectedQuiz =
    selectedItem.kind === "quiz"
      ? (effectiveQuizzes?.quizzes.find((q) => q.quizIndex === selectedItem.quizIndex) ?? selectedItem.quiz)
      : undefined

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] divide-y md:divide-y-0 md:divide-x h-full overflow-hidden">
        <div className="overflow-y-auto px-4 py-4">
          {selectedItem.kind === "quiz" && selectedQuiz ? (
            <QuizForm
              bookLabel={bookLabel}
              quiz={selectedQuiz}
              disabled={saving}
              onChange={handleQuizChange}
              onOpenPage={setLightboxPageId}
            />
          ) : selectedItem.kind === "section-activity" ? (
            <ActivityForm bookLabel={bookLabel} item={selectedItem} />
          ) : null}
        </div>
        <div className="min-w-0 h-full">
          <AiChatPanel
            key={activeKey ?? "none"}
            bookLabel={bookLabel}
            item={selectedItem}
            currentQuiz={selectedQuiz}
            onQuizUpdated={handleQuizChange}
          />
        </div>
      </div>

      <PageLightbox
        bookLabel={bookLabel}
        pageId={lightboxPageId}
        open={lightboxPageId != null}
        onOpenChange={(open) => {
          if (!open) setLightboxPageId(null)
        }}
      />
    </>
  )
}
