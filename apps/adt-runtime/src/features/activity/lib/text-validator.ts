/**
 * Lightweight multilingual text validator. The legacy runtime fetched a 700KB
 * Spanish .dic at boot — that file is no longer shipped, so this port relies on
 * a small fallback word list plus heuristic checks (keyboard mashing, vowel
 * ratio, word length). For non-Spanish books it skips dictionary checks
 * entirely and runs heuristics only.
 *
 * Ported from `assets/adt/modules/activities/textvalidator.js`; the
 * fetch+parse for `index.dic` is removed.
 */

import { getDefaultStore } from "jotai"
import { currentLanguageAtom } from "../../language/state/language.atoms"

const FALLBACK_SPANISH_WORDS = new Set<string>([
  // Function words and common verbs/pronouns
  "a", "al", "algo", "algunos", "ante", "antes", "como", "con", "contra",
  "cual", "cuando", "de", "del", "desde", "donde", "durante", "e", "el",
  "en", "entre", "era", "eres", "es", "esa", "ese", "esta", "está", "este",
  "ha", "hasta", "hay", "he", "las", "lo", "los", "me", "mi", "mí",
  "mientras", "muy", "ni", "no", "nos", "nosotros", "nuestra", "nuestro",
  "o", "otra", "otro", "para", "pero", "por", "porque", "que", "qué",
  "quien", "quién", "se", "sea", "según", "si", "sí", "siempre", "sin",
  "sobre", "soy", "su", "sus", "tal", "también", "tanto", "te", "tu", "tú",
  "un", "una", "uno", "unos", "vosotros", "y", "ya", "yo",
  // Common with accents
  "información", "reformulación", "día", "año", "país", "después", "así",
  "través", "número", "línea", "página", "párrafo", "título", "capítulo",
  "sección", "más", "aquí", "allí", "ahí", "quizás", "oración", "análisis",
  "acción", "sonríe", "ríe",
  // Education
  "ejemplo", "ejercicio", "actividad", "lectura", "texto", "respuesta",
  "pregunta", "problema", "solución", "explicación", "definición", "concepto",
  "tema", "materia", "vocabulario", "gramática", "verbos", "sustantivos",
  "adjetivos", "adverbios", "teoría", "práctica", "resultado", "método",
  "sistema", "función", "proceso", "autor", "libro", "obra", "personaje",
  "historia", "ciencia", "matemática", "biología", "física", "química",
  "geografía", "economía", "tecnología",
  // Common gaps in legacy dict
  "subtítulo", "sumate", "súmate", "sumarse", "cómpralo", "cómprame",
  "cómprate", "yacaré", "yacare",
])

const COMBINING_MARKS = /[̀-ͯ]/g
function removeAccents(text: string): string {
  return text.normalize("NFD").replace(COMBINING_MARKS, "")
}

