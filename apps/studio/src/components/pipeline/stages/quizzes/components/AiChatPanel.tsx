import { useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ChevronDown, Loader2, Send, Sparkles, Trash2, Wand2 } from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import { cn } from "@/lib/utils"
import { api } from "@/api/client"
import type { ActivityItem, QuizItem, QuizOption } from "@/api/client"
import { useApiKey } from "@/hooks/use-api-key"
import { useBookTasks } from "@/hooks/use-book-tasks"
import { getSectionTypeLabel } from "@/lib/section-constants"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { activityItemKey } from "./ActivitiesIndex"

type Message =
  | { id: string; kind: "user"; text: string }
  | {
      id: string
      kind: "assistant"
      text: string
      status?: "pending" | "done" | "error"
      intro?: boolean
    }

interface Skill {
  label: string
  prompt: string
}

interface AiChatPanelProps {
  bookLabel: string
  item: ActivityItem
  currentQuiz?: QuizItem
  onQuizUpdated?: (next: QuizItem) => void
}

export function AiChatPanel({
  bookLabel,
  item,
  currentQuiz,
  onQuizUpdated,
}: AiChatPanelProps) {
  const { t } = useLingui()
  const { apiKey, hasApiKey } = useApiKey()
  const queryClient = useQueryClient()
  const { getTask } = useBookTasks(bookLabel)

  const intro = useMemo(() => {
    if (item.kind === "quiz") {
      const quiz = currentQuiz ?? item.quiz
      const pageList = item.pageIds.length > 0 ? item.pageIds.join(", ") : item.afterPageId
      const correct = quiz.options[quiz.answerIndex]
      const correctSummary = correct
        ? truncate(stripLeadingLabel(correct.text), 60)
        : t`option ${quiz.answerIndex + 1}`
      return [
        t`Multiple-choice quiz drawn from ${pageList}, placed after ${item.afterPageId}.`,
        t`Current question: “${truncate(quiz.question, 100)}”`,
        t`Correct answer: ${correctSummary}.`,
        t`Tell me what to change, or pick one of the suggestions below.`,
      ].join("\n")
    }
    const typeLabel = getSectionTypeLabel(item.sectionType)
    const answerCount = Object.keys(item.activityAnswers).length
    const answerLine =
      answerCount === 0
        ? t`It has no recorded answer key.`
        : answerCount === 1
          ? t`It has 1 answer slot.`
          : t`It has ${answerCount} answer slots.`
    return [
      t`${typeLabel} activity on page ${item.pageId}.`,
      answerLine,
      t`Tell me what to change, or pick one of the suggestions below.`,
    ].join("\n")
  }, [item, currentQuiz, t])

  const skills = useMemo<Skill[]>(() => {
    if (item.kind === "quiz") {
      return [
        {
          label: t`Make harder`,
          prompt: t`Make this question more challenging. Use trickier distractors that require deeper reasoning, but keep it answerable from the same source pages.`,
        },
        {
          label: t`Make easier`,
          prompt: t`Make this question easier. Simplify the wording and make the wrong options more clearly wrong.`,
        },
        {
          label: t`Rephrase question`,
          prompt: t`Rephrase the question while keeping the same correct answer and the same difficulty.`,
        },
        {
          label: t`Improve distractors`,
          prompt: t`Rewrite the two wrong options so they are plausible mistakes a learner might make, not obviously wrong.`,
        },
        {
          label: t`Add a hint`,
          prompt: t`Add a subtle hint in the question text that points toward the correct answer without giving it away.`,
        },
      ]
    }
    return [
      {
        label: t`Simplify language`,
        prompt: t`Rephrase the activity using simpler vocabulary so younger learners can understand it.`,
      },
      {
        label: t`Make harder`,
        prompt: t`Make this activity more challenging while keeping the same structure and number of items.`,
      },
      {
        label: t`Add a hint`,
        prompt: t`Add a short hint inside the activity that supports learners who get stuck.`,
      },
      {
        label: t`Rephrase content`,
        prompt: t`Rephrase the activity content while keeping the structure and the same answer key.`,
      },
    ]
  }, [item, t])

  const itemKey = activityItemKey(item)
  const storageKey = `adt-studio:chat:${bookLabel}:${itemKey}`

  const [messages, setMessages] = useState<Message[]>(() => loadHistory(storageKey))
  const [draft, setDraft] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const draftRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    saveHistory(storageKey, messages)
  }, [storageKey, messages])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const pendingTask = pendingTaskId ? getTask(pendingTaskId) : null
  const taskRunning =
    !!pendingTask &&
    (pendingTask.status === "running" || pendingTask.status === "queued")

  useEffect(() => {
    if (!pendingTaskId) return
    if (!pendingTask) return
    if (taskRunning) return
    queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "activities"] })
    if (item.kind === "section-activity") {
      queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "pages", item.pageId] })
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === pendingTaskId
          ? {
              ...m,
              status: pendingTask.status === "completed" ? "done" : "error",
              text:
                pendingTask.status === "completed"
                  ? t`Activity updated.`
                  : pendingTask.error ?? t`Re-render failed.`,
            }
          : m,
      ),
    )
    setPendingTaskId(null)
  }, [pendingTaskId, pendingTask, taskRunning, bookLabel, item, queryClient, t])

  const busy = submitting || taskRunning
  const canSend = hasApiKey && draft.trim().length > 0 && !busy

  const handleSend = async () => {
    if (!canSend) return
    const instruction = draft.trim()
    const userId = `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setMessages((prev) => [...prev, { id: userId, kind: "user", text: instruction }])
    setDraft("")
    setSubmitting(true)
    try {
      if (item.kind === "quiz") {
        const beforeQuiz = currentQuiz ?? item.quiz
        const result = await api.aiEditQuiz(
          bookLabel,
          item.quizIndex,
          instruction,
          apiKey,
          beforeQuiz,
        )
        onQuizUpdated?.(result.quiz)
        const diffs = describeQuizDiff(beforeQuiz, result.quiz)
        const diffStrings = diffs.map((d) => {
          switch (d.kind) {
            case "question-rewritten":
              return t`question rewritten`
            case "options-rewritten":
              return d.count === 1
                ? t`1 option rewritten`
                : t`${d.count} options rewritten`
            case "correct-answer-changed": {
              if (!d.nextText) return t`correct answer changed`
              const shortened = truncate(stripLeadingLabel(d.nextText), 40)
              return t`correct answer → "${shortened}"`
            }
          }
        })
        const parts = [result.reasoning?.trim() || t`Quiz updated.`]
        if (diffStrings.length > 0) {
          parts.push(`${t`Changes:`} ${diffStrings.join(" · ")}`)
        } else {
          parts.push(t`No visible changes — the AI did not modify the quiz.`)
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${userId}`,
            kind: "assistant",
            text: parts.join("\n\n"),
            status: "done",
          },
        ])
      } else {
        const result = await api.reRenderPage(
          bookLabel,
          item.pageId,
          apiKey,
          item.sectionIndex,
          instruction,
        )
        if (result.taskId) {
          setPendingTaskId(result.taskId)
          setMessages((prev) => [
            ...prev,
            {
              id: result.taskId!,
              kind: "assistant",
              text: t`Re-rendering activity…`,
              status: "pending",
            },
          ])
        } else {
          queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "activities"] })
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${userId}`,
              kind: "assistant",
              text: t`Activity updated.`,
              status: "done",
            },
          ])
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${userId}`,
          kind: "assistant",
          text: errorMsg,
          status: "error",
        },
      ])
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const [skillsOpen, setSkillsOpen] = useState(false)

  const handleSkillClick = (skill: Skill) => {
    setDraft((prev) => (prev.trim() ? `${prev.trim()} ${skill.prompt}` : skill.prompt))
    setSkillsOpen(false)
    draftRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-muted/20">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-background">
        <Sparkles className="h-3.5 w-3.5 text-orange-600" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Trans>Edit with AI</Trans>
        </span>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setMessages([])}
            disabled={busy}
            aria-label={t`Clear chat history`}
            title={t`Clear chat history`}
            className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
            <Trans>Clear</Trans>
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        <ChatMessage
          message={{
            id: "intro",
            kind: "assistant",
            text: intro,
            status: "done",
            intro: true,
          }}
        />
        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}
      </div>

      <div className="border-t bg-background p-2">
        {!hasApiKey && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-2">
            <Trans>Set an OpenAI API key in Settings to use AI.</Trans>
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={draftRef}
            value={draft}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              item.kind === "quiz"
                ? t`e.g. "make the question harder"`
                : t`e.g. "rephrase blank 2 to mention photosynthesis"`
            }
            rows={2}
            className="flex-1 text-xs rounded-md border bg-background px-2 py-1.5 resize-none focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            aria-label={t`Send`}
            className={cn(
              "shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md bg-orange-600 text-white hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
            )}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          {skills.length > 0 ? (
            <Popover open={skillsOpen} onOpenChange={setSkillsOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={busy}
                  className="inline-flex items-center gap-1 text-[10px] font-medium rounded-md border bg-background px-2 py-1 hover:bg-muted hover:border-orange-300 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Wand2 className="h-3 w-3 text-orange-600" />
                  <Trans>Suggestions</Trans>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                side="top"
                sideOffset={6}
                className="w-64 p-1"
              >
                <div className="flex flex-col">
                  {skills.map((skill) => (
                    <button
                      key={skill.label}
                      type="button"
                      onClick={() => handleSkillClick(skill)}
                      className="text-left rounded px-2 py-1.5 hover:bg-muted transition-colors cursor-pointer"
                    >
                      <div className="text-xs font-medium text-foreground">
                        {skill.label}
                      </div>
                      <div className="text-[10px] text-muted-foreground line-clamp-2 leading-snug mt-0.5">
                        {skill.prompt}
                      </div>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <span />
          )}
          <p className="text-[10px] text-muted-foreground">
            <Trans>⌘+Enter to send</Trans>
          </p>
        </div>
      </div>
    </div>
  )
}

function ChatMessage({ message }: { message: Message }) {
  if (message.kind === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl bg-orange-600 text-white px-3 py-1.5 text-xs leading-snug">
          {message.text}
        </div>
      </div>
    )
  }
  const tone = message.intro
    ? "bg-orange-50 border border-orange-200 text-foreground"
    : message.status === "error"
      ? "bg-red-50 text-red-700 border border-red-200"
      : message.status === "pending"
        ? "bg-violet-50 text-violet-700 border border-violet-200"
        : "bg-background border text-foreground"
  return (
    <div className="flex justify-start gap-1.5">
      {message.intro && (
        <div className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-orange-600 text-white flex items-center justify-center">
          <Sparkles className="h-2.5 w-2.5" />
        </div>
      )}
      <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-snug whitespace-pre-line", tone)}>
        {message.status === "pending" && (
          <Loader2 className="inline h-3 w-3 mr-1 animate-spin" />
        )}
        {message.text}
      </div>
    </div>
  )
}

function truncate(s: string, max: number): string {
  const trimmed = s.trim()
  if (trimmed.length <= max) return trimmed
  return trimmed.slice(0, max - 1).trimEnd() + "…"
}

function stripLeadingLabel(s: string): string {
  return s.replace(/^\s*\d+\)\s*/, "").trim()
}

