import type { ReviewerValidationStatus } from "@adt/types"
import { getReviewerValidationDefaultReason } from "./reviewer-validation-defaults"

export type DerivedCriterionStatus = {
  status: ReviewerValidationStatus
  isDerived: boolean
  reason: string | null
}

export type ReviewerValidationApplicabilityContext = {
  sectionId: string
  explicitStatus?: ReviewerValidationStatus
  glossaryAvailable: boolean
  glossaryPending: boolean
  textAndSpeechStageDone: boolean
  ttsAvailable: boolean
  ttsPending: boolean
  sessionLanguage: string | null
  translationAvailable: boolean
  translationPending: boolean
  easyReadAvailable: boolean
  signLanguageEnabled: boolean
  pageHasImages: boolean
  pageHasActivity: boolean
}

function normalizeLanguageKey(language: string | null | undefined): string | null {
  const trimmed = language?.trim()
  return trimmed ? trimmed.toLowerCase() : null
}

export function hasLanguageEntries<T extends { entries?: unknown[] }>(
  dataByLanguage: Record<string, T> | undefined,
  language: string | null,
): boolean {
  if (!dataByLanguage) {
    return false
  }

  if (!language) {
    return Object.values(dataByLanguage).some((entry) => (entry.entries?.length ?? 0) > 0)
  }

  const normalized = normalizeLanguageKey(language)
  return Object.entries(dataByLanguage).some(
    ([key, entry]) => normalizeLanguageKey(key) === normalized && (entry.entries?.length ?? 0) > 0,
  )
}

export function resolveReviewerValidationCriterionStatus({
  sectionId,
  explicitStatus,
  glossaryAvailable,
  glossaryPending,
  textAndSpeechStageDone,
  ttsAvailable,
  ttsPending,
  sessionLanguage,
  translationAvailable,
  translationPending,
  easyReadAvailable,
  signLanguageEnabled,
  pageHasImages,
  pageHasActivity,
}: ReviewerValidationApplicabilityContext): DerivedCriterionStatus {
  if (explicitStatus) {
    return {
      status: explicitStatus,
      isDerived: false,
      reason: null,
    }
  }

  if (sectionId === "visual-media-image-description" && !pageHasImages) {
    return {
      status: "not-applicable",
      isDerived: true,
      reason: getReviewerValidationDefaultReason("page-has-no-images"),
    }
  }

  if (sectionId === "interactivity" && !pageHasActivity) {
    return {
      status: "not-applicable",
      isDerived: true,
      reason: getReviewerValidationDefaultReason("page-has-no-activity"),
    }
  }

  if (sectionId === "easy-read" && !easyReadAvailable) {
    return {
      status: "not-applicable",
      isDerived: true,
      reason: getReviewerValidationDefaultReason("easy-read-unavailable"),
    }
  }

  if (sectionId === "sign-language" && !signLanguageEnabled) {
    return {
      status: "not-applicable",
      isDerived: true,
      reason: getReviewerValidationDefaultReason("sign-language-unavailable"),
    }
  }

  if (sectionId === "glossary") {
    if (glossaryPending) {
      return { status: "not-reviewed", isDerived: false, reason: null }
    }
    if (!glossaryAvailable) {
      return {
        status: "not-applicable",
        isDerived: true,
        reason: getReviewerValidationDefaultReason("glossary-unavailable"),
      }
    }
  }

  if (sectionId === "audio-voice-over") {
    if (!textAndSpeechStageDone) {
      return {
        status: "not-applicable",
        isDerived: true,
        reason: getReviewerValidationDefaultReason("text-and-speech-unavailable"),
      }
    }
    if (ttsPending) {
      return { status: "not-reviewed", isDerived: false, reason: null }
    }
    if (!ttsAvailable) {
      return {
        status: "not-applicable",
        isDerived: true,
        reason: getReviewerValidationDefaultReason("text-and-speech-language-unavailable", { language: sessionLanguage }),
      }
    }
  }

  if (sectionId === "translation") {
    if (!textAndSpeechStageDone) {
      return {
        status: "not-applicable",
        isDerived: true,
        reason: getReviewerValidationDefaultReason("translation-unavailable"),
      }
    }
    if (translationPending) {
      return { status: "not-reviewed", isDerived: false, reason: null }
    }
    if (!sessionLanguage) {
      return {
        status: "not-applicable",
        isDerived: true,
        reason: getReviewerValidationDefaultReason("translation-language-required"),
      }
    }
    if (!translationAvailable) {
      return {
        status: "not-applicable",
        isDerived: true,
        reason: getReviewerValidationDefaultReason("translation-language-unavailable", { language: sessionLanguage }),
      }
    }
  }

  return {
    status: "not-reviewed",
    isDerived: false,
    reason: null,
  }
}
