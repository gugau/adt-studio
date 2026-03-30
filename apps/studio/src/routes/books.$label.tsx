import { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from "react"
import { createFileRoute, Outlet, useParams, useNavigate, Link, useMatchRoute } from "@tanstack/react-router"
import { Home, Terminal, Eye, FileDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StageSidebar } from "@/components/pipeline/StageSidebar"
import { useBook } from "@/hooks/use-books"
import { useBookRun, useBookRunStatus, BookRunProvider } from "@/hooks/use-book-run"
import { useExportWatcherSetup, ExportWatcherProvider } from "@/hooks/use-export-watcher"
import { RightSidebarProvider } from "@/components/pipeline/RightSidebarContext"
import { RightSidebar } from "@/components/pipeline/RightSidebar"
import { STAGES } from "@/components/pipeline/stage-config"
import { getStageLabelI18n } from "@/components/pipeline/pipeline-i18n"
import { cn } from "@/lib/utils"
import { useLingui } from "@lingui/react/macro"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// Section navigation context — shared between sidebar and all views
interface SectionNavContext {
  sectionIndex: number
  setSectionIndex: (index: number | ((prev: number) => number)) => void
  /** Set to true before a page change to prevent the parent from resetting sectionIndex to 0 */
  skipNextResetRef: React.MutableRefObject<boolean>
}
const SectionNavCtx = createContext<SectionNavContext>({
  sectionIndex: 0,
  setSectionIndex: () => {},
  skipNextResetRef: { current: false },
})
export function useSectionNav() { return useContext(SectionNavCtx) }

export const Route = createFileRoute("/books/$label")({
  component: BookLayout,
})

function BookLayout() {
  const { label } = Route.useParams()
  const bookRun = useBookRunStatus(label)

  return (
    <BookRunProvider value={bookRun}>
      <BookLayoutInner label={label} />
    </BookRunProvider>
  )
}

function BookLayoutInner({ label }: { label: string }) {
  const { step, pageId } = useParams({ strict: false }) as { step?: string; pageId?: string }
  const matchRoute = useMatchRoute()
  const navigate = useNavigate()
  const { t } = useLingui()
  const { data: book } = useBook(label)
  const { stageState } = useBookRun()
  const isDebugRoute = !!matchRoute({ to: "/books/$label/debug", params: { label } })
  const exportWatcher = useExportWatcherSetup(label)

  const openDebugWindow = useCallback(() => {
    window.open(`/books/${label}/debug`, `debug-${label}`, "width=900,height=700")
  }, [label])

  const activeStep = step ?? "book"
  const isMainStep = STAGES.some((s) => s.slug === activeStep) || activeStep === "book"
  const [addOpen, setAddOpen] = useState(false)

  const goToStep = useCallback((next: string) => {
    navigate({ to: "/books/$label/$step", params: { label, step: next } })
  }, [navigate, label])

  // Section index state — shared between sidebar and all views
  const [sectionIndex, setSectionIndex] = useState(0)
  const skipNextResetRef = useRef(false)
  const prevPageIdRef = useRef(pageId)
  const prevStepRef = useRef(activeStep)

  // Reset section index when page or step changes (unless a child signalled to skip)
  useEffect(() => {
    if (prevPageIdRef.current !== pageId || prevStepRef.current !== activeStep) {
      if (!skipNextResetRef.current) {
        setSectionIndex(0)
      }
      skipNextResetRef.current = false
      prevPageIdRef.current = pageId
      prevStepRef.current = activeStep
    }
  }, [pageId, activeStep])

  const sectionNav = useMemo(() => ({ sectionIndex, setSectionIndex, skipNextResetRef }), [sectionIndex, setSectionIndex])

  const onSelectPage = useCallback(
    (pid: string | null) => {
      if (pid) {
        navigate({
          to: "/books/$label/$step/$pageId",
          params: { label, step: activeStep, pageId: pid },
        })
      } else {
        navigate({
          to: "/books/$label/$step",
          params: { label, step: activeStep },
        })
      }
    },
    [navigate, label, activeStep]
  )

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (isDebugRoute) return
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "d") {
      e.preventDefault()
      openDebugWindow()
    }
  }, [isDebugRoute, openDebugWindow])

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  if (isDebugRoute) {
    return (
      <div className="flex flex-1 min-h-0 flex-col">
        <Outlet />
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-1 min-h-0 flex-col">
        <div className="flex flex-1 min-h-0">
          {/* Left sidebar */}
          <div className="w-[220px] shrink-0 relative">
            <div className="absolute inset-y-0 left-0 w-full bg-background flex flex-col z-30 overflow-hidden">
              {/* App header */}
              <div className="shrink-0 h-10 flex items-center bg-gray-700 text-white border-r border-gray-700">
                <Link
                  to="/"
                  className="flex-1 min-w-0 h-full px-4 flex items-center justify-start gap-2.5 hover:bg-gray-800 transition-colors"
                  title="Back to books"
                >
                  <Home className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-semibold truncate">
                    ADT Studio
                  </span>
                </Link>
              </div>

              {/* Steps / Pages */}
              <div className="flex-1 min-h-0 flex flex-col border-r border-gray-300">
                <StageSidebar
                  bookLabel={label}
                  activeStep={activeStep}
                  selectedPageId={pageId}
                  onSelectPage={onSelectPage}
                  sectionIndex={sectionIndex}
                  onSelectSection={setSectionIndex}
                />
              </div>
            </div>
          </div>

          {/* Main content */}
          <RightSidebarProvider>
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              {/* Topbar navigation */}
              <div className="shrink-0 h-11 border-b bg-background px-3 flex items-center gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {(() => {
                    const stageButtons = STAGES.filter((s) => s.slug !== "preview" && s.slug !== "export")
                      .filter((s) => s.slug === "book" || s.slug === "extract" || stageState(s.slug) !== "idle")

                    return (
                      <>
                        {stageButtons.map((s) => (
                          <Button
                            key={s.slug}
                            variant={activeStep === s.slug ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => goToStep(s.slug)}
                            className="shrink-0 gap-1.5"
                          >
                            <s.icon className="h-4 w-4" />
                            {s.slug === "book" ? t`Book` : getStageLabelI18n(s.slug)}
                          </Button>
                        ))}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAddOpen(true)}
                          className="shrink-0"
                        >
                          {t`Add`}
                        </Button>

                        <Dialog open={addOpen} onOpenChange={setAddOpen}>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>{t`Add stage`}</DialogTitle>
                              <DialogDescription>
                                {t`Choose a pipeline stage to open. It will appear in the top bar after it has been run.`}
                              </DialogDescription>
                            </DialogHeader>

                            <div className="mt-3 grid gap-2">
                              {STAGES.filter((s) => s.slug !== "book" && s.slug !== "extract" && s.slug !== "preview" && s.slug !== "export").map((s) => {
                                const alreadyShown = stageState(s.slug) !== "idle"
                                return (
                                  <Button
                                    key={s.slug}
                                    type="button"
                                    variant="outline"
                                    className="justify-start gap-2"
                                    onClick={() => {
                                      setAddOpen(false)
                                      goToStep(s.slug)
                                    }}
                                  >
                                    <s.icon className="h-4 w-4" />
                                    {getStageLabelI18n(s.slug)}
                                    {alreadyShown ? (
                                      <span className="ml-auto text-xs text-muted-foreground">{t`Already added`}</span>
                                    ) : null}
                                  </Button>
                                )
                              })}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </>
                    )
                  })()}
                </div>
                <div className="flex-1" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToStep("preview")}
                  className="gap-1.5"
                >
                  <Eye className="h-4 w-4" />
                  {t`Preview`}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToStep("export")}
                  className="gap-1.5"
                >
                  <FileDown className="h-4 w-4" />
                  {t`Export`}
                </Button>
              </div>

              <div className="flex-1 min-h-0 flex overflow-hidden">
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                  <SectionNavCtx.Provider value={sectionNav}>
                    <ExportWatcherProvider value={exportWatcher}>
                      <Outlet />
                    </ExportWatcherProvider>
                  </SectionNavCtx.Provider>
                </div>
                <RightSidebar />
              </div>
            </div>
          </RightSidebarProvider>
        </div>

      </div>

      {!isDebugRoute && (
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-4 right-4 h-8 w-8 rounded-full shadow-md z-50 opacity-60 hover:opacity-100"
          onClick={openDebugWindow}
          title="Debug Panel (Cmd+Shift+D)"
        >
          <Terminal className="h-4 w-4" />
        </Button>
      )}
    </>
  )
}
