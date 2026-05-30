import { Trans } from "@lingui/react/macro"
import { StyleLabel } from "../controls/StyleLabel"
import { Section } from "../controls/Section"
import { BoxInput, type BoxValue } from "../controls/BoxInput"
import { ColorInput } from "../controls/ColorInput"
import {
  borderWidthClassMap,
  borderRadiusClassMap,
  borderColorClassMap,
} from "../class-maps"
import { useElementStyles } from "../use-element-styles"

const ZERO: BoxValue = { t: 0, r: 0, b: 0, l: 0 }

export function BordersSection() {
  const width = useElementStyles(borderWidthClassMap, ZERO)
  const radius = useElementStyles(borderRadiusClassMap, ZERO)
  const color = useElementStyles(borderColorClassMap, "")

  return (
    <Section title={<Trans>Borders</Trans>}>
      <StyleLabel label={<Trans>Width</Trans>} override={width.override}>
        <BoxInput value={width.value} onChange={width.setValue} />
      </StyleLabel>
      <StyleLabel label={<Trans>Radius</Trans>} override={radius.override}>
        <BoxInput value={radius.value} onChange={radius.setValue} variant="corners" />
      </StyleLabel>
      <StyleLabel label={<Trans>Color</Trans>} override={color.override}>
        <ColorInput value={color.value} onChange={color.setValue} />
      </StyleLabel>
    </Section>
  )
}
