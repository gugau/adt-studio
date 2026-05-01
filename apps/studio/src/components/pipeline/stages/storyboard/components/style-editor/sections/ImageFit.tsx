import { Trans } from "@lingui/react/macro"
import { StyleLabel } from "../controls/StyleLabel"
import { Section } from "../controls/Section"
import { Select, type SelectOption } from "../controls/Select"
import { objectFitClassMap, objectPositionClassMap } from "../class-maps"
import { useElementStyles } from "../use-element-styles"

const FIT_OPTIONS: ReadonlyArray<SelectOption<string>> = [
  { value: "cover", label: "Cover" },
  { value: "contain", label: "Contain" },
  { value: "fill", label: "Fill" },
  { value: "none", label: "None" },
  { value: "scale-down", label: "Scale down" },
]

const POSITION_OPTIONS: ReadonlyArray<SelectOption<string>> = [
  { value: "center", label: "Center" },
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
]

export function ImageFitSection() {
  const fit = useElementStyles(objectFitClassMap, "cover")
  const position = useElementStyles(objectPositionClassMap, "center")

  return (
    <Section title={<Trans>Image fit</Trans>}>
      <StyleLabel label={<Trans>Fit</Trans>} override={fit.override}>
        <Select value={fit.value} onChange={fit.setValue} options={FIT_OPTIONS} />
      </StyleLabel>
      <StyleLabel label={<Trans>Position</Trans>} override={position.override}>
        <Select value={position.value} onChange={position.setValue} options={POSITION_OPTIONS} />
      </StyleLabel>
    </Section>
  )
}