// Verb conjugation endings → infinitive, ported from the legacy module.
const VERB_ENDINGS: Array<{ ending: string; replacement: string }> = [
  // -ar present
  { ending: "o", replacement: "ar" }, { ending: "as", replacement: "ar" },
  { ending: "a", replacement: "ar" }, { ending: "amos", replacement: "ar" },
  { ending: "áis", replacement: "ar" }, { ending: "an", replacement: "ar" },
  // -ar preterite
  { ending: "é", replacement: "ar" }, { ending: "aste", replacement: "ar" },
  { ending: "ó", replacement: "ar" }, { ending: "asteis", replacement: "ar" },
  { ending: "aron", replacement: "ar" },
  // -ar imperfect
  { ending: "aba", replacement: "ar" }, { ending: "abas", replacement: "ar" },
  { ending: "ábamos", replacement: "ar" }, { ending: "abais", replacement: "ar" },
  { ending: "aban", replacement: "ar" },
  // -ar future
  { ending: "aré", replacement: "ar" }, { ending: "arás", replacement: "ar" },
  { ending: "ará", replacement: "ar" }, { ending: "aremos", replacement: "ar" },
  { ending: "aréis", replacement: "ar" }, { ending: "arán", replacement: "ar" },
  // -ar conditional
  { ending: "aría", replacement: "ar" }, { ending: "arías", replacement: "ar" },
  { ending: "aríamos", replacement: "ar" }, { ending: "aríais", replacement: "ar" },
  { ending: "arían", replacement: "ar" },
  // -ar subjunctive (present and imperfect)
  { ending: "e", replacement: "ar" }, { ending: "es", replacement: "ar" },
  { ending: "emos", replacement: "ar" }, { ending: "éis", replacement: "ar" },
  { ending: "en", replacement: "ar" }, { ending: "ara", replacement: "ar" },
  { ending: "aras", replacement: "ar" }, { ending: "áramos", replacement: "ar" },
  { ending: "arais", replacement: "ar" }, { ending: "aran", replacement: "ar" },
  { ending: "ase", replacement: "ar" }, { ending: "ases", replacement: "ar" },
  { ending: "ásemos", replacement: "ar" }, { ending: "aseis", replacement: "ar" },
  { ending: "asen", replacement: "ar" },
  // Gerund/participle
  { ending: "ando", replacement: "ar" }, { ending: "ado", replacement: "ar" },
  { ending: "ada", replacement: "ar" }, { ending: "ados", replacement: "ar" },
  { ending: "adas", replacement: "ar" },
  // -er present
  { ending: "o", replacement: "er" }, { ending: "es", replacement: "er" },
  { ending: "e", replacement: "er" }, { ending: "emos", replacement: "er" },
  { ending: "éis", replacement: "er" }, { ending: "en", replacement: "er" },
  // -ir present
  { ending: "o", replacement: "ir" }, { ending: "es", replacement: "ir" },
  { ending: "e", replacement: "ir" }, { ending: "imos", replacement: "ir" },
  { ending: "ís", replacement: "ir" }, { ending: "en", replacement: "ir" },
  // -er/-ir preterite (3rd person and 1st person)
  { ending: "í", replacement: "ir" }, { ending: "iste", replacement: "ir" },
  { ending: "ió", replacement: "ir" }, { ending: "ieron", replacement: "ir" },
  { ending: "í", replacement: "er" }, { ending: "iste", replacement: "er" },
  { ending: "ió", replacement: "er" }, { ending: "ieron", replacement: "er" },
  // -er/-ir imperfect
  { ending: "ía", replacement: "er" }, { ending: "ías", replacement: "er" },
  { ending: "íamos", replacement: "er" }, { ending: "íais", replacement: "er" },
  { ending: "ían", replacement: "er" },
  { ending: "ía", replacement: "ir" }, { ending: "ías", replacement: "ir" },
  { ending: "íamos", replacement: "ir" }, { ending: "íais", replacement: "ir" },
  { ending: "ían", replacement: "ir" },
]

const GENDER_VARIATIONS: Array<{ ending: string; replacement: string }> = [
  { ending: "ora", replacement: "or" },
  { ending: "riz", replacement: "r" },
  { ending: "esa", replacement: "" },
  { ending: "ina", replacement: "o" },
  { ending: "ica", replacement: "o" },
  { ending: "ada", replacement: "ado" },
  { ending: "a", replacement: "o" },
]

const SIMPLE_ENDINGS = ["s", "es", "mente"]

function getPossibleStems(word: string): string[] {
  const stems = new Set<string>([word])

  if (word.length > 3) {
    for (const { ending, replacement } of VERB_ENDINGS) {
      if (word.length > ending.length + 2 && word.endsWith(ending)) {
        stems.add(word.slice(0, -ending.length) + replacement)
      }
    }
  }
  for (const { ending, replacement } of GENDER_VARIATIONS) {
    if (word.length > ending.length + 2 && word.endsWith(ending)) {
      stems.add(word.slice(0, -ending.length) + replacement)
    }
  }
  for (const ending of SIMPLE_ENDINGS) {
    if (word.length > ending.length + 2 && word.endsWith(ending)) {
      stems.add(word.slice(0, -ending.length))
    }
  }
  return [...stems]
}

