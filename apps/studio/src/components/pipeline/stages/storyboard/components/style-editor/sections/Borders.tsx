import { useState } from "react"
import { Square } from "lucide-react"
import { Trans } from "@lingui/react/macro"
import { StyleLabel } from "../controls/StyleLabel"
import { Section } from "../controls/Section"
import { BoxInput, type BoxValue } from "../controls/BoxInput"

const ZERO: BoxValue = { t: 0, r: 0, b: 0, l: 0 }

export function BordersSection() {
  const [width, setWidth] = useState<BoxValue>(ZERO)
  const [color, setColor] = useState("#000000")
  const [radius, setRadius] = useState<BoxValue>(ZERO)

  return (
    <Section value="borders" title={<Trans>Borders</Trans>} icon={Square}>
      <StyleLabel label={<Trans>Width</Trans>}>
        <BoxInput value={width} onChange={setWidth} max={8} />
      </StyleLabel>
      <StyleLabel label={<Trans>Radius</Trans>}>
        <BoxInput value={radius} onChange={setRadius} variant="corners" max={64} />
      </StyleLabel>
      <StyleLabel label={<Trans>Color</Trans>}>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <input type="text" value={color} onChange={(e) => setColor(e.target.value)} className="text-[11px] flex-1" />
      </StyleLabel>
    </Section>
  )
}
