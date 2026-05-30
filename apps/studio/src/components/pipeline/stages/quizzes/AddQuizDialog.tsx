import { useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { useLingui } from "@lingui/react/macro"
import { api } from "@/api/client"
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
import { usePages } from "@/hooks/use-pages"
import { useApiKey } from "@/hooks/use-api-key"

const MAX_SOURCE_PAGES = 5

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
        className="sm:max-w-lg"
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

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{t`Source pages`}</Label>
              <span className="text-xs text-muted-foreground">
                {t`${selected.length}/${MAX_SOURCE_PAGES} selected`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t`Choose up to ${MAX_SOURCE_PAGES} pages whose content the quiz question is based on.`}
            </p>
            <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
              {renderedPages.length === 0 ? (
                <p className="px-3 py-4 text-xs text-muted-foreground">
                  {t`No rendered pages yet. Run Storyboard first.`}
                </p>
              ) : (
                renderedPages.map((page) => {
                  const checked = selected.includes(page.pageId)
                  const disabled = !checked && atLimit
                  return (
                    <label
                      key={page.pageId}
                      className={`flex items-center gap-2.5 px-3 py-1.5 transition-colors ${
                        disabled
                          ? "cursor-not-allowed opacity-40"
                          : "cursor-pointer hover:bg-muted/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggle(page.pageId)}
                        className="h-3.5 w-3.5 rounded border-border accent-orange-600"
                      />
                      <span className="text-xs font-medium shrink-0 w-16">
                        {t`Page ${page.pageNumber}`}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {page.textPreview}
                      </span>
                    </label>
                  )
                })
              )}
            </div>
          </div>

          <div className="space-y-1.5">
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
