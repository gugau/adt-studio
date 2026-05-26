import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Check, ChevronLeft, ChevronRight, Loader2, Puzzle } from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { api } from "@/api/client"
import { usePages } from "@/hooks/use-pages"
import { useApiKey } from "@/hooks/use-api-key"
import {
  SECTION_TYPE_GROUPS,
  getSectionTypeDescription,
  getSectionTypeLabel,
} from "@/lib/section-constants"
import { cn } from "@/lib/utils"
import { PageThumb } from "./PageThumb"

const ACTIVITY_TEMPLATES = SECTION_TYPE_GROUPS.find((g) => g.id === "activities")?.types ?? []
const SUPPORTED_TEMPLATES = ACTIVITY_TEMPLATES.filter((t) => t.value !== "activity_other")

interface AddActivityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookLabel: string
  onCreated?: (pageId: string, sectionIndex: number) => void
}

type Step = "pages" | "template" | "prompt"

export function AddActivityDialog({
  open,
  onOpenChange,
  bookLabel,
  onCreated,
}: AddActivityDialogProps) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const { apiKey, hasApiKey } = useApiKey()
  const { data: pages } = usePages(bookLabel)

  const [step, setStep] = useState<Step>("pages")
  const [contextPageIds, setContextPageIds] = useState<string[]>([])
  const [sectionType, setSectionType] = useState<string | null>(null)
  const [extraInstructions, setExtraInstructions] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setStep("pages")
    setContextPageIds([])
    setSectionType(null)
    setExtraInstructions("")
    setError(null)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const togglePage = (pageId: string) => {
    setContextPageIds((prev) =>
      prev.includes(pageId) ? prev.filter((p) => p !== pageId) : [...prev, pageId],
    )
  }

  const canGoNext =
    step === "pages"
      ? contextPageIds.length > 0
      : step === "template"
        ? sectionType !== null
        : true

  const canSubmit = !!sectionType && contextPageIds.length > 0 && hasApiKey && !submitting

  const goNext = () => {
    if (step === "pages" && canGoNext) setStep("template")
    else if (step === "template" && canGoNext) setStep("prompt")
  }
  const goBack = () => {
    if (step === "template") setStep("pages")
    else if (step === "prompt") setStep("template")
  }

  const handleSubmit = async () => {
    if (!canSubmit || !sectionType) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await api.createActivity(
        bookLabel,
        {
          contextPageIds,
          sectionType,
          extraInstructions: extraInstructions.trim() || undefined,
        },
        apiKey,
      )
      await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "activities"] })
      await queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "pages", result.pageId] })
      onCreated?.(result.pageId, result.sectionIndex)
      handleOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const lastContextPage = useMemo(
    () => contextPageIds[contextPageIds.length - 1] ?? null,
    [contextPageIds],
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Puzzle className="h-4 w-4 text-violet-600" />
            <Trans>Add activity</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>
              Generate a new interactive activity using selected pages as
              context.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <StepIndicator step={step} />

        <div className="flex-1 overflow-y-auto py-2 px-1">
          {step === "pages" && (
            <section>
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                <Trans>Pick context pages</Trans>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                <Trans>
                  The activity will be generated using these pages and placed at
                  the end of the last selected page.
                </Trans>
              </p>
              <div className="flex flex-wrap gap-2 max-h-72 overflow-y-auto pr-1">
                {(pages ?? []).map((page) => (
                  <PageThumb
                    key={page.pageId}
                    bookLabel={bookLabel}
                    pageId={page.pageId}
                    selected={contextPageIds.includes(page.pageId)}
                    height="sm"
                    onClick={() => togglePage(page.pageId)}
                  />
                ))}
              </div>
              {contextPageIds.length > 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  <Trans>
                    {contextPageIds.length} pages selected. The activity will
                    appear at the end of {lastContextPage ?? ""}.
                  </Trans>
                </p>
              )}
            </section>
          )}

          {step === "template" && (
            <section>
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                <Trans>Pick a template</Trans>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUPPORTED_TEMPLATES.map((tpl) => {
                  const selected = sectionType === tpl.value
                  return (
                    <button
                      key={tpl.value}
                      type="button"
                      onClick={() => setSectionType(tpl.value)}
                      className={cn(
                        "text-left rounded-md border p-3 transition-colors cursor-pointer",
                        selected
                          ? "border-violet-500 bg-violet-50 ring-1 ring-violet-300"
                          : "border-border bg-background hover:bg-muted/40",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {getSectionTypeLabel(tpl.value).replace(/^Activity:\s*/i, "")}
                        </span>
                        {selected && <Check className="h-3.5 w-3.5 text-violet-600" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                        {getSectionTypeDescription(tpl.value) ?? ""}
                      </p>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {step === "prompt" && (
            <section className="space-y-3">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <Trans>Extra instructions</Trans>
              </div>
              <p className="text-xs text-muted-foreground">
                <Trans>
                  Optional. Describe what you want the activity to focus on, the
                  difficulty level, or any specific phrasing.
                </Trans>
              </p>
              <textarea
                value={extraInstructions}
                onChange={(e) => setExtraInstructions(e.target.value)}
                rows={6}
                placeholder={t`e.g. "focus on the water cycle vocabulary; use exactly 4 blanks"`}
                className="w-full text-sm rounded-md border bg-background px-3 py-2 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors resize-none"
              />

              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Trans>Summary</Trans>
                </div>
                <p>
                  <Trans>Template:</Trans>{" "}
                  <span className="font-medium text-foreground">
                    {sectionType
                      ? getSectionTypeLabel(sectionType).replace(/^Activity:\s*/i, "")
                      : ""}
                  </span>
                </p>
                <p>
                  <Trans>Context:</Trans>{" "}
                  <span className="font-medium text-foreground">
                    {contextPageIds.join(", ")}
                  </span>
                </p>
                <p>
                  <Trans>Placement:</Trans>{" "}
                  <span className="font-medium text-foreground">
                    {t`end of ${lastContextPage ?? ""}`}
                  </span>
                </p>
              </div>
            </section>
          )}

          {!hasApiKey && step === "prompt" && (
            <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              <Trans>Set an OpenAI API key in Settings to generate activities.</Trans>
            </p>
          )}
          {error && (
            <p className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 pt-2 border-t">
          <button
            type="button"
            onClick={step === "pages" ? () => handleOpenChange(false) : goBack}
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md hover:bg-accent transition-colors cursor-pointer"
            disabled={submitting}
          >
            {step === "pages" ? (
              <Trans>Cancel</Trans>
            ) : (
              <>
                <ChevronLeft className="h-3.5 w-3.5" />
                <Trans>Back</Trans>
              </>
            )}
          </button>
          {step === "prompt" ? (
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="inline-flex items-center gap-1.5 text-xs font-medium rounded-md bg-violet-600 text-white px-3 py-1.5 hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <Trans>Generate activity</Trans>
            </button>
          ) : (
            <button
              type="button"
              disabled={!canGoNext}
              onClick={goNext}
              className="inline-flex items-center gap-1 text-xs font-medium rounded-md bg-violet-600 text-white px-3 py-1.5 hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Trans>Next</Trans>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StepIndicator({ step }: { step: Step }) {
  const items: { id: Step; label: string }[] = [
    { id: "pages", label: "Context" },
    { id: "template", label: "Template" },
    { id: "prompt", label: "Prompt" },
  ]
  const currentIndex = items.findIndex((i) => i.id === step)
  return (
    <div className="flex items-center gap-1.5 px-1 pt-1">
      {items.map((item, i) => {
        const active = i === currentIndex
        const done = i < currentIndex
        return (
          <div key={item.id} className="flex items-center gap-1.5">
            <div
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition-colors",
                done
                  ? "bg-violet-600 text-white"
                  : active
                    ? "bg-violet-100 text-violet-700 ring-2 ring-violet-500"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-[11px] font-medium",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {item.label}
            </span>
            {i < items.length - 1 && <span className="text-muted-foreground/40">·</span>}
          </div>
        )
      })}
    </div>
  )
}
