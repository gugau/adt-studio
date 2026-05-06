import { useAtom, useAtomValue } from "jotai"
import { Search } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { appConfigAtom } from "@/state/config.atoms"
import { currentLanguageAtom } from "@/state/language.atoms"
import { useTranslation } from "@/hooks/useTranslation"
import { cn } from "@/lib/utils"

interface LanguageContentProps {
  /** Called after the user picks a language so the parent can close the menu. */
  onSelect?: () => void
}

export function LanguageContent({ onSelect }: LanguageContentProps) {
  const config = useAtomValue(appConfigAtom)
  const [currentLanguage, setCurrentLanguage] = useAtom(currentLanguageAtom)
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
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

  const filtered = useMemo(() => {
    if (!query.trim()) return available
    const q = query.trim().toLowerCase()
    return available.filter((lang) => {
      const name = names[lang] ?? lang
      return name.toLowerCase().includes(q) || lang.toLowerCase().includes(q)
    })
  }, [available, names, query])

  if (available.length === 0) return null

  return (
    <div className="w-[var(--dock-width,32rem)] max-w-[calc(100vw-2rem)] p-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("language-label") || "Language"}
          aria-label={t("language-label") || "Language"}
          className="w-full h-9 pl-8 pr-2 text-sm rounded-lg bg-muted/50 border border-input outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <ul className="mt-2 max-h-64 overflow-y-auto [scrollbar-gutter:stable]">
        {filtered.map((lang) => {
          const active = lang === currentLanguage
          return (
            <li key={lang}>
              <button
                type="button"
                onClick={() => {
                  setCurrentLanguage(lang)
                  onSelect?.()
                }}
                className={cn(
                  "w-full text-left px-2.5 py-2 rounded-lg text-sm",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus:outline-none focus:bg-accent focus:text-accent-foreground",
                  active && "bg-accent text-accent-foreground font-medium",
                )}
                aria-current={active ? "true" : undefined}
              >
                {names[lang] ?? lang}
              </button>
            </li>
          )
        })}
        {filtered.length === 0 ? (
          <li className="px-2.5 py-2 text-sm text-muted-foreground">
            {t("language-search-empty") || "No matches"}
          </li>
        ) : null}
      </ul>
    </div>
  )
}
