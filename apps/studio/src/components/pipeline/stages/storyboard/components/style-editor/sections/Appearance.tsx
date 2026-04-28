import { useState } from "react"
import { Trans } from "@lingui/react/macro"
import { StyleLabel } from "../controls/StyleLabel"
import { Section } from "../controls/Section"
import { Select, type SelectOption } from "../controls/Select"
import { ColorInput } from "../controls/ColorInput"

const SHADOW_OPTIONS: ReadonlyArray<SelectOption<string>> = [
  { value: "none", label: "None" },
  { value: "sm", label: "sm" },
  { value: "DEFAULT", label: "Default" },
  { value: "md", label: "md" },
  { value: "lg", label: "lg" },
  { value: "xl", label: "xl" },
  { value: "2xl", label: "2xl" },
]

export function AppearanceSection() {
  const [bgColor, setBgColor] = useState("#ffffff")
  const [opacity, setOpacity] = useState(100)
  const [shadow, setShadow] = useState("none")

  return (
    <Section title={<Trans>Appearance</Trans>}>
      <StyleLabel label={<Trans>Background</Trans>}>
        <ColorInput value={bgColor} onChange={setBgColor} />
      </StyleLabel>
      <StyleLabel label={<Trans>Opacity</Trans>}>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="flex-1 accent-violet-500"
        />
        <span className="text-[11px] tabular-nums w-8 text-right text-muted-foreground">
          {opacity}%
        </span>
      </StyleLabel>
      <StyleLabel label={<Trans>Shadow</Trans>}>
        <Select value={shadow} onChange={setShadow} options={SHADOW_OPTIONS} />
      </StyleLabel>
    </Section>
  )
}
