import { Trans } from "@lingui/react/macro"
import { StyleLabel } from "../controls/StyleLabel"
import { Section } from "../controls/Section"
import { BoxInput, type BoxValue } from "../controls/BoxInput"
import { paddingClassMap, marginClassMap } from "../class-maps"
import { useElementStyles } from "../use-element-styles"

const ZERO: BoxValue = { t: 0, r: 0, b: 0, l: 0 }

export function SpacingSection() {
  const padding = useElementStyles(paddingClassMap, ZERO)
  const margin = useElementStyles(marginClassMap, ZERO)

  return (
    <Section title={<Trans>Spacing</Trans>}>
      <StyleLabel label={<Trans>Padding</Trans>} override={padding.override}>
        <BoxInput value={padding.value} onChange={padding.setValue} />
      </StyleLabel>
      <StyleLabel label={<Trans>Margin</Trans>} override={margin.override}>
        <BoxInput value={margin.value} onChange={margin.setValue} />
      </StyleLabel>
    </Section>
  )
}
