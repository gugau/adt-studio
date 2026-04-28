export const STORAGE_KEY_OPENAI = "adt-studio-openai-key"

export function getStoredOpenAIApiKey(): string {
  if (typeof window === "undefined") return ""

  try {
    return window.localStorage.getItem(STORAGE_KEY_OPENAI)?.trim() ?? ""
  } catch {
    return ""
  }
}
