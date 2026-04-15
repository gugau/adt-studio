import { useState, useCallback, useEffect, useRef } from "react"
import { ArrowLeft, ArrowRight, FileText, LayoutGrid, HelpCircle, Image, BookOpen, List, Languages, AudioLines, Hand, ShieldCheck, Eye, FileDown, Rocket } from "lucide-react"
import { Trans, useLingui } from "@lingui/react/macro"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"

const STORAGE_KEY = "adt:pipeline-onboarding-seen"

function hasSeen(bookLabel: string): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const set: string[] = JSON.parse(raw)
    return set.includes(bookLabel)
  } catch {
    return false
  }
}

function markSeen(bookLabel: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const set: string[] = raw ? JSON.parse(raw) : []
    if (!set.includes(bookLabel)) {
      set.push(bookLabel)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(set))
    }
  } catch {
    // ignore
  }
}

interface StageItem {
  icon: typeof FileText
  label: string
  color: string
  bgLight: string
}

interface Slide {
  title: string
  description: string
  stages?: StageItem[]
  highlight?: "core" | "enhance" | "output"
}

function CorePathDiagram() {
  return (
    <div className="flex items-center justify-center gap-3 py-2">
      <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
        <FileText className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-700"><Trans>Extract</Trans></span>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground/40" />
      <div className="flex items-center gap-2 rounded-lg bg-violet-50 border border-violet-200 px-3 py-2">
        <LayoutGrid className="w-4 h-4 text-violet-600" />
        <span className="text-sm font-medium text-violet-700"><Trans>Storyboard</Trans></span>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground/40" />
      <div className="flex items-center gap-2 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2">
        <FileDown className="w-4 h-4 text-indigo-600" />
        <span className="text-sm font-medium text-indigo-700"><Trans>Export</Trans></span>
      </div>
    </div>
  )
}

