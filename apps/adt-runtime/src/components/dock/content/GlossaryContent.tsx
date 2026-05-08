import { GlossaryPanel } from "@/components/glossary/GlossaryPanel"

/**
 * Slot for the glossary popover. `GlossaryPanel` already wraps itself in
 * `DockContent`, which sets the dock-aligned width and a fixed height —
 * adding another sized wrapper here just fights with that and clips the
 * tab list at the bottom.
 */
export function GlossaryContent() {
  return <GlossaryPanel />
}
