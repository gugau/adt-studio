import { useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, Loader2, RotateCcw, ShieldCheck } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { api } from "@/api/client"
import { useBookRun } from "@/hooks/use-book-run"
import { AccessibilityConfigTab, AccessibilityOverviewTab } from "@/components/validation/AccessibilityValidationTabs"
import { ReviewerValidationSummaryTab } from "@/components/validation/ReviewerValidationSummaryTab"

const VALIDATION_TABS = new Set([
  "accessibility-summary",
  "accessibility-config",
  "reviewer-validation",
] as const)

function normalizeValidationTab(value: string | undefined) {
  return value && VALIDATION_TABS.has(value as never) ? value : "accessibility-summary"
}

export function ValidationView({ bookLabel }: { bookLabel: string }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { tab?: string }
  const { stageState } = useBookRun()
  const storyboardDone = stageState("storyboard") === "done"
  const ranRef = useRef(false)
  const [packaging, setPackaging] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const tab = useMemo(() => normalizeValidationTab(search.tab), [search.tab])

  const runPackage = async () => {
    setPackaging(true)
    setError(null)
    try {
      await api.packageAdt(bookLabel)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["books", bookLabel, "step-status"] }),
        queryClient.invalidateQueries({ queryKey: ["debug", "accessibility", bookLabel] }),
        queryClient.invalidateQueries({ queryKey: ["debug", "versions", bookLabel, "accessibility-assessment", "book"] }),
        queryClient.invalidateQueries({ queryKey: ["book-config", bookLabel] }),
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Packaging failed")
    } finally {
      setPackaging(false)
    }
  }

  useEffect(() => {
    if (!storyboardDone || ranRef.current) return
    ranRef.current = true
    void runPackage()
  }, [bookLabel, storyboardDone])

  if (!storyboardDone) {
    return (
      <div className="p-6 max-w-xl flex flex-col items-center gap-3 text-center">
        <AlertCircle className="w-8 h-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          A storyboard must be built before running validation.
        </p>
        <p className="text-sm text-muted-foreground">
          Run the pipeline through
          at least the <span className="font-medium text-foreground">Storyboard</span> stage first.
        </p>
      </div>
    )
  }

  if (packaging) {
    return (
      <div className="flex h-full items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        <span className="text-sm">Packaging validation results...</span>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/20">
      <div className="border-b border-border bg-background/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Validation</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Whole-book checks for packaged ADT output, plus reviewer findings captured from Preview.
              </p>
            </div>
          </div>

          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => void runPackage()}>
            <RotateCcw className="h-3.5 w-3.5" />
            Refresh validation
          </Button>
        </div>

        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          void navigate({
            to: "/books/$label/$step",
            params: { label: bookLabel, step: "validation" },
            search: { tab: value },
            replace: true,
          })
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="border-b border-border bg-background px-4 py-2">
          <TabsList className="h-auto gap-1 bg-muted/80 p-1">
            <TabsTrigger value="accessibility-summary" className="px-3 py-1.5 text-xs">
              Accessibility Summary
            </TabsTrigger>
            <TabsTrigger value="accessibility-config" className="px-3 py-1.5 text-xs">
              Accessibility Config
            </TabsTrigger>
            <TabsTrigger value="reviewer-validation" className="px-3 py-1.5 text-xs">
              Reviewer Validation
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <TabsContent value="accessibility-summary" className="m-0 h-full">
            <AccessibilityOverviewTab label={bookLabel} />
          </TabsContent>
          <TabsContent value="accessibility-config" className="m-0 h-full">
            <AccessibilityConfigTab label={bookLabel} />
          </TabsContent>
          <TabsContent value="reviewer-validation" className="m-0 h-full">
            <ReviewerValidationSummaryTab
              label={bookLabel}
              onOpenPreview={() => navigate({
                to: "/books/$label/$step",
                params: { label: bookLabel, step: "preview" },
              })}
              onOpenPreviewToPage={(href) => navigate({
                to: "/books/$label/$step",
                params: { label: bookLabel, step: "preview" },
                search: { previewHref: href },
              })}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
