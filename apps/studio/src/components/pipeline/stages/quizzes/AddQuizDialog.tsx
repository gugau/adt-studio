import { useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Check, Loader2 } from "lucide-react"
import { useLingui } from "@lingui/react/macro"
import { api } from "@/api/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { usePages, usePageImage } from "@/hooks/use-pages"
import { useApiKey } from "@/hooks/use-api-key"

const MAX_SOURCE_PAGES = 5

/** Selectable page card with a lazily-loaded thumbnail preview. */
function PagePickCard({
  bookLabel,
  page,
  checked,
  disabled,
  onToggle,
}: {
  bookLabel: string
  page: { pageId: string; pageNumber: number }
  checked: boolean
  disabled: boolean
  onToggle: () => void
}) {
  const { t } = useLingui()
  const ref = useRef<HTMLButtonElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (visible) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { rootMargin: "200px" },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [visible])

  const { data } = usePageImage(bookLabel, page.pageId, { enabled: visible })
  const src = data?.imageBase64
    ? `data:image/png;base64,${data.imageBase64}`
    : null

  return (
    <button
      ref={ref}
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={checked}
      className={cn(
        "group aspect-video relative flex flex-col overflow-hidden rounded-md border text-left transition-all",
        checked
          ? "border-orange-500 ring-2 ring-orange-500/40"
          : "border-border hover:border-orange-300",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <div className="relative h-full w-full bg-muted">
        <div className="absolute inset-x-0 bottom-0 flex items-end bg-linear-to-t from-black/75 to-transparent px-1.5 pb-1 pt-4">
          <span className="text-sm font-semibold text-white drop-shadow-sm">
            {t`Page ${page.pageNumber}`}
          </span>
        </div>
        {src ? (
          <img
            src={src}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {checked && (
          <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-white shadow ring-2 ring-white">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        )}

      </div>
    </button>
  )
}

export function AddQuizDialog({
  open,
  onOpenChange,
  bookLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookLabel: string
}) {
  const { t } = useLingui()
  const { data: pages } = usePages(bookLabel)
  const {
    apiKey,
    hasApiKey,
    anthropicKey,
    googleKey,
    customBaseUrl,
    customApiKey,
    geminiKey,
  } = useApiKey()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [selected, setSelected] = useState<string[]>([])
  const [afterPageId, setAfterPageId] = useState("")
  const [afterTouched, setAfterTouched] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const renderedPages = useMemo(
    () => (pages ?? []).filter((p) => p.hasRendering),
    [pages]
  )

  useEffect(() => {
    if (open) {
      setSelected([])
      setAfterPageId("")
      setAfterTouched(false)
      setGenerating(false)
      setError(null)
    }
  }, [open])

  // Default the placement to the last selected page until the user overrides it.
  useEffect(() => {
    if (afterTouched) return
    if (selected.length === 0) {
      setAfterPageId("")
      return
    }
    const numberById = new Map(renderedPages.map((p) => [p.pageId, p.pageNumber]))
    const last = [...selected].sort(
      (a, b) => (numberById.get(a) ?? 0) - (numberById.get(b) ?? 0)
    )[selected.length - 1]
    setAfterPageId(last)
  }, [selected, afterTouched, renderedPages])

  const toggle = (pageId: string) => {
    setError(null)
    setSelected((prev) => {
      if (prev.includes(pageId)) return prev.filter((id) => id !== pageId)
      if (prev.length >= MAX_SOURCE_PAGES) return prev
      return [...prev, pageId]
    })
  }

  const handleGenerate = async () => {
    if (!hasApiKey || selected.length === 0 || !afterPageId || generating) return
    setGenerating(true)
    setError(null)
    try {
      await api.generateQuiz(
        bookLabel,
        apiKey,
        { pageIds: selected, afterPageId },
        {
          anthropicApiKey: anthropicKey || undefined,
          googleApiKey: googleKey || undefined,
          customBaseUrl: customBaseUrl || undefined,
          customApiKey: customApiKey || undefined,
          geminiApiKey: geminiKey || undefined,
        }
      )
      await queryClient.invalidateQueries({
        queryKey: ["books", bookLabel, "quizzes"],
      })
      onOpenChange(false)
      navigate({
        to: "/books/$label/$step",
        params: { label: bookLabel, step: "quizzes" },
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : t`Failed to generate the quiz.`)
    } finally {
      setGenerating(false)
    }
  }

  const atLimit = selected.length >= MAX_SOURCE_PAGES

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] flex-col sm:max-w-3xl"
        style={
          {
            "--accent-color": "#ea580c",
            "--ring": "#ea580c",
          } as React.CSSProperties
        }
      >
        <DialogHeader>
          <DialogTitle>{t`Add a quiz`}</DialogTitle>
          <DialogDescription>
            {t`Pick the pages the quiz is written from and choose where it appears in the book.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex min-h-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>{t`Source pages`}</Label>
              <span className="text-xs text-muted-foreground">
                {t`${selected.length}/${MAX_SOURCE_PAGES} selected`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t`Choose up to ${MAX_SOURCE_PAGES} pages whose content the quiz question is based on.`}
            </p>
            {renderedPages.length === 0 ? (
              <p className="rounded-md border px-3 py-4 text-xs text-muted-foreground">
                {t`No rendered pages yet. Run Storyboard first.`}
              </p>
            ) : (
              <div className="grid min-h-0 flex-1 grid-cols-3 gap-2 overflow-y-auto rounded-md border p-2 sm:grid-cols-4 md:grid-cols-5">
                {renderedPages.map((page) => {
                  const checked = selected.includes(page.pageId)
                  return (
                    <PagePickCard
                      key={page.pageId}
                      bookLabel={bookLabel}
                      page={page}
                      checked={checked}
                      disabled={!checked && atLimit}
                      onToggle={() => toggle(page.pageId)}
                    />
                  )
                })}
              </div>
            )}
          </div>

          <div className="shrink-0 space-y-1.5">
            <Label htmlFor="quiz-after-page">{t`Show quiz after`}</Label>
            <select
              id="quiz-after-page"
              value={afterPageId}
              onChange={(e) => {
                setAfterTouched(true)
                setAfterPageId(e.target.value)
              }}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="" disabled>
                {t`Select a page…`}
              </option>
              {renderedPages.map((page) => (
                <option key={page.pageId} value={page.pageId}>
                  {t`Page ${page.pageNumber}`}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {t`The quiz is inserted into the book right after this page.`}
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
            {t`Cancel`}
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generating || !hasApiKey || selected.length === 0 || !afterPageId}
            className="bg-orange-600 text-white hover:bg-orange-700 border-0"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t`Generating…`}
              </>
            ) : (
              t`Generate quiz`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
