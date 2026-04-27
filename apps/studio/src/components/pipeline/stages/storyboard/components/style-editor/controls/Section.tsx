import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface SectionProps {
  /** Identifier used by the parent <Accordion> to track open state */
  value: string
  title: ReactNode
  icon?: LucideIcon
  children: ReactNode
}

export function Section({ value, title, icon: Icon, children }: SectionProps) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger>
        {Icon ? (
          <Icon className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
        ) : null}
        <span className="flex-1 text-left">{title}</span>
      </AccordionTrigger>
      <AccordionContent className="space-y-2.5">{children}</AccordionContent>
    </AccordionItem>
  )
}
