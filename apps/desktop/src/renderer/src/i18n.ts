import { i18n } from "@lingui/core"
import { messages as enMessages } from "./locales/en.po"
import { messages as ptBRMessages } from "./locales/pt-BR.po"
import { messages as esMessages } from "./locales/es.po"
import { messages as frMessages } from "./locales/fr.po"

export const SPLASH_LOCALES = ["en", "pt-BR", "es", "fr"] as const
export type SplashLocale = (typeof SPLASH_LOCALES)[number]

const DEFAULT_LOCALE: SplashLocale = "en"

i18n.load({
  en: enMessages,
  "pt-BR": ptBRMessages,
  es: esMessages,
  fr: frMessages,
})

function resolveLocale(): SplashLocale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE
  const candidates = [navigator.language, ...(navigator.languages ?? [])]
  for (const candidate of candidates) {
    if (!candidate) continue
    const normalized = candidate.toLowerCase()
    if (normalized === "pt-br" || normalized.startsWith("pt-br")) return "pt-BR"
    if (normalized.startsWith("pt")) return "pt-BR"
    if (normalized.startsWith("es")) return "es"
    if (normalized.startsWith("fr")) return "fr"
    if (normalized.startsWith("en")) return "en"
  }
  return DEFAULT_LOCALE
}

i18n.activate(resolveLocale())

export { i18n }
