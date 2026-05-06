import { useAtom } from "jotai"
import { currentLanguageAtom } from "@/state/language.atoms"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAvailableLanguages } from "@/hooks/useAvailableLanguages"
import { useTranslation } from "@/hooks/useTranslation"

/**
 * Replacement for `#language-dropdown`. Lists only languages with actual
 * content translations (filtered via `useAvailableLanguages` — the export
 * wizard may declare languages that haven't been generated yet, and showing
 * those would mislead the user since picking them is a no-op for content).
 * Selecting a language writes to `currentLanguageAtom`; the boot lifecycle
 * subscriber re-loads translations and re-applies them to the DOM.
 */
export function LanguageSelect() {
  const [currentLanguage, setCurrentLanguage] = useAtom(currentLanguageAtom)
  const { languages, names } = useAvailableLanguages()
  const { t } = useTranslation()

  if (languages.length === 0) return null

  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm font-medium">
        {t("language-label") || "Language"}
      </span>
      <Select
        value={currentLanguage}
        onValueChange={(v) => {
          if (typeof v === "string") setCurrentLanguage(v)
        }}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={t("language-label") || "Language"}>
            {(value) => {
              const code = typeof value === "string" ? value : ""
              return names[code] ?? code
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {languages.map((lang) => (
            <SelectItem key={lang} value={lang}>
              {names[lang] ?? lang}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
