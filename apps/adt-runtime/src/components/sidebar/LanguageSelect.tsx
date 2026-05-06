import { useAtom, useAtomValue } from "jotai"
import { useEffect, useMemo, useState } from "react"
import { appConfigAtom } from "@/state/config.atoms"
import { currentLanguageAtom } from "@/state/language.atoms"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTranslation } from "@/hooks/useTranslation"

/**
 * Replacement for `#language-dropdown`. Reads `config.languages.available`
 * from `appConfigAtom` and writes the user's selection back to
 * `currentLanguageAtom` (which is persisted via the legacy cookie/localStorage
 * adapter). The boot lifecycle observes the atom and re-loads translations
 * when it changes, so we don't need to fire a custom event from here.
 *
 * Each language's display name is read from its own
 * `interface_translations.json` `language-name` key — fetched lazily here
 * so we don't block the sidebar render on 69 catalogs.
 */
export function LanguageSelect() {
  const config = useAtomValue(appConfigAtom)
  const [currentLanguage, setCurrentLanguage] = useAtom(currentLanguageAtom)
  const { t } = useTranslation()
  const [names, setNames] = useState<Record<string, string>>({})

  const available = useMemo(
    () => config.languages.available ?? [],
    [config.languages.available],
  )

  useEffect(() => {
    let cancelled = false
    Promise.all(
      available.map(async (lang) => {
        try {
          const res = await fetch(
            `./assets/interface_translations/${lang}/interface_translations.json`,
          )
          if (!res.ok) return [lang, lang] as const
          const data = (await res.json()) as Record<string, string>
          return [lang, data["language-name"] ?? lang] as const
        } catch {
          return [lang, lang] as const
        }
      }),
    ).then((entries) => {
      if (!cancelled) setNames(Object.fromEntries(entries))
    })
    return () => {
      cancelled = true
    }
  }, [available])

  if (available.length === 0) return null

  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-base font-medium">{t("language-label") || "Language"}</span>
      <div className="min-w-[10rem]">
        <Select value={currentLanguage} onValueChange={setCurrentLanguage}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {available.map((lang) => (
              <SelectItem key={lang} value={lang}>
                {names[lang] ?? lang}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
