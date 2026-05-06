import { useGlossaryHighlighter } from "@/hooks/useGlossaryHighlighter"

/**
 * Side-effect-only mount point. Hosts the glossary highlight hook so the
 * `#content` DOM gets glossary spans applied/removed as the toggle flips.
 * Renders nothing visible.
 */
export function GlossaryHighlighter() {
  useGlossaryHighlighter()
  return null
}
