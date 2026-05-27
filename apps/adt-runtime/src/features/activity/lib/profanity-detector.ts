/**
 * Basic profanity filter for educational text inputs. Self-contained; the
 * word list is intentionally small — this is a coarse safety net, not a
 * content moderation system.
 */

const INAPPROPRIATE_WORDS = [
  // English
  "fuck",
  "shit",
  "ass",
  "damn",
  "bitch",
  "bastard",
  "cunt",
  "dick",
  "penis",
  "vagina",
  // Spanish
  "mierda",
  "puta",
  "pene",
  "pija",
  "boludez",
  "puto",
  "boludo",
  "boluda",
  "joder",
  "carajo",
  "coño",
  "pendejo",
  "culero",
  "verga",
  "polla",
  "chinga",
  "follar",
  "marica",
  "maricon",
  "pinche",
  "cabron",
  "cabrón",
  "culo",
  "gilipollas",
  "pelotudo",
]

// Escape regex metacharacters in word list entries.
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const PROFANITY_REGEX = new RegExp(
  `\\b(?:${INAPPROPRIATE_WORDS.map(escapeRegex).join("|")})\\b`,
  "i",
)

export function containsProfanity(text: string): boolean {
  if (!text || typeof text !== "string") return false
  return PROFANITY_REGEX.test(text)
}
