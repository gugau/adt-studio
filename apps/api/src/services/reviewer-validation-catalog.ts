import fs from "node:fs"
import yaml from "js-yaml"
import {
  ReviewerValidationCatalogSnapshot,
  ReviewerValidationConfig,
  type ReviewerValidationConfig as ReviewerValidationConfigType,
} from "@adt/types"


function loadDefaultReviewerValidationConfig(
  defaultsPath: string,
): ReviewerValidationConfigType {
  const content = fs.readFileSync(`${defaultsPath}/reviewer_validation.yaml`, "utf-8")
  const parsed = yaml.load(content)
  return ReviewerValidationConfig.parse(parsed ?? {})
}

export function isReviewerValidationEnabled(config?: ReviewerValidationConfigType | null): boolean {
  const overrides = ReviewerValidationConfig.parse(config ?? {})
  return overrides.enabled ?? false
}

export function getReviewerValidationCatalog(
  defaultsPath: string,
  config?: ReviewerValidationConfigType | null,
) {
  const defaults = loadDefaultReviewerValidationConfig(defaultsPath)
  const overrides = ReviewerValidationConfig.parse(config ?? {})

  return ReviewerValidationCatalogSnapshot.parse({
    identificationFields: overrides.identification_fields ?? defaults.identification_fields ?? [],
    instructions: overrides.instructions ?? defaults.instructions ?? [],
    pageSections: overrides.sections ?? defaults.sections ?? [],
  })
}
