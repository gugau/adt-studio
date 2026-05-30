import { useAtomValue } from "jotai"
import { useEffect, useMemo, useState } from "react"
import { appConfigAtom } from "@/shared/state/config.atoms"

interface AvailableLanguagesResult {
  /** Filtered list of language codes that have actual content translations. */
  languages: string[]
  /** Display name per language (from `interface_translations.json` → `language-name`). */
  names: Record<string, string>
}

/**
 * Probes each language declared in `config.languages.available` and returns
 * only the ones whose `content/i18n/<lang>/texts.json` actually has entries.
 *
 * The export wizard lets the user pick output languages before any content
 * translation has been generated, so `available` may contain languages
 * whose texts.json is `{}`. Showing those in the picker is misleading: the
 * UI marks the language as selected but the book content stays in the
 * previous language. Filter them out here so users only see options that
 * will actually update the page.
 *
 * Names are resolved separately from `interface_translations.json` since
 * those tend to be populated even when content translations are missing
 * (chrome strings ship for all locales).
 */
export function useAvailableLanguages(): AvailableLanguagesResult {
  const config = useAtomValue(appConfigAtom)
  const declared = useMemo(
    () => config.languages.available ?? [],
    [config.languages.available],
  )

  const [languages, setLanguages] = useState<string[]>([])
  const [names, setNames] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false

    Promise.all(
      declared.map(async (lang) => {
        const [name, hasTexts] = await Promise.all([
          fetchLanguageName(lang),
          hasContentTranslations(lang),
        ])
        return { lang, name, hasTexts }
      }),
    ).then((results) => {
      if (cancelled) return
      const next: string[] = []
      const nextNames: Record<string, string> = {}
      for (const r of results) {
        nextNames[r.lang] = r.name
        if (r.hasTexts) next.push(r.lang)
      }
      setLanguages(next)
      setNames(nextNames)
    })

    return () => {
      cancelled = true
    }
  }, [declared])

  return { languages, names }
}

async function fetchLanguageName(lang: string): Promise<string> {
  try {
    const res = await fetch(
      `./assets/interface_translations/${lang}/interface_translations.json`,
    )
    if (!res.ok) return lang
    const data = (await res.json()) as Record<string, string>
    return data["language-name"] ?? lang
  } catch {
    return lang
  }
}

async function hasContentTranslations(lang: string): Promise<boolean> {
  try {
    const res = await fetch(`./content/i18n/${lang}/texts.json`)
    if (!res.ok) return false
    const data = (await res.json()) as Record<string, string>
    return Object.keys(data).length > 0
  } catch {
    return false
  }
}
