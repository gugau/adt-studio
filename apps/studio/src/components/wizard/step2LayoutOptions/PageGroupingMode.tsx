/* eslint-disable lingui/no-unlocalized-strings */
import { useStore } from "@tanstack/react-form"
import { Label } from "@/components/ui/label"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { useWizardForm } from "@/components/wizard/wizardForm"
import { InfoCarousel, type CarouselSlide } from "@/components/wizard/shared/InfoCarousel"

const GROUPING_OPTIONS: { value: "spread" | "single"; label: string }[] = [
  { value: "spread", label: "Spread" },
  { value: "single", label: "Single" },
]

function SpreadDiagram() {
  return (
    <div className="flex items-end justify-center gap-2 py-2">
      <div className="flex h-[72px] w-10 items-center justify-center rounded border border-border bg-background text-[8px] text-muted-foreground">
        Cover
      </div>
      <div className="flex h-[72px] w-[72px] rounded border border-primary/30 bg-primary/5">
        <div className="flex h-full w-full">
          <div className="flex flex-1 items-center justify-center border-r border-dashed border-primary/20 text-[8px] text-primary">
            P2
          </div>
          <div className="flex flex-1 items-center justify-center text-[8px] text-primary">
            P3
          </div>
        </div>
      </div>
      <div className="flex h-[72px] w-[72px] rounded border border-primary/30 bg-primary/5">
        <div className="flex h-full w-full">
          <div className="flex flex-1 items-center justify-center border-r border-dashed border-primary/20 text-[8px] text-primary">
            P4
          </div>
          <div className="flex flex-1 items-center justify-center text-[8px] text-primary">
            P5
          </div>
        </div>
      </div>
    </div>
  )
}

function SingleDiagram() {
  return (
    <div className="flex items-end justify-center gap-2 py-2">
      {["P1", "P2", "P3", "P4", "P5"].map((label) => (
        <div
          key={label}
          className="flex h-[72px] w-10 items-center justify-center rounded border border-border bg-background text-[8px] text-muted-foreground"
        >
          {label}
        </div>
      ))}
    </div>
  )
}

const SLIDES: CarouselSlide[] = [
  {
    title: "Spread Mode",
    description:
      "Many printed books are designed with facing pages in mind — illustrations that span two pages, or text that flows across a spread. Spread mode merges each pair of facing pages so content isn't split apart. The cover stays standalone, then pages are paired: 2+3, 4+5, etc.",
    Diagram: SpreadDiagram,
  },
  {
    title: "Single Mode",
    description:
      "When your PDF isn't built around facing pages, single mode keeps every page separate: nothing is merged across a spread. That matches how most textbooks, novels, and reference books are read — one page at a time.",
    Diagram: SingleDiagram,
  },
]

export function PageGroupingMode() {
  const form = useWizardForm()
  const pageGrouping = useStore(form.store, (s) => s.values.pageGrouping)

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-1">
        <Label className="text-sm font-medium text-foreground">
          Page Grouping Mode
        </Label>
        <span className="text-sm font-medium text-destructive" aria-hidden>
          *
        </span>
        <InfoCarousel label="About page grouping" slides={SLIDES} />
      </div>
      <SegmentedControl
        options={GROUPING_OPTIONS}
        value={pageGrouping}
        onValueChange={(v) => form.setFieldValue("pageGrouping", v)}
      />
    </div>
  )
}
