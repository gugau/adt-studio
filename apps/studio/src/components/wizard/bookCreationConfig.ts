import type { WizardFormValues } from "./wizardForm"

export function buildConfigOverrides(values: WizardFormValues): Record<string, unknown> {
  const parsedStartPage = values.startPage.trim() ? Number(values.startPage) : undefined
  const parsedEndPage = values.endPage.trim() ? Number(values.endPage) : undefined

  const config: Record<string, unknown> = {
    default_render_strategy: values.renderStrategy,
    page_sectioning: { mode: values.sectioningMode },
    spread_mode: values.pageGrouping === "spread",
    image_filters: {
      min_side: values.imageFilterMinSide,
      max_side: values.imageFilterMaxSide,
      cropping: values.imageCropping,
      segmentation: values.imageSegmentation,
    },
  }

  if (values.layoutType) config.layout_type = values.layoutType
  if (values.styleguide.trim()) config.styleguide = values.styleguide.trim()
  if (values.editingLanguage.trim()) config.editing_language = values.editingLanguage.trim()
  if (values.outputLanguages.length > 0) config.output_languages = values.outputLanguages
  if (parsedStartPage !== undefined) config.start_page = parsedStartPage
  if (parsedEndPage !== undefined) config.end_page = parsedEndPage
  if (values.imageSegmentation && values.segmentationMinSide.trim()) {
    config.image_segmentation = { min_side: Number(values.segmentationMinSide) }
  }

  return config
}
