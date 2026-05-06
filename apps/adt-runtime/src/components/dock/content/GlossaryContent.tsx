import { GlossaryPanel } from "@/components/glossary/GlossaryPanel"

/**
 * Wraps the existing `GlossaryPanel` so it sits inside a NavigationMenu
 * Content slot with a constrained box.
 */
export function GlossaryContent() {
  return (
    <div className="flex flex-col w-[var(--dock-width,32rem)] max-w-[calc(100vw-2rem)] h-[28rem]">
      <GlossaryPanel />
    </div>
  )
}
