/**
 * useTranslation — hook wrapping the legacy `translateText(key, vars)` helper.
 * Returns a memoized translator that recomputes only when the translations
 * atom changes, so consumers can call `t("key")` freely in render.
 */
import { useAtomValue } from "jotai"
import { useCallback } from "react"
import { translationsAtom } from "@/features/language/state/language.atoms"

export function useTranslation() {
  const dict = useAtomValue(translationsAtom)
  const t = useCallback(
    (key: string, variables: Record<string, string> = {}) => {
      const template = dict[key]
      if (!template) return key
      return template.replace(/\$\{(.*?)\}/g, (_, name) => variables[name] ?? "")
    },
    [dict],
  )
  return { t, translations: dict }
}
