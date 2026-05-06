import { msg } from "@lingui/core/macro"
import type { MessageDescriptor } from "@lingui/core"
import type { ActivityTemplateType } from "@/api/client"

/**
 * Localized labels for each activity template type. Use with i18n._() in
 * non-React contexts and useLingui()'s `_` inside components.
 */
export const ACTIVITY_TEMPLATE_LABELS: Record<ActivityTemplateType, MessageDescriptor> = {
  multiple_choice: msg`Multiple choice`,
  true_false: msg`True / false`,
  fill_in_the_blank: msg`Fill in the blank`,
}

/** Short chip label for the activity card. */
export const ACTIVITY_TEMPLATE_SHORT: Record<ActivityTemplateType, MessageDescriptor> = {
  multiple_choice: msg`MC`,
  true_false: msg`T/F`,
  fill_in_the_blank: msg`FITB`,
}
