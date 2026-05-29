import { useEffect, useMemo, useState } from "react"
import { i18n } from "@lingui/core"

type AxeRuleMessages = { help?: string; description?: string }
type AxeRuleMap = Record<string, AxeRuleMessages>

// axe-core ships per-locale rule text keyed by rule id. Findings are stored in
// English (the canonical assessment), so we translate the rule-level help and
// description at render time based on the active UI locale. Loaders are lazy so
// only the active locale's catalog is fetched, and never for the source locale.
const AXE_LOCALE_LOADERS: Record<string, () => Promise<{ default: { rules?: AxeRuleMap } }>> = {
  es: () => import("axe-core/locales/es.json"),
  fr: () => import("axe-core/locales/fr.json"),
  "pt-BR": () => import("axe-core/locales/pt_BR.json"),
}

export interface AxeRuleTranslator {
  help: (ruleId: string, fallback: string) => string
  description: (ruleId: string, fallback: string) => string
}

export function useAxeRuleTranslator(): AxeRuleTranslator {
  const [locale, setLocale] = useState(() => i18n.locale)
  const [rules, setRules] = useState<AxeRuleMap | null>(null)

  // Track the active locale via the shared lingui instance rather than the
  // React context, so this works in any tree (and in tests) without a provider.
  useEffect(() => i18n.on("change", () => setLocale(i18n.locale)), [])

  useEffect(() => {
    const loader = AXE_LOCALE_LOADERS[locale]
    if (!loader) {
      setRules(null)
      return
    }

    let cancelled = false
    void loader()
      .then((mod) => {
        if (!cancelled) setRules(mod.default.rules ?? {})
      })
      .catch(() => {
        if (!cancelled) setRules(null)
      })

    return () => {
      cancelled = true
    }
  }, [locale])

  return useMemo(
    () => ({
      help: (ruleId, fallback) => rules?.[ruleId]?.help ?? fallback,
      description: (ruleId, fallback) => rules?.[ruleId]?.description ?? fallback,
    }),
    [rules],
  )
}
