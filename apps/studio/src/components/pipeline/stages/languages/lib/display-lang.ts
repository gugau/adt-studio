const langNames = new Intl.DisplayNames(["en"], { type: "language" })

/**
 * Resolves an ISO language code (e.g. "en", "pt-BR") to its English display
 * name. Falls back to the raw code for unknown locales.
 */
export function displayLang(code: string): string {
  try {
    return langNames.of(code) ?? code
  } catch {
    return code
  }
}