function normalizeLocale(language: string | null | undefined): string {
  return String(language ?? "en").trim().replace(/_/g, "-").toLowerCase() || "en"
}

function baseLanguage(language: string): string {
  return normalizeLocale(language).split("-")[0]
}

function resolveDocumentLanguage(): string {
  try {
    const fromAtom = getDefaultStore().get(currentLanguageAtom) as string
    if (fromAtom) return normalizeLocale(fromAtom)
  } catch {
    // Atom store may not be available yet — fall through to DOM lookup.
  }
  if (typeof document !== "undefined") {
    const lang = document.documentElement.lang
    if (lang) return normalizeLocale(lang)
  }
  return "en"
}

export class TextValidator {
  private readonly base: string
  private readonly spanishWords: Set<string>

  constructor(language?: string) {
    this.base = baseLanguage(language ?? resolveDocumentLanguage())
    this.spanishWords = FALLBACK_SPANISH_WORDS
  }

  async ensureInitialized(): Promise<void> {
    // Kept for API parity with the legacy class; the fallback dictionary is
    // synchronous so nothing to await.
  }

  async isValidText(text: string): Promise<boolean> {
    const clean = text.trim()
    if (!clean) return false

    if (this.hasKeyboardMashing(clean)) return false
    if (!this.hasReasonableVowelRatio(clean)) return false
    if (!this.hasReasonableWordLengths(clean)) return false

    // Non-Spanish books: heuristics only. The legacy module shipped no English
    // dictionary, so dictionary-based rejection would only fire false negatives.
    if (this.base !== "es") return true

    const words = clean
      .toLowerCase()
      .split(/[^a-záéíóúüñ]+/)
      .filter((w) => w.length > 1)
    if (words.length === 0) return true

    let validWordCount = 0
    for (const word of words) {
      if (this.spanishWords.has(word)) {
        validWordCount++
        continue
      }
      const stripped = removeAccents(word)
      if (stripped !== word && this.spanishWords.has(stripped)) {
        validWordCount++
        continue
      }
      const stems = getPossibleStems(word)
      const strippedStems = stems.map(removeAccents)
      if (
        stems.some((s) => this.spanishWords.has(s)) ||
        strippedStems.some((s) => this.spanishWords.has(s))
      ) {
        validWordCount++
      }
    }
    // Threshold lower than nspell since the fallback dictionary is small.
    return (validWordCount / words.length) * 100 >= 25
  }

  private hasKeyboardMashing(text: string): boolean {
    if (/([a-zA-Z])\1{3,}/.test(text)) return true
    const rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"]
    for (const row of rows) {
      for (let i = 0; i <= row.length - 4; i++) {
        if (text.toLowerCase().includes(row.substring(i, i + 4))) return true
      }
    }
    return false
  }

  private hasReasonableVowelRatio(text: string): boolean {
    const letters = text.toLowerCase().replace(/[^a-zñáéíóúü]/g, "")
    if (letters.length < 4) return true
    const vowels = letters.match(/[aeiouáéíóúü]/g) ?? []
    const ratio = vowels.length / letters.length
    if (this.base === "es") return ratio >= 0.25 && ratio <= 0.65
    return ratio >= 0.1 && ratio <= 0.8
  }

  private hasReasonableWordLengths(text: string): boolean {
    const words = text.split(/\s+/).filter((w) => w.length > 0)
    if (words.length < 2) return true
    return !words.some((w) => w.length > 20 && !/[-_]/.test(w))
  }
}

/**
 * Return a validator wired to the CURRENT language. Constructed fresh on each
 * call so an in-session language switch is picked up — the constructor only
 * reads `currentLanguageAtom` and assigns a reference to the module-level
 * `FALLBACK_SPANISH_WORDS` Set, so this is cheap (no dictionary copy).
 *
 * (Previously this cached a singleton instance, which kept the original `base`
 * language even after the learner switched language — Spanish heuristics
 * applied to English text, or vice versa.)
 */
export function getSharedTextValidator(): TextValidator {
  return new TextValidator()
}
