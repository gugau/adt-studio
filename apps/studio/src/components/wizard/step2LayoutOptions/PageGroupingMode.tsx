/* eslint-disable lingui/no-unlocalized-strings */
import { useState } from "react"
import { CircleHelp, ChevronLeft, ChevronRight } from "lucide-react"
import { useStore } from "@tanstack/react-form"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { useWizardForm } from "@/components/wizard/wizardForm"
import { cn } from "@/lib/utils"

const GROUPING_OPTIONS = [
  { value: "spread", label: "Spread" },
  { value: "single", label: "Single" },
] as const

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

const SLIDES = [
  {
    title: "Spread Mode",
    description:
      "Many printed books are designed with facing pages in mind — illustrations that span two pages, or text that flows across a spread. Spread mode merges each pair of facing pages so content isn't split apart. The cover stays standalone, then pages are paired: 2+3, 4+5, etc.",
    Diagram: SpreadDiagram,
  },
  {
    title: "Single Mode",
    description:
      "When your PDF isn’t built around facing pages, single mode keeps every page separate: nothing is merged across a spread. That matches how most textbooks, novels, and reference books are read — one page at a time.",
    Diagram: SingleDiagram,
  },
] as const

function GroupingCarousel() {
  const [index, setIndex] = useState(0)

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {SLIDES.map((slide) => (
            <div key={slide.title} className="w-full shrink-0">
              <Card className="flex h-[270px] flex-col gap-3 border-0 bg-transparent p-0 shadow-none">
                <CardHeader className="space-y-1.5 p-0">
                  <CardTitle className="text-sm font-semibold leading-tight">
                    {slide.title}
                  </CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    {slide.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto p-0">
                  <Card className="border-border bg-muted/40 p-3 shadow-none">
                    <slide.Diagram />
                  </Card>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          aria-label="Previous slide"
        >
          <ChevronLeft className="size-4" />
        </Button>

        <div className="flex gap-1.5">
          {SLIDES.map((_, i) => (
            <Button
              key={i}
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIndex(i)}
              className={cn(
                "size-2 min-h-2 min-w-2 shrink-0 rounded-full p-0 hover:bg-transparent",
                i === index ? "bg-primary" : "bg-muted-foreground/40 hover:bg-muted-foreground/60",
              )}
              aria-label={`Slide ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
            />
          ))}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
          disabled={index === SLIDES.length - 1}
          onClick={() => setIndex((i) => Math.min(SLIDES.length - 1, i + 1))}
          aria-label="Next slide"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

export function PageGroupingMode() {
  const form = useWizardForm()
  const spreadMode = useStore(form.store, (s) => s.values.spreadMode)

  return (
    <div className="flex w-full max-w-[33.8rem] flex-col gap-3">
      <div className="flex items-center gap-1">
        <Label className="text-sm font-medium text-foreground">
          Page Grouping Mode
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              aria-label="About page grouping"
            >
              <CircleHelp className="size-[14px]" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="right" align="start" className="w-80 p-4">
            <GroupingCarousel />
          </PopoverContent>
        </Popover>
      </div>
      <SegmentedControl
        options={GROUPING_OPTIONS as unknown as { value: string; label: string }[]}
        value={spreadMode ? "spread" : "single"}
        onValueChange={(v) => form.setFieldValue("spreadMode", v === "spread")}
      />
    </div>
  )
}
