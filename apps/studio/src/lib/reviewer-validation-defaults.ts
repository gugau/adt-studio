export type ReviewerValidationDefaultReasonKind =
  | "page-has-no-images"
  | "page-has-no-activity"
  | "easy-read-unavailable"
  | "sign-language-unavailable"
  | "glossary-unavailable"
  | "text-and-speech-unavailable"
  | "text-and-speech-language-unavailable"
  | "translation-unavailable"
  | "translation-language-required"
  | "translation-language-unavailable"

export function getReviewerValidationDefaultReason(
  kind: ReviewerValidationDefaultReasonKind,
  options?: { language?: string | null },
): string {
  switch (kind) {
    case "page-has-no-images":
      return "Defaulted to N/A because this page does not contain any images."
    case "page-has-no-activity":
      return "Defaulted to N/A because this page does not contain an interactive activity or exercise."
    case "easy-read-unavailable":
      return "Defaulted to N/A because Easy Read output is not currently available for this book."
    case "sign-language-unavailable":
      return "Defaulted to N/A because sign language is not enabled for this book."
    case "glossary-unavailable":
      return "Defaulted to N/A because Glossary has not been generated for this book yet."
    case "text-and-speech-unavailable":
      return "Defaulted to N/A because Text & Speech audio has not been generated yet."
    case "text-and-speech-language-unavailable":
      return options?.language
        ? `Defaulted to N/A because no Text & Speech audio is available for ${options.language}.`
        : "Defaulted to N/A because no Text & Speech audio is available yet."
    case "translation-unavailable":
      return "Defaulted to N/A because Translation has not been generated yet."
    case "translation-language-required":
      return "Defaulted to N/A until this reviewer session has a language selected."
    case "translation-language-unavailable":
      return options?.language
        ? `Defaulted to N/A because no translation output is available for ${options.language}.`
        : "Defaulted to N/A because no translation output is available yet."
  }
}
