import type { ComponentType } from "react"
import type { SectionKey } from "../element-types"
import { TypographySection } from "./Typography"
import { AppearanceSection } from "./Appearance"
import { SpacingSection } from "./Spacing"
import { SizingSection } from "./Sizing"
import { LayoutSection } from "./Layout"
import { BordersSection } from "./Borders"
import { ImageFitSection } from "./ImageFit"

export const SECTION_COMPONENTS: Record<SectionKey, ComponentType> = {
  typography: TypographySection,
  appearance: AppearanceSection,
  spacing: SpacingSection,
  sizing: SizingSection,
  layout: LayoutSection,
  borders: BordersSection,
  imageFit: ImageFitSection,
}

export {
  TypographySection,
  AppearanceSection,
  SpacingSection,
  SizingSection,
  LayoutSection,
  BordersSection,
  ImageFitSection,
}
