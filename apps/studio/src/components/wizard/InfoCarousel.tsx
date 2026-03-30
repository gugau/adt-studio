/* eslint-disable lingui/no-unlocalized-strings */
import { useState, type ElementType } from "react"
import { ChevronLeft, ChevronRight, CircleHelp } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface CarouselSlide {
  title: string
  description: string
  Diagram: ElementType
}

function Carousel({ slides }: { slides: readonly CarouselSlide[] }) {
  const [index, setIndex] = useState(0)

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide) => (
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
          {slides.map((_, i) => (
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
          disabled={index === slides.length - 1}
          onClick={() => setIndex((i) => Math.min(slides.length - 1, i + 1))}
          aria-label="Next slide"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

export function InfoCarousel({
  label,
  slides,
  align = "center",
  side = "right",
}: {
  label: string
  slides: readonly CarouselSlide[]
  align?: "start" | "center" | "end"
  side?: "top" | "bottom" | "left" | "right"
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-foreground"
          aria-label={label}
        >
          <CircleHelp className="size-[14px]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side={side} align={align} className="w-80 p-4">
        <Carousel slides={slides} />
      </PopoverContent>
    </Popover>
  )
}
