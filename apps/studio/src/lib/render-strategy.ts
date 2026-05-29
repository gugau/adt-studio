type RenderStrategyLike = {
  render_type?: string | null
} | undefined

type RenderStrategyMap = Record<string, RenderStrategyLike>

export function listSelectableRenderStrategies(
  strategies: RenderStrategyMap
): string[] {
  return Object.keys(strategies).filter((name) => {
    const type = strategies[name]?.render_type
    // `activity` strategies are auto-assigned to matching section types.
    // `fixed_layout` is a book-wide rendering mode, not a per-section override.
    return type !== "activity" && type !== "fixed_layout"
  })
}

/**
 * Strategies that may be picked as the book-wide default. Same as
 * {@link listSelectableRenderStrategies} but also includes `fixed_layout`,
 * which is a valid whole-book rendering mode even though it cannot be assigned
 * to an individual section.
 */
export function listDefaultRenderStrategies(
  strategies: RenderStrategyMap
): string[] {
  return Object.keys(strategies).filter(
    (name) => strategies[name]?.render_type !== "activity"
  )
}

export function chooseDefaultRenderStrategyFallback(
  strategies: RenderStrategyMap
): string {
  // Prefer a reflowable strategy for the auto-fallback — `fixed_layout`
  // should only ever become the default when explicitly requested.
  const selectable = listSelectableRenderStrategies(strategies)
  if (selectable.includes("two_column")) return "two_column"
  return selectable[0] ?? ""
}

export function normalizeDefaultRenderStrategy(
  requested: string | null | undefined,
  strategies: RenderStrategyMap
): string {
  const trimmed = (requested ?? "").trim()
  const candidates = listDefaultRenderStrategies(strategies)

  if (candidates.length === 0) return ""
  if (!trimmed || trimmed === "dynamic") {
    return chooseDefaultRenderStrategyFallback(strategies)
  }
  if (candidates.includes(trimmed)) return trimmed

  return chooseDefaultRenderStrategyFallback(strategies)
}
