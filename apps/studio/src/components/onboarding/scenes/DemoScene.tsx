import { useCallback, useEffect, useRef, useState } from "react"
import { FileText, Check } from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import { cn } from "@/lib/utils"
import { getPipelineStages } from "@/components/pipeline/stage-config"
import {
  getStageLabelI18n,
  getStageDescriptionI18n,
} from "@/components/pipeline/pipeline-i18n"
import { Switch } from "@/components/ui/switch"
import { BrowserChrome } from "../BrowserChrome"
import { Cursor } from "../Cursor"
import type { OnboardingStepProps } from "../steps"

type Phase =
  | "enter"
  | "dragging"
  | "dropped"
  | "toggles"
  | "starting"
  | "pipeline"
  | "done"

const PIPELINE_STAGES = getPipelineStages().slice(0, 5)
const STAGE_STEP_MS = 500
const FLIP_SLUGS = ["quizzes", "glossary"] as const

const DEMO_FILE = {
  get name() {
    return ["chapter-01", "pdf"].join(".")
  },
  get size() {
    return "2.4 MB"
  },
}

export function DemoScene({ onNext }: OnboardingStepProps) {
  const { t } = useLingui()
  const [phase, setPhase] = useState<Phase>("enter")
  const [cursor, setCursor] = useState({ x: 15, y: 115 })
  const [clicking, setClicking] = useState(false)
  const [completedStages, setCompletedStages] = useState(0)
  const [toggles, setToggles] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    const flipSet = new Set<string>(FLIP_SLUGS)
    for (const s of PIPELINE_STAGES) {
      map[s.slug] = !flipSet.has(s.slug)
    }
    return map
  })

  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const toggleRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const startRef = useRef<HTMLButtonElement>(null)

  const getRelativePos = useCallback(
    (el: HTMLElement | null): { x: number; y: number } | null => {
      if (!el || !containerRef.current) return null
      const target = el.getBoundingClientRect()
      const container = containerRef.current.getBoundingClientRect()
      if (container.width === 0 || container.height === 0) return null
      return {
        x: ((target.left + target.width / 2 - container.left) / container.width) * 100,
        y: ((target.top + target.height / 2 - container.top) / container.height) * 100,
      }
    },
    [],
  )

  const moveTo = useCallback(
    (el: HTMLElement | null, fallback: { x: number; y: number }) => {
      const pos = getRelativePos(el)
      setCursor(pos ?? fallback)
    },
    [getRelativePos],
  )

  useEffect(() => {
    const push = (fn: () => void, ms: number) => {
      timers.current.push(setTimeout(fn, ms))
    }

    // 1) Cursor drags file in from off-screen toward drop zone
    push(() => {
      setPhase("dragging")
      moveTo(dropZoneRef.current, { x: 50, y: 45 })
    }, 400)

    // 2) File "lands" — ghost fades out, resting file fades in
    push(() => setPhase("dropped"), 1700)

    // 3) Transition to toggles
    push(() => setPhase("toggles"), 2900)

    // 4) Flip toggles
    let cursorT = 3400
    for (const slug of FLIP_SLUGS) {
      push(() => moveTo(toggleRefs.current[slug], { x: 62, y: 45 }), cursorT)
      push(() => {
        setClicking(true)
        setToggles((prev) => ({ ...prev, [slug]: !prev[slug] }))
      }, cursorT + 700)
      push(() => setClicking(false), cursorT + 900)
      cursorT += 1200
    }

    // 5) Click "Start processing"
    push(() => moveTo(startRef.current, { x: 72, y: 88 }), cursorT)
    push(() => {
      setClicking(true)
      setPhase("starting")
    }, cursorT + 700)
    push(() => setClicking(false), cursorT + 900)

    // 6) Transition to pipeline
    push(() => {
      setCursor({ x: 95, y: 95 })
      setPhase("pipeline")
    }, cursorT + 1200)

    const pipelineStart = cursorT + 1600
    for (let s = 1; s <= PIPELINE_STAGES.length; s++) {
      push(() => setCompletedStages(s), pipelineStart + s * STAGE_STEP_MS)
    }

    push(() => {
      setPhase("done")
      onNext()
    }, pipelineStart + PIPELINE_STAGES.length * STAGE_STEP_MS + 1500)

    return () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
  }, [onNext, moveTo])

  const showingDrop = phase === "enter" || phase === "dragging" || phase === "dropped"
  const showingGhost = phase === "dragging"
  const showingToggles = phase === "toggles" || phase === "starting"
  const showingPipeline = phase === "pipeline" || phase === "done"

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-8 p-8">
      <div className="animate-onboarding-fade-up relative flex max-w-lg flex-col items-center gap-3 text-center [animation-delay:120ms]">
        <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          <Trans>See it in action</Trans>
        </span>
        <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {showingPipeline ? (
            <Trans>Every stage, fully inspectable.</Trans>
          ) : showingToggles ? (
            <Trans>Pick the stages to run.</Trans>
          ) : (
            <Trans>Drop a PDF and go.</Trans>
          )}
        </h2>
      </div>

      <div
        ref={containerRef}
        className="w-xl animate-onboarding-fade-up relative [animation-delay:240ms]"
      >
        <BrowserChrome url="adt-studio.app">
          {/* DROP VIEW */}
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center p-10 transition-all duration-500",
              showingDrop ? "opacity-100" : "pointer-events-none -translate-y-4 opacity-0",
            )}
          >
            <div
              ref={dropZoneRef}
              className={cn(
                "relative flex h-56 w-[440px] items-center justify-center rounded-2xl border-2 border-dashed transition-colors duration-300",
                phase === "dropped"
                  ? "border-primary/60 bg-primary/5"
                  : phase === "dragging"
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-muted/30",
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3 shadow-md transition-all duration-500 ease-out",
                  phase === "dropped" || phase === "toggles" || phase === "starting"
                    ? "opacity-100 scale-100"
                    : "pointer-events-none opacity-0 scale-95",
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-foreground">{DEMO_FILE.name}</div>
                  <div className="text-xs text-muted-foreground">{DEMO_FILE.size}</div>
                </div>
                <div className="ml-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3.5 w-3.5" />
                </div>
              </div>
              {(phase === "enter" || phase === "dragging") && (
                <span className="absolute bottom-4 text-[11px] text-muted-foreground">
                  {phase === "dragging" ? (
                    <Trans>Release to upload</Trans>
                  ) : (
                    <Trans>Drop your PDF here</Trans>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* TOGGLES VIEW */}
          <div
            className={cn(
              "absolute inset-0 overflow-hidden p-8 transition-all duration-500",
              showingToggles
                ? "translate-y-0 opacity-100"
                : "pointer-events-none translate-y-4 opacity-0",
            )}
          >
            <div className="mx-auto flex h-full max-w-2xl flex-col gap-4">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">{DEMO_FILE.name}</div>
                  <div className="text-xs text-muted-foreground">{DEMO_FILE.size}</div>
                </div>
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3.5 w-3.5" />
                </div>
              </div>

              <div className="flex-1 space-y-2">
                <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  <Trans>Stages to run</Trans>
                </h4>
                {PIPELINE_STAGES.map((stage) => {
                  const Icon = stage.icon
                  const label = getStageLabelI18n(stage.slug)
                  const checked = toggles[stage.slug] ?? false
                  return (
                    <div
                      key={stage.slug}
                      ref={(el) => {
                        toggleRefs.current[stage.slug] = el
                      }}
                      className={cn(
                        "flex items-center justify-between rounded-lg border border-border px-3 py-2 transition-colors",
                        checked ? "bg-card" : "bg-muted/40",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-sm text-foreground">{label}</span>
                      </div>
                      <Switch checked={checked} onCheckedChange={() => {}} />
                    </div>
                  )
                })}
              </div>

              <div className="flex justify-end">
                <button
                  ref={startRef}
                  type="button"
                  className={cn(
                    "flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-transform",
                    phase === "starting" && "scale-95",
                  )}
                >
                  <Trans>Start processing</Trans>
                </button>
              </div>
            </div>
          </div>

          {/* PIPELINE VIEW */}
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center overflow-hidden p-6 transition-all duration-500",
              showingPipeline
                ? "opacity-100"
                : "pointer-events-none translate-y-4 opacity-0",
            )}
          >
            <PipelineDiagram completed={completedStages} />
          </div>
        </BrowserChrome>

        {/* Dragged ghost file — follows the cursor, shares its coord space */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute z-40 flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3 shadow-2xl transition-all ease-[cubic-bezier(0.22,1,0.36,1)]",
            showingGhost ? "opacity-100" : "opacity-0",
          )}
          style={{
            left: `${cursor.x}%`,
            top: `${cursor.y}%`,
            transform: "translate(4px, 14px) rotate(-3deg) scale(1.04)",
            transitionDuration: "900ms",
          }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-foreground">{DEMO_FILE.name}</div>
            <div className="text-xs text-muted-foreground">{DEMO_FILE.size}</div>
          </div>
        </div>

        <Cursor
          x={cursor.x}
          y={cursor.y}
          visible={phase !== "done"}
          clicking={clicking}
        />
      </div>
    </div>
  )
}

function PipelineDiagram({ completed }: { completed: number }) {
  return (
    <div className="flex w-full max-w-md flex-col">
      <h3 className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        <Trans>Pipeline stages</Trans>
      </h3>
      <ol className="flex flex-col gap-0.5">
        {PIPELINE_STAGES.map((stage, i) => {
          const Icon = stage.icon
          const label = getStageLabelI18n(stage.slug)
          const description = getStageDescriptionI18n(stage.slug) ?? ""
          const isDone = i < completed
          const isActive = i === completed
          return (
            <li
              key={stage.slug}
              className={cn(
                "flex items-start gap-3 rounded-lg px-2 py-1.5 transition-all duration-300",
                isDone
                  ? "opacity-100"
                  : isActive
                    ? "bg-accent/60 opacity-100"
                    : "opacity-45",
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors",
                  isDone
                    ? "border-primary bg-primary text-primary-foreground"
                    : isActive
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-muted text-muted-foreground",
                )}
              >
                {isDone ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium leading-tight text-foreground">
                    {label}
                  </span>
                  {isActive && (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                  )}
                </div>
                {description && (
                  <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-muted-foreground">
                    {description}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
