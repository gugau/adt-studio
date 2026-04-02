export function parseOptionalPage(value: string): number | undefined {
  return value.trim() ? Number(value) : undefined
}

export function validatePageRange({
  parsedStartPage,
  parsedEndPage,
}: {
  parsedStartPage: number | undefined
  parsedEndPage: number | undefined
}): string | null {
  const hasInvalidStart =
    parsedStartPage !== undefined &&
    (!Number.isInteger(parsedStartPage) || parsedStartPage < 1)
  const hasInvalidEnd =
    parsedEndPage !== undefined &&
    (!Number.isInteger(parsedEndPage) || parsedEndPage < 1)

  if (hasInvalidStart || hasInvalidEnd) {
    return "Page range must use whole numbers greater than or equal to 1."
  }

  if (
    parsedStartPage !== undefined &&
    parsedEndPage !== undefined &&
    parsedEndPage < parsedStartPage
  ) {
    return "Last page must be greater than or equal to first page."
  }

  return null
}

export function buildConfigOverrides({
  renderStrategy,
  sectioningMode,
  pageGrouping,
  imageFilterMinSide,
  imageFilterMaxSide,
  imageCropping,
  imageSegmentation,
  layoutType,
  styleguide,
  editingLanguage,
  outputLanguages,
  parsedStartPage,
  parsedEndPage,
  segmentationMinSide,
}: {
  renderStrategy: string
  sectioningMode: string
  pageGrouping: string
  imageFilterMinSide: number
  imageFilterMaxSide: number
  imageCropping: boolean
  imageSegmentation: boolean
  layoutType: string
  styleguide: string
  editingLanguage: string
  outputLanguages: string[]
  parsedStartPage: number | undefined
  parsedEndPage: number | undefined
  segmentationMinSide: string
}): Record<string, unknown> {
  const configOverrides: Record<string, unknown> = {
    default_render_strategy: renderStrategy,
    page_sectioning: { mode: sectioningMode },
    spread_mode: pageGrouping === "spread",
    image_filters: {
      min_side: imageFilterMinSide,
      max_side: imageFilterMaxSide,
      cropping: imageCropping,
      segmentation: imageSegmentation,
    },
  }

  if (layoutType) configOverrides.layout_type = layoutType
  if (styleguide.trim()) configOverrides.styleguide = styleguide.trim()
  if (editingLanguage.trim()) configOverrides.editing_language = editingLanguage.trim()
  if (outputLanguages.length > 0) configOverrides.output_languages = outputLanguages
  if (parsedStartPage !== undefined) configOverrides.start_page = parsedStartPage
  if (parsedEndPage !== undefined) configOverrides.end_page = parsedEndPage

  if (imageSegmentation && segmentationMinSide.trim()) {
    configOverrides.image_segmentation = {
      min_side: Number(segmentationMinSide),
    }
  }

  return configOverrides
}
