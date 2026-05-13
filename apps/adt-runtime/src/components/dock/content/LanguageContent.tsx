import { useAtom } from "jotai"
import { useMemo, useState } from "react"
import { currentLanguageAtom } from "@/state/language.atoms"
import { useAvailableLanguages } from "@/hooks/useAvailableLanguages"
import { useTranslation } from "@/hooks/useTranslation"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DockContent } from "./DockLayout"

interface LanguageContentProps {
  onSelect?: () => void
}

export function LanguageContent({ onSelect }: LanguageContentProps) {
  const [currentLanguage, setCurrentLanguage] = useAtom(currentLanguageAtom)
  const { languages, names } = useAvailableLanguages()
  const { t } = useTranslation()
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    if (!query.trim()) return languages
    const q = query.trim().toLowerCase()
    return languages.filter((lang) => {
      const name = names[lang] ?? lang
      return name.toLowerCase().includes(q) || lang.toLowerCase().includes(q)
    })
  }, [languages, names, query])

  if (languages.length === 0) return null

  return (
    <DockContent className="h-auto">
      <DockContent.Search
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ScrollArea className="flex-1 min-h-0">
        <ul>
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
      </ScrollArea>
    </DockContent>
  )
}
