import type { WizardFormValues } from "./wizardForm"
import { PRESETS } from "./constants"

export function buildConfigOverrides(values: WizardFormValues): Record<string, unknown> {
  const parsedStartPage = values.startPage.trim() ? Number(values.startPage) : undefined
  const parsedEndPage = values.endPage.trim() ? Number(values.endPage) : undefined

  const preset = PRESETS.find((p) => p.id === values.selectedPreset)
  const baseConfig = preset?.baseConfig ?? {}
  const baseImageFilters = (baseConfig.image_filters ?? {}) as Record<string, unknown>

  const config: Record<string, unknown> = {
    ...baseConfig,
    default_render_strategy: values.renderStrategy,
    page_sectioning: { mode: values.sectioningMode },
    spread_mode: values.pageGrouping === "spread",
    vector_text_grouping: values.figureExtraction,
    apply_body_background: true,
    generate_activities: values.activitiesGenerator,
    image_filters: {
      ...baseImageFilters,
      min_side: values.imageFilterMinSide,
      max_side: values.imageFilterMaxSide,
      cropping: values.imageCropping,
      segmentation: values.imageSegmentation,
    },
  }

  if (values.selectedPreset && values.selectedPreset !== "custom") {
    config.layout_type = values.selectedPreset
  }
  if (values.styleguide.trim()) config.styleguide = values.styleguide.trim()
  if (values.editingLanguage.trim()) config.editing_language = values.editingLanguage.trim()
  if (values.outputLanguages.length > 0) config.output_languages = values.outputLanguages
  if (parsedStartPage !== undefined) config.start_page = parsedStartPage
  if (parsedEndPage !== undefined) config.end_page = parsedEndPage
  if (values.imageSegmentation && values.segmentationMinSide.trim()) {
    const n = Number(values.segmentationMinSide.trim())
    if (!isNaN(n)) config.image_segmentation = { min_side: n }
  }

  return config
}
