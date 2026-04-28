import { Trans } from "@lingui/react/macro"
import { StyleLabel } from "../controls/StyleLabel"
import { Section } from "../controls/Section"
import { BoxInput, type BoxValue } from "../controls/BoxInput"
import { paddingClassMap, marginClassMap } from "../class-maps"
import { useElementStyles } from "../use-element-styles"

const ZERO: BoxValue = { t: 0, r: 0, b: 0, l: 0 }

export function SpacingSection() {
  const { value: padding, setValue: setPadding } = useElementStyles(
    paddingClassMap,
    ZERO
  )
  const { value: margin, setValue: setMargin } = useElementStyles(
    marginClassMap,
    ZERO
  )

  return (
    <Section title={<Trans>Spacing</Trans>}>
      <StyleLabel label={<Trans>Padding</Trans>}>
        <BoxInput value={padding} onChange={setPadding} />
      </StyleLabel>
      <StyleLabel label={<Trans>Margin</Trans>}>
        <BoxInput value={margin} onChange={setMargin} />
      </StyleLabel>
    </Section>
  )
}
