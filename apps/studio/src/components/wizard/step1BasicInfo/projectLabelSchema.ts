import { z } from "zod"
import type { WizardFormValues } from "../wizardForm"

export function createProjectLabelSchema(existingLabels: readonly string[]) {
  return z
    .string()
    .min(1, "Required")
    .regex(
      /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/,
      "Only letters, numbers, dots, dashes, underscores. Must start with a letter or number.",
    )
    .refine(
      (val) => !existingLabels.includes(val),
      "A book with this name already exists.",
    )
}

export function isStep1BasicInfoValid(
  v: WizardFormValues,
  existingLabels: readonly string[],
): boolean {
  if (!v.file) return false
  return createProjectLabelSchema(existingLabels).safeParse(v.label).success
}
