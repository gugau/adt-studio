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
  const { value: width, setValue: setWidth } = useElementStyles(
    borderWidthClassMap,
    ZERO
  )
  const { value: radius, setValue: setRadius } = useElementStyles(
    borderRadiusClassMap,
    ZERO
  )
  const { value: color, setValue: setColor } = useElementStyles(
    borderColorClassMap,
    ""
  )

  return (
    <Section title={<Trans>Borders</Trans>}>
      <StyleLabel label={<Trans>Width</Trans>}>
        <BoxInput value={width} onChange={setWidth} />
      </StyleLabel>
      <StyleLabel label={<Trans>Radius</Trans>}>
        <BoxInput value={radius} onChange={setRadius} variant="corners" />
      </StyleLabel>
      <StyleLabel label={<Trans>Color</Trans>}>
        <ColorInput value={color} onChange={setColor} />
      </StyleLabel>
    </Section>
  )
}
