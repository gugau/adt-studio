/**
 * i18n loader — fetches both the chrome translations
 * (assets/interface_translations/<lang>/interface_translations.json) and the
 * per-page content translations (content/i18n/<lang>/{texts,audios,videos,images}.json),
 * then writes them into Jotai atoms.
 *
 * Direct functional port of `assets/adt/modules/translations.js:fetchTranslations`
 * and `fetchContentFiles`, restructured around atoms.
 */
import { getDefaultStore } from "jotai"
import {
  audioFilesAtom,
  imageFilesAtom,
  translationsAtom,
  videoFilesAtom,
} from "@/state/language.atoms"

async function safeJsonFetch<T = unknown>(
  url: string,
  context: string,
): Promise<T | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`[i18n] ${context}: ${url} returned ${res.status}`)
      return null
    }
    return (await res.json()) as T
  } catch (err) {
    console.warn(`[i18n] failed to load ${url}`, err)
    return null
  }
}

async function loadInterfaceTranslations(
  lang: string,
  versionParam: string,
): Promise<Record<string, string>> {
  const url = `./assets/interface_translations/${lang}/interface_translations.json${versionParam}`
  const data = await safeJsonFetch<Record<string, string>>(url, "interface translations")
  return data ?? {}
}

interface ContentBundle {
  texts: Record<string, string>
  audios: Record<string, string>
  videos: Record<string, string>
  images: Record<string, string>
}

async function loadContentFiles(
  lang: string,
  versionParam: string,
): Promise<ContentBundle> {
  const base = `./content/i18n/${lang}`
  const [texts, audios, videos, images] = await Promise.all([
    safeJsonFetch<Record<string, string>>(`${base}/texts.json${versionParam}`, "texts.json"),
    safeJsonFetch<Record<string, string>>(`${base}/audios.json${versionParam}`, "audios.json"),
    safeJsonFetch<Record<string, string>>(`${base}/videos.json${versionParam}`, "videos.json"),
    safeJsonFetch<Record<string, string>>(`${base}/images.json${versionParam}`, "images.json"),
  ])
  return {
    texts: texts ?? {},
    audios: audios ?? {},
    videos: videos ?? {},
    images: images ?? {},
  }
}

export interface LoadTranslationsResult {
  interface: Record<string, string>
  content: ContentBundle
}

/**
 * Load both interface and content catalogs for a language and write them to
 * the relevant atoms. Replaces the side-effect of `fetchTranslations` from
 * the legacy runtime.
 */
export async function loadTranslations(
  lang: string,
  bundleVersion?: string,
): Promise<LoadTranslationsResult> {
  const versionParam = bundleVersion ? `?v=${bundleVersion}` : ""

  const [interfaceData, content] = await Promise.all([
    loadInterfaceTranslations(lang, versionParam),
    loadContentFiles(lang, versionParam),
  ])

  const store = getDefaultStore()
  // Interface keys + content text keys live in the same translation map (legacy
  // shape); content keys override interface keys with the same id, just like
  // the original spread order.
  store.set(translationsAtom, { ...interfaceData, ...content.texts })
  store.set(audioFilesAtom, content.audios)
  store.set(videoFilesAtom, content.videos)
  // Replace (don't merge) imageFiles so switching to a language without an
  // image variant correctly falls back to the original src.
  store.set(imageFilesAtom, content.images)

  return { interface: interfaceData, content }
}

/**
 * Apply translations to the static `#content` DOM. The content HTML ships
 * with `data-id="..."` markers on each text span; this swaps in the translated
 * text and updates `<img alt>` / placeholders / page <title>.
 *
 * Easy-read mode is handled by preferring `${id}_easy_read` keys for paragraphs
 * (skipping headers, nav items, activity options, and word cards — see the
 * legacy applyTranslationToElements logic for the full exclusion list).
 */
export function applyTranslationsToDOM(
  translations: Record<string, string>,
  options: { easyReadMode: boolean } = { easyReadMode: false },
): void {
  if (typeof document === "undefined") return

  for (const [key, value] of Object.entries(translations)) {
    if (key.endsWith("_eli5") || key.endsWith("_easy_read")) continue

    let translationKey = key
    if (options.easyReadMode) {
      const easyReadKey = `${key}_easy_read`
      if (translations[easyReadKey] !== undefined) {
        const elements = document.querySelectorAll(`[data-id="${cssEscape(key)}"]`)
        const isHeaderOrExcluded = Array.from(elements).some((el) => {
          const tag = el.tagName.toLowerCase()
          if (/^h[1-6]$/.test(tag)) return true
          return Boolean(
            el.closest(".word-card") ||
              el.closest("[data-activity-item]") ||
              el.closest(".activity-text") ||
              el.closest("nav"),
          )
        })
        if (!isHeaderOrExcluded) translationKey = easyReadKey
      }
    }

    const text = translations[translationKey] ?? value
    if (text === undefined) continue

    const elements = document.querySelectorAll(`[data-id="${cssEscape(key)}"]`)
    elements.forEach((el) => {
      if (el.tagName === "IMG") {
        el.setAttribute("alt", text)
      } else {
        ;(el as HTMLElement).innerHTML = text.replace(/\n/g, "<br>")
      }
    })

    const placeholders = document.querySelectorAll(
      `[data-placeholder-id="${cssEscape(key)}"]`,
    )
    placeholders.forEach((el) => {
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        el.setAttribute("placeholder", text)
      }
    })
  }

  // Update <title> if the page declares a title-id meta.
  const titleMeta = document.querySelector('meta[name="title-id"]')
  if (titleMeta) {
    const id = titleMeta.getAttribute("content")
    if (id && translations[id]) document.title = translations[id]
  }
}

/**
 * Apply localized image variants from `imageFilesAtom` to `<img data-id>`
 * elements. Stores the original `src` on first apply so unknown languages
 * fall back to the source image cleanly.
 */
export function applyImageVariants(variants: Record<string, string>): void {
  if (typeof document === "undefined") return
  document.querySelectorAll<HTMLImageElement>("img[data-id]").forEach((img) => {
    const id = img.getAttribute("data-id")
    if (!id) return
    if (!img.dataset.originalSrc) img.dataset.originalSrc = img.getAttribute("src") ?? ""
    const variantFilename = variants[id]
    if (variantFilename) {
      const next = `images/${variantFilename}`
      if (img.getAttribute("src") !== next) img.setAttribute("src", next)
    } else if (img.dataset.originalSrc && img.getAttribute("src") !== img.dataset.originalSrc) {
      img.setAttribute("src", img.dataset.originalSrc)
    }
  })
}

/**
 * Minimal CSS attribute-value escape for use inside `[data-id="…"]` selectors.
 * Browsers ship `CSS.escape`, but it's not safe to assume in older webviews —
 * the legacy runtime hits the same constraint.
 */
function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value)
  return value.replace(/(["\\])/g, "\\$1")
}
