/**
 * Loads `./assets/config.json` once on boot.
 *
 * The legacy runtime stashed this on `window.appConfig`. We mirror that for
 * compatibility with anything that still reads it (third-party SCORM/EPUB
 * hosts), but the source of truth is `appConfigAtom`.
 */
import type { AppConfig } from "@/shared/state/config.atoms"

declare global {
  interface Window {
    appConfig?: AppConfig
  }
}

const DEFAULT_CONFIG: AppConfig = {
  languages: { available: ["en"], default: "en" },
  features: {},
}

export async function loadAppConfig(versionParam = ""): Promise<AppConfig> {
  try {
    const url = `./assets/config.json${versionParam ? `?v=${versionParam}` : ""}`
    const res = await fetch(url)
    if (!res.ok) return DEFAULT_CONFIG
    const config = (await res.json()) as AppConfig
    if (typeof window !== "undefined") window.appConfig = config
    return {
      ...DEFAULT_CONFIG,
      ...config,
      languages: { ...DEFAULT_CONFIG.languages, ...config.languages },
      features: { ...DEFAULT_CONFIG.features, ...config.features },
    }
  } catch (err) {
    console.warn("Failed to load config.json, using defaults", err)
    return DEFAULT_CONFIG
  }
}

/**
 * Determines the persistence mode for user preferences. WebPub/EPUB hosts
 * frequently strip cookies across navigations, so when the book disables
 * navigation controls we treat it as embedded mode and prefer localStorage.
 */
export function pickStorageMode(config: AppConfig): "cookie" | "localStorage" {
  return config.features.showNavigationControls === false ? "localStorage" : "cookie"
}

/**
 * Reconciles the requested language against the book's supported list.
 * Mirrors `initializeLanguage()` from base.js: if the persisted language
 * isn't available, falls back to the default and warns.
 */
export function pickLanguage(
  config: AppConfig,
  storedLanguage: string | null,
  htmlLang: string | null,
): string {
  const available = config.languages.available ?? []
  const fallback = config.languages.default ?? htmlLang ?? "en"
  if (available.length === 0) return storedLanguage ?? fallback
  if (storedLanguage && available.includes(storedLanguage)) return storedLanguage
  if (storedLanguage) {
    console.warn(
      `Stored language "${storedLanguage}" not available; falling back to "${fallback}".`,
    )
  }
  return fallback
}