function loadHistory(storageKey: string): Message[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as Message[]
  } catch {
    return []
  }
}

function saveHistory(storageKey: string, messages: Message[]): void {
  if (typeof window === "undefined") return
  try {
    if (messages.length === 0) {
      window.localStorage.removeItem(storageKey)
    } else {
      window.localStorage.setItem(storageKey, JSON.stringify(messages))
    }
  } catch {
    // localStorage quota / unavailable — silently drop persistence
  }
}

function normalizeOption(opt: QuizOption): string {
  const text = stripLeadingLabel(opt.text).toLowerCase().replace(/\s+/g, " ").trim()
  const explanation = opt.explanation.trim().toLowerCase()
  return `${text}||${explanation}`
}

type QuizDiff =
  | { kind: "question-rewritten" }
  | { kind: "options-rewritten"; count: number }
  | { kind: "correct-answer-changed"; nextText?: string }

/** Compare two quizzes by content (ignoring option order from shuffling) and
 *  return structured diff tokens. The caller renders them with the i18n macro. */
function describeQuizDiff(prev: QuizItem, next: QuizItem): QuizDiff[] {
  const changes: QuizDiff[] = []

  if (prev.question.trim() !== next.question.trim()) {
    changes.push({ kind: "question-rewritten" })
  }

  const prevSet = new Set(prev.options.map(normalizeOption))
  const nextSet = new Set(next.options.map(normalizeOption))
  const addedOrChanged = [...nextSet].filter((k) => !prevSet.has(k)).length
  if (addedOrChanged > 0) {
    changes.push({ kind: "options-rewritten", count: addedOrChanged })
  }

  const prevCorrect = normalizeOption(prev.options[prev.answerIndex] ?? prev.options[0])
  const nextCorrect = normalizeOption(next.options[next.answerIndex] ?? next.options[0])
  if (prevCorrect !== nextCorrect) {
    changes.push({
      kind: "correct-answer-changed",
      nextText: next.options[next.answerIndex]?.text,
    })
  }

  return changes
}
