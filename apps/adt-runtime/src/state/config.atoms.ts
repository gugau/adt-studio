/**
 * App config atoms — backed by `assets/config.json` fetched on boot.
 * The shape mirrors what the legacy runtime stashed on `window.appConfig`.
 */
import { ephemeralAtom } from "./persist"

export interface AppFeatures {
  signLanguage?: boolean
  easyRead?: boolean
  glossary?: boolean
  eli5?: boolean
  readAloud?: boolean
  autoplay?: boolean
  showTutorial?: boolean
  showNavigationControls?: boolean
  describeImages?: boolean
  notepad?: boolean
  showAutoHideButton?: boolean
  characterDisplay?: boolean
  highlight?: boolean
  activities?: boolean
  state?: boolean
}

export interface AppLanguages {
  available: string[]
  default: string
}

export interface AppAnalytics {
  enabled: boolean
  siteId?: number
  trackerUrl?: string
  srcUrl?: string
}

export interface AppConfig {
  title?: string
  shortTitle?: string
  author?: string
  cover?: string
  bundleVersion?: string
  languages: AppLanguages
  features: AppFeatures
  analytics?: AppAnalytics
}

const DEFAULT_CONFIG: AppConfig = {
  languages: { available: ["en"], default: "en" },
  features: {},
}

export const appConfigAtom = ephemeralAtom<AppConfig>(DEFAULT_CONFIG)
