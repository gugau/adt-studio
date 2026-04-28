import { useState } from "react"
import { Trans } from "@lingui/react/macro"
import { StyleLabel } from "../controls/StyleLabel"
import { Section } from "../controls/Section"
import { BoxInput, type BoxValue } from "../controls/BoxInput"
import { ColorInput } from "../controls/ColorInput"

const ZERO: BoxValue = { t: 0, r: 0, b: 0, l: 0 }

export function BordersSection() {
  const [width, setWidth] = useState<BoxValue>(ZERO)
  const [color, setColor] = useState("#000000")
  const [radius, setRadius] = useState<BoxValue>(ZERO)

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
