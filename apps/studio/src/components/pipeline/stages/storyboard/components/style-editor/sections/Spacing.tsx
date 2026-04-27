import { useState } from "react"
import { Box } from "lucide-react"
import { Trans } from "@lingui/react/macro"
import { StyleLabel } from "../controls/StyleLabel"
import { Section } from "../controls/Section"
import { BoxInput, type BoxValue } from "../controls/BoxInput"

const ZERO: BoxValue = { t: 0, r: 0, b: 0, l: 0 }

export function SpacingSection() {
  const [padding, setPadding] = useState<BoxValue>(ZERO)
  const [margin, setMargin] = useState<BoxValue>(ZERO)

  return (
    <Section value="spacing" title={<Trans>Spacing</Trans>} icon={Box}>
      <StyleLabel label={<Trans>Padding</Trans>}>
        <BoxInput value={padding} onChange={setPadding} max={64} />
      </StyleLabel>
      <StyleLabel label={<Trans>Margin</Trans>}>
        <BoxInput value={margin} onChange={setMargin} max={64} />
      </StyleLabel>
    </Section>
  )
}
