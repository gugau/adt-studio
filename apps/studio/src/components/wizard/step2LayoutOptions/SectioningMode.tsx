/* eslint-disable lingui/no-unlocalized-strings */
import { useStore } from "@tanstack/react-form"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useWizardForm } from "@/components/wizard/wizardForm"
import type { SectioningModeId } from "@/components/wizard/constants"
import { InfoCarousel, type CarouselSlide } from "@/components/wizard/InfoCarousel"

const SECTIONING_OPTIONS: { value: SectioningModeId; label: string }[] = [
  { value: "page", label: "Page" },
  { value: "dynamic", label: "Dynamic" },
  { value: "section", label: "Section" },
]

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
        <div className="mt-auto text-center text-[6px] font-medium text-primary">
          1 section
        </div>
      </div>
    </div>
  )
}

function DynamicDiagram() {
  return (
    <div className="flex items-center justify-center gap-3 py-2">
      <div className="flex h-[72px] w-[52px] flex-col rounded border border-primary/30 bg-primary/5 p-1.5">
        <div className="flex flex-1 flex-col gap-1">
          <div className="h-1 w-full rounded-full bg-primary/30" />
          <div className="h-1 w-2/3 rounded-full bg-primary/30" />
          <div className="my-0.5 h-px w-full border-t border-dashed border-primary/20" />
          <div className="h-1 w-full rounded-full bg-amber-400/50" />
          <div className="my-0.5 h-px w-full border-t border-dashed border-primary/20" />
          <div className="h-1 w-3/4 rounded-full bg-emerald-400/50" />
        </div>
      </div>
      <div className="text-[8px] text-muted-foreground">=</div>
      <div className="flex flex-col gap-1">
        <div className="flex h-[20px] w-[52px] items-center rounded border-2 border-primary/40 bg-primary/5 px-1.5">
          <div className="h-1 w-full rounded-full bg-primary/40" />
        </div>
        <div className="flex h-[20px] w-[52px] items-center rounded border-2 border-amber-400/40 bg-amber-50 px-1.5">
          <div className="h-1 w-full rounded-full bg-amber-400/50" />
        </div>
        <div className="flex h-[20px] w-[52px] items-center rounded border-2 border-emerald-400/40 bg-emerald-50 px-1.5">
          <div className="h-1 w-3/4 rounded-full bg-emerald-400/50" />
        </div>
      </div>
    </div>
  )
}

function SectionDiagram() {
  return (
    <div className="flex items-center justify-center gap-3 py-2">
      <div className="flex h-[72px] w-[52px] flex-col rounded border border-primary/30 bg-primary/5 p-1.5">
        <div className="flex flex-1 flex-col gap-1">
          <div className="h-1 w-full rounded-full bg-primary/30" />
          <div className="h-1 w-2/3 rounded-full bg-primary/30" />
          <div className="h-4 w-full rounded bg-primary/15" />
          <div className="h-1 w-full rounded-full bg-amber-400/50" />
          <div className="h-1 w-1/2 rounded-full bg-amber-400/50" />
        </div>
      </div>
      <div className="text-[8px] text-muted-foreground">=</div>
      <div className="flex flex-col gap-1">
        <div className="flex h-[20px] w-[52px] items-center rounded border-2 border-primary/40 bg-primary/5 px-1.5">
          <div className="flex gap-0.5">
            <div className="h-1 w-3 rounded-full bg-primary/40" />
            <div className="h-1 w-2 rounded-full bg-primary/40" />
          </div>
        </div>
        <div className="flex h-[20px] w-[52px] items-center justify-center rounded border-2 border-primary/40 bg-primary/5 px-1.5">
          <div className="h-3 w-full rounded bg-primary/20" />
        </div>
        <div className="flex h-[20px] w-[52px] items-center rounded border-2 border-amber-400/40 bg-amber-50 px-1.5">
          <div className="flex gap-0.5">
            <div className="h-1 w-4 rounded-full bg-amber-400/50" />
            <div className="h-1 w-2 rounded-full bg-amber-400/50" />
          </div>
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
      <Select
        value={sectioningMode === "" ? undefined : sectioningMode}
        onValueChange={(v) =>
          form.setFieldValue("sectioningMode", v as SectioningModeId)
        }
      >
        <SelectTrigger id="wizard-sectioning-mode" className="w-full">
          <SelectValue placeholder="Select section mode" />
        </SelectTrigger>
        <SelectContent>
          {SECTIONING_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