function StageGrid({ stages }: { stages: StageItem[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {stages.map((s) => (
        <div key={s.label} className={`flex items-center gap-2 rounded-lg ${s.bgLight} px-3 py-2.5`}>
          <s.icon className={`w-4 h-4 ${s.color}`} />
          <span className="text-xs font-medium text-foreground">{s.label}</span>
        </div>
      ))}
    </div>
  )
}

export function PipelineOnboarding({
  bookLabel,
  open: controlledOpen,
  onOpenChange,
}: {
  bookLabel: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { t } = useLingui()
  const [uncontrolledOpen, setUncontrolledOpen] = useState(() => !hasSeen(bookLabel))
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState<"forward" | "back">("forward")
  const [dontShowAgain, setDontShowAgain] = useState(false)

  // Auto-open on first visit for this book (controlled mode)
  const didAutoOpen = useRef(false)
  useEffect(() => {
    if (isControlled && !didAutoOpen.current && !hasSeen(bookLabel) && !controlledOpen) {
      didAutoOpen.current = true
      onOpenChange?.(true)
    }
  }, [isControlled, bookLabel, controlledOpen, onOpenChange])

  const slides: Slide[] = [
    {
      title: t`Welcome to your book pipeline`,
      description: t`ADT Studio transforms your PDF into an accessible digital textbook through a series of stages. Here's a quick overview of how it works.`,
    },
    {
      title: t`The core path`,
      description: t`Start by extracting content from your PDF, then build the storyboard to create the visual layout. These two stages are required — everything else is optional.`,
      highlight: "core",
    },
    {
      title: t`Enhance your book`,
      description: t`Add optional features to enrich the reading experience. You can run these in any order, or skip them entirely.`,
      stages: [
        { icon: HelpCircle, label: t`Quizzes`, color: "text-orange-600", bgLight: "bg-orange-50" },
        { icon: Image, label: t`Captions`, color: "text-teal-600", bgLight: "bg-teal-50" },
        { icon: BookOpen, label: t`Glossary`, color: "text-lime-600", bgLight: "bg-lime-50" },
        { icon: List, label: t`Table of Contents`, color: "text-amber-600", bgLight: "bg-amber-50" },
        { icon: Languages, label: t`Translate`, color: "text-pink-600", bgLight: "bg-pink-50" },
        { icon: AudioLines, label: t`Speech`, color: "text-rose-600", bgLight: "bg-rose-50" },
        { icon: Hand, label: t`Sign Language`, color: "text-cyan-600", bgLight: "bg-cyan-50" },
      ],
      highlight: "enhance",
    },
    {
      title: t`Preview and export`,
      description: t`When you're ready, preview the final result, run validation checks, and export the finished digital textbook.`,
      stages: [
        { icon: ShieldCheck, label: t`Validation`, color: "text-emerald-600", bgLight: "bg-emerald-50" },
        { icon: Eye, label: t`Preview`, color: "text-gray-600", bgLight: "bg-gray-100" },
        { icon: FileDown, label: t`Export`, color: "text-indigo-600", bgLight: "bg-indigo-50" },
      ],
      highlight: "output",
    },
  ]

  const isLast = step === slides.length - 1
  const slide = slides[step]

  const handleClose = useCallback(() => {
    if (dontShowAgain) markSeen(bookLabel)
    if (isControlled) {
      onOpenChange?.(false)
    } else {
      setUncontrolledOpen(false)
      markSeen(bookLabel)
    }
    setStep(0)
  }, [bookLabel, dontShowAgain, isControlled, onOpenChange])

  const handleNext = useCallback(() => {
    if (isLast) {
      handleClose()
    } else {
      setDirection("forward")
      setStep((s) => s + 1)
    }
  }, [isLast, handleClose])

  const handleBack = useCallback(() => {
    setDirection("back")
    setStep((s) => Math.max(0, s - 1))
  }, [])

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden [&>button]:hidden">
        <DialogTitle className="sr-only">{t`Pipeline overview`}</DialogTitle>
        <DialogDescription className="sr-only">{t`Learn about the book pipeline stages`}</DialogDescription>

        {/* Header */}
        <div className="flex flex-col gap-3 px-8 pt-7 pb-1">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleClose}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <Trans>Skip</Trans>
            </button>
            <span
              className="text-[13px] font-bold leading-5 uppercase tracking-wide"
              style={{ color: "#7c3aed" }}
            >
              {step + 1} / {slides.length}
            </span>
          </div>

          {/* Step dots */}
          <div className="flex gap-1.5 justify-center">
            {slides.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === step ? "w-6 bg-violet-500" : "w-1.5 bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-8 pt-4 pb-6 min-h-[280px]">
          <div
            key={step}
            className={direction === "forward" ? "animate-step-enter-forward" : "animate-step-enter-back"}
          >
            <div className="flex flex-col gap-1 mb-5">
              <h2 className="text-[24px] font-semibold leading-8 tracking-[-0.5px] text-black">
                {slide.title}
              </h2>
              <p className="text-[14px] font-medium text-[#737373] leading-relaxed">
                {slide.description}
              </p>
            </div>

            {/* Slide-specific content */}
            {step === 0 && (
              <div className="flex items-center justify-center py-6">
                <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center">
                  <Rocket className="w-8 h-8 text-violet-500" />
                </div>
              </div>
            )}

            {step === 1 && <CorePathDiagram />}

            {slide.stages && <StageGrid stages={slide.stages} />}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#e5e5e5] px-6 py-4 space-y-3">
          <div className="grid grid-cols-2 w-full gap-2">
            <Button
              variant="outline"
              onClick={step === 0 ? handleClose : handleBack}
              className="cursor-pointer"
            >
              {step === 0 ? (
                <><Trans>Skip tour</Trans></>
              ) : (
                <><ArrowLeft className="w-4 h-4 mr-1" /> <Trans>Back</Trans></>
              )}
            </Button>
            <Button
              onClick={handleNext}
              className="cursor-pointer"
              style={{ backgroundColor: "#7c3aed" }}
            >
              {isLast ? (
                <><Rocket className="w-4 h-4 mr-1" /> <Trans>Get started</Trans></>
              ) : (
                <><Trans>Next</Trans> <ArrowRight className="w-4 h-4 ml-1" /></>
              )}
            </Button>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
            />
            <span className="text-xs text-muted-foreground"><Trans>Don't show this again</Trans></span>
          </label>
        </div>
      </DialogContent>
    </Dialog>
  )
}
