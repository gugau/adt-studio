
import { useStore } from "@tanstack/react-form"
import { Label } from "@/components/ui/label"
import { useWizardForm } from "@/components/wizard/wizardForm"
import { InfoCarousel, type CarouselSlide } from "@/components/wizard/shared/InfoCarousel"
import { SectioningModeSelect } from "./SectioningModeSelect"

function PageDiagram() {
  return (
    <div className="flex items-center justify-center gap-3 py-2">
      <div className="flex h-[72px] w-[52px] flex-col rounded border border-primary/30 bg-primary/5 p-1.5">
        <div className="flex flex-1 flex-col gap-1">
          <div className="h-1 w-full rounded-full bg-primary/30" />
          <div className="h-1 w-3/4 rounded-full bg-primary/30" />
          <div className="mt-1 h-4 w-full rounded bg-primary/15" />
          <div className="h-1 w-full rounded-full bg-primary/30" />
          <div className="h-1 w-2/3 rounded-full bg-primary/30" />
        </div>
      </div>
      <div className="text-[8px] text-muted-foreground">=</div>
      <div className="flex h-[72px] w-[52px] flex-col rounded border-2 border-primary/40 bg-primary/5 p-1.5">
        <div className="flex flex-1 flex-col gap-1">
          <div className="h-1 w-full rounded-full bg-primary/40" />
          <div className="h-1 w-3/4 rounded-full bg-primary/40" />
          <div className="mt-1 h-4 w-full rounded bg-primary/20" />
          <div className="h-1 w-full rounded-full bg-primary/40" />
          <div className="h-1 w-2/3 rounded-full bg-primary/40" />
        </div>
      </div>
    </div>
  )
}

function DynamicDiagram() {
  return (
    <div className="flex items-center justify-center gap-4 py-2">
      <div className="flex h-[72px] w-[52px] flex-col rounded border border-primary/30 bg-primary/5 p-1.5">
        <div className="flex flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 shrink-0 rounded-full border border-primary/40" />
            <div className="h-0.5 w-full rounded-full bg-primary/30" />
          </div>
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 shrink-0 rounded-full border border-primary/40 bg-primary/30" />
            <div className="h-0.5 w-3/4 rounded-full bg-primary/30" />
          </div>
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 shrink-0 rounded-full border border-primary/40" />
            <div className="h-0.5 w-2/3 rounded-full bg-primary/30" />
          </div>
          <div className="mt-0.5 h-px w-full border-t border-dashed border-amber-400/30" />
          <div className="mt-0.5 h-0.5 w-full rounded-full bg-amber-400/40" />
          <div className="mt-1 h-px w-full border-b border-amber-400/30" />
          <div className="mt-1 h-px w-full border-b border-amber-400/30" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <svg className="h-3 w-3 text-muted-foreground" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex h-[30px] w-[52px] flex-col justify-center gap-0.5 rounded border-2 border-primary/40 bg-primary/5 px-1.5">
          <div className="flex items-center gap-0.5">
            <div className="h-1 w-1 shrink-0 rounded-full border border-primary/40" />
            <div className="h-0.5 w-full rounded-full bg-primary/40" />
          </div>
          <div className="flex items-center gap-0.5">
            <div className="h-1 w-1 shrink-0 rounded-full border border-primary/40 bg-primary/30" />
            <div className="h-0.5 w-3/4 rounded-full bg-primary/40" />
          </div>
        </div>
        <div className="flex h-[30px] w-[52px] flex-col justify-center gap-0.5 rounded border-2 border-amber-400/40 bg-amber-50 px-1.5">
          <div className="h-0.5 w-full rounded-full bg-amber-400/50" />
          <div className="mt-0.5 h-px w-full border-b border-amber-400/30" />
          <div className="mt-0.5 h-px w-full border-b border-amber-400/30" />
        </div>
      </div>
    </div>
  )
}

function SectionDiagram() {
  return (
    <div className="flex items-center justify-center gap-4 py-2">
      <div className="flex h-[72px] w-[52px] flex-col rounded border border-primary/30 bg-primary/5 p-1.5">
        <div className="flex flex-1 flex-col gap-0.5">
          <div className="h-1 w-2/3 rounded-full bg-primary/50" />
          <div className="h-0.5 w-full rounded-full bg-primary/20" />
          <div className="h-0.5 w-3/4 rounded-full bg-primary/20" />
          <div className="my-0.5 h-3 w-full rounded bg-emerald-400/20 ring-1 ring-inset ring-emerald-400/30" />
          <div className="h-1 w-1/2 rounded-full bg-amber-500/50" />
          <div className="h-0.5 w-full rounded-full bg-amber-400/20" />
          <div className="h-0.5 w-2/3 rounded-full bg-amber-400/20" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <svg className="h-3 w-3 text-muted-foreground" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex h-[14px] w-[52px] items-center rounded border-2 border-primary/40 bg-primary/5 px-1">
          <div className="h-0.5 w-3/4 rounded-full bg-primary/40" />
        </div>
        <div className="flex h-[14px] w-[52px] items-center justify-center rounded border-2 border-emerald-400/40 bg-emerald-50 px-1">
          <div className="h-2 w-full rounded bg-emerald-400/25" />
        </div>
        <div className="flex h-[14px] w-[52px] items-center rounded border-2 border-amber-400/40 bg-amber-50 px-1">
          <div className="h-0.5 w-2/3 rounded-full bg-amber-400/50" />
        </div>
      </div>
    </div>
  )
}

const SLIDES: CarouselSlide[] = [
  {
    title: "Page Mode",
    description:
      "The entire page is treated as a single section — all text and images stay together as one unit. Best for storybooks, reference books, and any content where each page is self-contained.",
    Diagram: PageDiagram,
  },
  {
    title: "Dynamic Mode",
    description:
      "Keeps the page as one section by default, but intelligently splits when it detects multiple distinct activities — such as a mix of multiple-choice, open-ended, and sorting exercises on the same page. Best for textbooks with varied exercises.",
    Diagram: DynamicDiagram,
  },
  {
    title: "Section Mode",
    description:
      "Groups content into multiple logical sections based on topic and structure. The AI identifies natural boundaries — headings, topic shifts, figures — and organizes content accordingly. Most granular option, ideal for dense or mixed-content pages.",
    Diagram: SectionDiagram,
  },
]

export function SectioningMode() {
  const form = useWizardForm()
  const sectioningMode = useStore(form.store, (s) => s.values.sectioningMode)

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-1">
        <Label htmlFor="wizard-sectioning-mode" className="text-sm font-medium text-foreground">
          Section Mode
        </Label>
        <span className="text-sm font-medium text-destructive" aria-hidden>
          *
        </span>
        <InfoCarousel label="About section mode" slides={SLIDES} />
      </div>
      <SectioningModeSelect
        id="wizard-sectioning-mode"
        value={sectioningMode}
        onValueChange={(v) => form.setFieldValue("sectioningMode", v)}
      />
    </div>
  )
}
