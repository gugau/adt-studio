/**
 * Heuristic Spanish-gibberish detector — fast, dictionary-free.
 *
 * Used as a backstop by the TextValidator: even when no dictionary loads, the
 * score still rejects obvious keyboard mashing and rewards plausible Spanish
 * letter patterns. Ported from `assets/adt/modules/activities/gibberish_detector.js`.
 */

const SPANISH_FEATURES = {
  commonBigrams: [
    "es", "de", "en", "el", "la", "qu", "ue", "ar", "os", "as",
    "er", "ra", "al", "an", "nt", "or", "co", "ci", "ca", "ro",
    "st", "ie", "ta", "te", "me", "to", "tr", "pe", "pa", "ma",
    "do", "lo",
  ],
  commonEndings: [
    "ar", "er", "ir", "os", "as", "es", "ión", "dad", "ado", "ido",
    "mente", "ista", "amos", "emos", "imos", "ando", "endo", "able",
    "ante", "encia", "anza", "tico", "tivo", "tulo",
  ],
  specialChars: ["á", "é", "í", "ó", "ú", "ü", "ñ", "¿", "¡"],
  vowels: new Set(["a", "e", "i", "o", "u", "á", "é", "í", "ó", "ú", "ü"]),
  invalidClusters: [
    "bk", "cg", "dk", "fh", "gj", "jf", "kw", "mz", "pz", "qk",
    "xz", "zx", "zv",
  ],
  commonWords: new Set([
    "el", "la", "los", "las", "un", "una", "unos", "unas", "y", "o",
    "pero", "sin", "con", "para", "por", "de", "del", "al", "en", "yo",
    "tú", "él", "ella", "nosotros", "vosotros", "ellos", "ellas", "mi", "su",
    "ese", "esta", "esto", "aquí", "allí", "ahora", "antes", "después", "sí", "no",
    "bien", "mal", "más", "menos", "muy", "poco", "mucho", "todo", "nada", "algo",
    "quien", "que", "como", "cuando", "donde", "porque", "ser", "estar", "ir", "venir",
    "hacer", "tener", "decir", "dar", "ver", "poner", "casa", "tiempo", "día", "año",
    "hombre", "mujer", "niño", "niña", "vida", "ejemplo", "palabra",
  ]),
}

function hasExcessiveRepetition(text: string): boolean {
  if (/(.)\1{2,}/.test(text)) return true
  // Repeating bigram/trigram patterns like "ababab".
  return /(.{2,})\1{2,}/.test(text)
}

function containsCommonSpanishWords(text: string): boolean {
  for (const word of text.split(/\s+/)) {
    if (word.length > 1 && SPANISH_FEATURES.commonWords.has(word)) return true
  }
  return false
}

function hasInvalidConsonantClusters(text: string): boolean {
  return SPANISH_FEATURES.invalidClusters.some((c) => text.includes(c))
}

function checkBigrams(text: string): number {
  let matches = 0
  let total = 0
  for (let i = 0; i < text.length - 1; i++) {
    const bigram = text.substring(i, i + 2)
    if (bigram.includes(" ")) continue
    total++
    if (SPANISH_FEATURES.commonBigrams.includes(bigram)) matches++
  }
  return total > 0 ? Math.min(1, matches / total) : 0
}

function checkVowelRatio(text: string): number {
  const compact = text.replace(/\s+/g, "")
  if (compact.length === 0) return 0
  let vowels = 0
  for (const ch of compact) {
    if (SPANISH_FEATURES.vowels.has(ch)) vowels++
  }
  const ratio = vowels / compact.length
  // Spanish averages ~47% vowels; reward proximity, penalize distance.
  return 1 - Math.min(1, Math.abs(0.47 - ratio) * 2.5)
}

function checkWordEndings(text: string): number {
  const words = text.split(/\s+/).filter((w) => w.length > 2)
  if (words.length === 0) return 0
  let matches = 0
  for (const word of words) {
    if (SPANISH_FEATURES.commonEndings.some((e) => word.endsWith(e))) matches++
  }
  return Math.min(1, matches / words.length)
}

function checkSpecialChars(text: string): number {
  let count = 0
  for (const ch of SPANISH_FEATURES.specialChars) {
    if (text.includes(ch)) count++
  }
  return Math.min(1, count / 3)
}

export function calculateSpanishScore(text: string): number {
  if (!text || text.length < 3) return 0.5
  const lower = text.toLowerCase()

  if (hasExcessiveRepetition(lower)) return 0.1
  if (containsCommonSpanishWords(lower)) return 0.8
  if (hasInvalidConsonantClusters(lower)) return 0.2

  const score =
    checkBigrams(lower) * 0.5 +
    checkVowelRatio(lower) * 0.3 +
    checkWordEndings(lower) * 0.15 +
    checkSpecialChars(lower) * 0.05
  return Math.min(1, Math.max(0, score))
}

const KNOWN_SPANISH_FALSE_POSITIVES = [
  "subtítulo", "título", "capítulo", "fauna", "flora", "cápsula", "cápsulas",
  "rubio", "rubia", "títulos", "subtítulos", "gris",
]

export function isLikelySpanish(text: string): boolean {
  const lower = text.toLowerCase()
  for (const word of KNOWN_SPANISH_FALSE_POSITIVES) {
    if (lower.includes(word)) return true
  }
  return calculateSpanishScore(text) > 0.25
}
