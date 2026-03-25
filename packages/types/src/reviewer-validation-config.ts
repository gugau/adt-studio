import { z } from "zod"
import {
  ReviewerPageValidationSections,
  ReviewerValidationCatalogSnapshot,
  ReviewerValidationIdentificationField,
  ReviewerValidationIdentificationFields,
  ReviewerValidationInstruction,
  ReviewerValidationInstructions,
  ReviewerValidationSection,
} from "./reviewer-validation.js"

export const ReviewerValidationConfig = z.object({
  identification_fields: z.array(ReviewerValidationIdentificationField).optional(),
  instructions: z.array(ReviewerValidationInstruction).optional(),
  sections: z.array(ReviewerValidationSection).optional(),
})
export type ReviewerValidationConfig = z.infer<typeof ReviewerValidationConfig>
export type ReviewerValidationCatalog = z.infer<typeof ReviewerValidationCatalogSnapshot>

export function getReviewerValidationCatalog(
  config?: ReviewerValidationConfig | null,
): ReviewerValidationCatalog {
  const parsed = ReviewerValidationConfig.parse(config ?? {})

  return ReviewerValidationCatalogSnapshot.parse({
    identificationFields: parsed.identification_fields ?? ReviewerValidationIdentificationFields,
    instructions: parsed.instructions ?? ReviewerValidationInstructions,
    pageSections: parsed.sections ?? ReviewerPageValidationSections,
  })
}
