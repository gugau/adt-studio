import { useState } from "react"
import { Image as ImageIcon } from "lucide-react"
import { Trans } from "@lingui/react/macro"
import { StyleLabel } from "../controls/StyleLabel"
import { Section } from "../controls/Section"
import { Select, type SelectOption } from "../controls/Select"

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
  const [fit, setFit] = useState("cover")
  const [position, setPosition] = useState("center")

  return (
    <Section value="imageFit" title={<Trans>Image fit</Trans>} icon={ImageIcon}>
      <StyleLabel label={<Trans>Fit</Trans>}>
        <Select value={fit} onChange={setFit} options={FIT_OPTIONS} />
      </StyleLabel>
      <StyleLabel label={<Trans>Position</Trans>}>
        <Select value={position} onChange={setPosition} options={POSITION_OPTIONS} />
      </StyleLabel>
    </Section>
  )
}
