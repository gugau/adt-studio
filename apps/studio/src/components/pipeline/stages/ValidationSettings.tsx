import { AccessibilityConfigTab } from "@/components/validation/AccessibilityValidationTabs"

export function ValidationSettings({ bookLabel }: { bookLabel: string; headerTarget?: HTMLDivElement | null; tab?: string }) {
  return <AccessibilityConfigTab label={bookLabel} />
}
