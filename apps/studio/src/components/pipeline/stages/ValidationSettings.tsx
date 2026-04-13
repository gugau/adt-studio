import { AccessibilityConfigTab } from "@/components/validation/AccessibilityValidationTabs"
import { ReviewerChecklistSettingsTab } from "@/components/validation/ReviewerChecklistSettingsTab"
import { TranslationEvaluationSettingsTab } from "@/components/validation/TranslationEvaluationSettingsTab"

export function ValidationSettings({
  bookLabel,
  tab,
}: {
  bookLabel: string
  headerTarget?: HTMLDivElement | null
  tab?: string
}) {
  if (tab === "reviewer-checklist") {
    return <ReviewerChecklistSettingsTab label={bookLabel} />
  }

  if (tab === "translation-evaluation") {
    return <TranslationEvaluationSettingsTab label={bookLabel} />
  }

  return <AccessibilityConfigTab label={bookLabel} />
}
